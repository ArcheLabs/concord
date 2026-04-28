import { DatabaseSync } from "node:sqlite";
import type { EventStore, ProjectionScope, ProjectionStore, StateView } from "@ascf/core";
import {
  assertEventHash,
  createEvent,
  type EventEnvelope,
  type EventId,
  type KnowledgeVersionId,
  makeId,
  nowTimestamp,
  sha256,
  version,
  type StateViewId,
} from "@ascf/foundation";

export class MemoryEventStore implements EventStore {
  private readonly events: EventEnvelope<string, unknown>[] = [];

  async append<T extends EventEnvelope<string, unknown>>(event: T): Promise<void> {
    assertEventHash(event);
    if (this.events.some((existing) => existing.id === event.id)) {
      throw new Error(`Event already exists: ${event.id}`);
    }
    this.events.push(event);
  }

  async appendMany(events: EventEnvelope<string, unknown>[]): Promise<void> {
    for (const event of events) {
      await this.append(event);
    }
  }

  async get(eventId: EventId): Promise<EventEnvelope<string, unknown> | null> {
    return this.events.find((event) => event.id === eventId) ?? null;
  }

  async query(input: Parameters<EventStore["query"]>[0] = {}): Promise<EventEnvelope<string, unknown>[]> {
    const fromIndex = input.from ? this.events.findIndex((event) => event.id === input.from) + 1 : 0;
    const start = fromIndex > 0 ? fromIndex : 0;
    let output = this.events.slice(start);
    if (input.type?.length) {
      output = output.filter((event) => input.type?.includes(event.type));
    }
    if (input.correlationId) {
      output = output.filter((event) => event.correlationId === input.correlationId);
    }
    return output.slice(0, input.limit ?? output.length);
  }
}

export class SQLiteEventStore implements EventStore {
  readonly db: DatabaseSync;

  constructor(filename = ":memory:") {
    this.db = new DatabaseSync(filename);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        version TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        actor_id TEXT,
        causation_id TEXT,
        correlation_id TEXT,
        hash TEXT NOT NULL,
        json TEXT NOT NULL
      );
    `);
  }

  async append<T extends EventEnvelope<string, unknown>>(event: T): Promise<void> {
    assertEventHash(event);
    try {
      this.db
        .prepare(
          `INSERT INTO events (id, type, version, timestamp, actor_id, causation_id, correlation_id, hash, json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          event.id,
          event.type,
          event.version.value,
          event.timestamp.iso,
          event.actorId ?? null,
          event.causationId ?? null,
          event.correlationId ?? null,
          event.hash.value,
          JSON.stringify(event),
        );
    } catch (error) {
      throw new Error(`Failed to append event ${event.id}: ${(error as Error).message}`);
    }
  }

  async appendMany(events: EventEnvelope<string, unknown>[]): Promise<void> {
    this.db.exec("BEGIN");
    try {
      for (const event of events) {
        await this.append(event);
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  async get(eventId: EventId): Promise<EventEnvelope<string, unknown> | null> {
    const row = this.db.prepare("SELECT json FROM events WHERE id = ?").get(eventId) as { json: string } | undefined;
    return row ? (JSON.parse(row.json) as EventEnvelope<string, unknown>) : null;
  }

  async query(input: Parameters<EventStore["query"]>[0] = {}): Promise<EventEnvelope<string, unknown>[]> {
    const rows = this.db.prepare("SELECT json FROM events ORDER BY rowid ASC").all() as Array<{ json: string }>;
    const events = rows.map((row) => JSON.parse(row.json) as EventEnvelope<string, unknown>);
    return filterEvents(events, input);
  }
}

export class MemoryProjectionStore implements ProjectionStore {
  private readonly views = new Map<StateViewId, StateView>();
  private latest: StateView | null = null;

  async getStateView(id: StateViewId): Promise<StateView | null> {
    return this.views.get(id) ?? null;
  }

  async getLatestStateView(_scope: ProjectionScope = {}): Promise<StateView | null> {
    return this.latest;
  }

  async saveStateView(view: StateView): Promise<void> {
    this.views.set(view.id, view);
    this.latest = view;
  }
}

export class SQLiteProjectionStore implements ProjectionStore {
  readonly db: DatabaseSync;

  constructor(filename = ":memory:", db?: DatabaseSync) {
    this.db = db ?? new DatabaseSync(filename);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS state_views (
        id TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        created_at TEXT NOT NULL,
        latest_event_id TEXT NOT NULL,
        event_root TEXT NOT NULL,
        height INTEGER,
        knowledge_version_id TEXT NOT NULL,
        projection_hash TEXT NOT NULL,
        json TEXT NOT NULL
      );
    `);
  }

  async getStateView(id: StateViewId): Promise<StateView | null> {
    const row = this.db.prepare("SELECT json FROM state_views WHERE id = ?").get(id) as { json: string } | undefined;
    return row ? (JSON.parse(row.json) as StateView) : null;
  }

  async getLatestStateView(_scope: ProjectionScope = {}): Promise<StateView | null> {
    const row = this.db
      .prepare("SELECT json FROM state_views ORDER BY rowid DESC LIMIT 1")
      .get() as { json: string } | undefined;
    return row ? (JSON.parse(row.json) as StateView) : null;
  }

  async saveStateView(view: StateView): Promise<void> {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO state_views (
          id, version, created_at, latest_event_id, event_root, height, knowledge_version_id, projection_hash, json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        view.id,
        view.version.value,
        view.createdAt.iso,
        view.checkpoint.latestEventId,
        view.checkpoint.eventRoot.value,
        view.checkpoint.height ?? null,
        view.knowledgeVersionId,
        view.projectionHash.value,
        JSON.stringify(view),
      );
  }
}

export function createStateView(input: {
  events: EventEnvelope<string, unknown>[];
  knowledgeVersionId: KnowledgeVersionId;
  id?: StateViewId;
}): StateView {
  const latest = input.events.at(-1);
  const checkpointEvent =
    latest ??
    createEvent({
      type: "StateInitialized",
      payload: { reason: "empty event log" },
    });
  const eventRoot = sha256(input.events.map((event) => event.hash.value));
  const projectionInput = {
    eventRoot,
    height: input.events.length,
    knowledgeVersionId: input.knowledgeVersionId,
    latestEventId: checkpointEvent.id,
  };

  return {
    id: input.id ?? makeId("StateViewId"),
    version: version(`state-${input.events.length}`),
    checkpoint: {
      latestEventId: checkpointEvent.id,
      eventRoot,
      height: input.events.length,
    },
    knowledgeVersionId: input.knowledgeVersionId,
    projectionHash: sha256(projectionInput),
    createdAt: nowTimestamp(),
  };
}

function filterEvents(
  events: EventEnvelope<string, unknown>[],
  input: Parameters<EventStore["query"]>[0] = {},
): EventEnvelope<string, unknown>[] {
  const fromIndex = input.from ? events.findIndex((event) => event.id === input.from) + 1 : 0;
  const start = fromIndex > 0 ? fromIndex : 0;
  let output = events.slice(start);
  if (input.type?.length) {
    output = output.filter((event) => input.type?.includes(event.type));
  }
  if (input.correlationId) {
    output = output.filter((event) => event.correlationId === input.correlationId);
  }
  return output.slice(0, input.limit ?? output.length);
}
