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

    return {
      ok: errors.length === 0,
      replayedEventCount: replayedEvents.length,
      ...(latestStateView ? { latestStateView } : {}),
      ...(latestKnowledgeVersion ? { latestKnowledgeVersion } : {}),
      eventRoot,
      stateHash,
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
