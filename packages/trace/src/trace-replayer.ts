import { MemoryEventStore, SQLiteEventStore, createStateView } from "@concord/state";
import { assertEventHash, hashCanonical, type EventEnvelope } from "@concord/foundation";
import type { ProtocolTrace, TraceReplayOptions, TraceReplayResult } from "./types.js";

export class DefaultTraceReplayer {
  async replay(trace: ProtocolTrace, options: TraceReplayOptions = {}): Promise<TraceReplayResult> {
    const errors: TraceReplayResult["errors"] = [];
    const eventStore = options.store === "sqlite" ? new SQLiteEventStore(options.sqlitePath ?? ":memory:") : new MemoryEventStore();
    const events = eventsForReplay(trace.events, options);

    for (const event of events) {
      try {
        assertEventHash(event);
        await eventStore.append(event);
      } catch (error) {
        errors.push({
          code: "replay.event_append_failed",
          message: (error as Error).message,
          eventId: event.id,
        });
        break;
      }
    }

    const replayedEvents = await eventStore.query();
    const latestKnowledgeVersion = extractLatestPayload(replayedEvents, "KnowledgeVersionCreated");
    const knowledgeVersionId =
      typeof latestKnowledgeVersion === "object" && latestKnowledgeVersion && "id" in latestKnowledgeVersion
        ? String(latestKnowledgeVersion.id)
        : "replay_knowledge";
    const latestStateView =
      replayedEvents.length > 0 ? createStateView({ events: replayedEvents, knowledgeVersionId: knowledgeVersionId as never }) : undefined;
    const eventRoot = hashCanonical(replayedEvents.map((event) => event.hash?.value ?? ""));
    const stateHash = hashCanonical({
      eventCount: replayedEvents.length,
      lastEventHash: replayedEvents.at(-1)?.hash?.value,
    });
    const projectState = rebuildProjectState(replayedEvents);

    return {
      ok: errors.length === 0,
      replayedEventCount: replayedEvents.length,
      ...(latestStateView ? { latestStateView } : {}),
      ...(latestKnowledgeVersion ? { latestKnowledgeVersion } : {}),
      eventRoot,
      stateHash,
      projectState,
      errors,
    };
  }
}

export function eventsForReplay(events: EventEnvelope<string, unknown>[], options: TraceReplayOptions): EventEnvelope<string, unknown>[] {
  let output = events;
  if (options.stopAfterEventCount !== undefined) {
    output = output.slice(0, options.stopAfterEventCount);
  }
  if (options.stopAtEventId) {
    const index = output.findIndex((event) => event.id === options.stopAtEventId);
    output = index >= 0 ? output.slice(0, index + 1) : output;
  }
  return output;
}

function extractLatestPayload(events: EventEnvelope<string, unknown>[], type: string): unknown | undefined {
  return [...events].reverse().find((event) => event.type === type)?.payload;
}

function rebuildProjectState(events: EventEnvelope<string, unknown>[]): unknown {
  const projects = new Map<string, unknown>();
  const objectives = new Map<string, unknown>();
  const boundaries = new Map<string, unknown>();
  const principals = new Map<string, unknown>();
  const agents = new Map<string, unknown>();
  const runtimeBindings = new Map<string, unknown>();
  const memberships = new Map<string, unknown>();
  for (const event of events) {
    const payload = event.payload as Record<string, unknown>;
    if (event.type === "ProjectCreated" && isRecord(payload.project)) projects.set(String(payload.project.id), payload.project);
    if (event.type === "ObjectiveCreated" && isRecord(payload.objective)) objectives.set(String(payload.objective.id), payload.objective);
    if (event.type === "BoundaryCreated" && isRecord(payload.boundary)) boundaries.set(String(payload.boundary.id), payload.boundary);
    if (event.type === "BoundarySuperseded") {
      const previous = boundaries.get(String(payload.previousBoundaryId));
      if (isRecord(previous)) boundaries.set(String(payload.previousBoundaryId), { ...previous, status: "superseded", supersededBy: payload.nextBoundaryId });
    }
    if (event.type === "PrincipalRegistered" && isRecord(payload.principal)) principals.set(String(payload.principal.id), payload.principal);
    if (event.type === "AgentRegistered" && isRecord(payload.agent)) agents.set(String(payload.agent.id), payload.agent);
    if (event.type === "RuntimeBindingCreated" && isRecord(payload.runtimeBinding)) runtimeBindings.set(String(payload.runtimeBinding.id), payload.runtimeBinding);
    if (event.type === "RuntimeBindingRevoked") {
      const binding = runtimeBindings.get(String(payload.runtimeBindingId));
      if (isRecord(binding)) runtimeBindings.set(String(payload.runtimeBindingId), { ...binding, status: "revoked" });
    }
    if (event.type === "ProjectMemberAdded" && isRecord(payload.membership)) memberships.set(String(payload.membership.id), payload.membership);
  }
  return {
    projects: [...projects.values()],
    objectives: [...objectives.values()],
    boundaries: [...boundaries.values()],
    principals: [...principals.values()],
    agents: [...agents.values()],
    runtimeBindings: [...runtimeBindings.values()],
    memberships: [...memberships.values()],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object");
}
