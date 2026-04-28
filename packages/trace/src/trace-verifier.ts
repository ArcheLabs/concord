import { hashEvent, nowTimestamp, type EventEnvelope } from "@concord/foundation";
import { DefaultTraceReplayer } from "./trace-replayer.js";
import type {
  ProtocolTrace,
  TraceInvariantResult,
  TraceVerificationError,
  TraceVerificationReport,
  TraceVerificationWarning,
  TraceVerifyOptions,
} from "./types.js";

export class DefaultTraceVerifier {
  constructor(private readonly replayer = new DefaultTraceReplayer()) {}

  async verify(trace: ProtocolTrace, options: TraceVerifyOptions = {}): Promise<TraceVerificationReport> {
    const errors: TraceVerificationError[] = [];
    const warnings: TraceVerificationWarning[] = [];
    const invariantResults: TraceInvariantResult[] = [];

    validateSchema(trace, errors);
    validateEvents(trace.events, errors, warnings);
    invariantResults.push(...runMinimalTraceInvariants(trace));
    if (options.runInvariants) {
      invariantResults.push(...(await options.runInvariants(trace, options)));
    }

    const replay = await this.replayer.replay(trace);
    for (const error of replay.errors) {
      errors.push({
        code: error.code,
        message: error.message,
        ...(error.eventId ? { eventId: error.eventId } : {}),
        ...(error.details === undefined ? {} : { details: error.details }),
      });
    }
    if (trace.finalState.eventRoot && replay.eventRoot && trace.finalState.eventRoot.value !== replay.eventRoot.value) {
      errors.push({
        code: "trace.replay.event_root_mismatch",
        message: "Replayed event root does not match trace final state",
        details: { expected: trace.finalState.eventRoot, actual: replay.eventRoot },
      });
    }
    if (trace.finalState.stateHash && replay.stateHash && trace.finalState.stateHash.value !== replay.stateHash.value) {
      errors.push({
        code: "trace.replay.state_hash_mismatch",
        message: "Replayed state hash does not match trace final state",
        details: { expected: trace.finalState.stateHash, actual: replay.stateHash },
      });
    }

    for (const result of invariantResults) {
      if (result.status === "fail") {
        const target = options.strict || !result.id.startsWith("governance.") && !result.id.startsWith("incentive.");
        if (target) {
          errors.push({ code: result.id, message: result.message ?? result.name, details: result.details });
        } else {
          warnings.push({ code: result.id, message: result.message ?? result.name, details: result.details });
        }
      } else if (result.status === "warn") {
        warnings.push({ code: result.id, message: result.message ?? result.name, details: result.details });
      }
    }

    return {
      ok: errors.length === 0,
      traceId: trace.traceId,
      verifiedAt: nowTimestamp(),
      eventCount: trace.events.length,
      errors,
      warnings,
      invariantResults,
    };
  }
}

function validateSchema(trace: ProtocolTrace, errors: TraceVerificationError[]): void {
  if (!trace.traceId) {
    errors.push({ code: "trace.schema.trace_id_missing", message: "Trace is missing traceId", path: "traceId" });
  }
  if (!trace.schemaVersion?.value) {
    errors.push({ code: "trace.schema.version_missing", message: "Trace is missing schemaVersion", path: "schemaVersion" });
  }
  if (!Array.isArray(trace.events)) {
    errors.push({ code: "trace.schema.events_invalid", message: "Trace events must be an array", path: "events" });
  }
}

function validateEvents(
  events: EventEnvelope<string, unknown>[],
  errors: TraceVerificationError[],
  warnings: TraceVerificationWarning[],
): void {
  const ids = new Set<string>();
  for (const [index, event] of events.entries()) {
    if (!event.id || !event.type || !event.version?.value || !event.timestamp?.iso || !event.hash?.value) {
      errors.push({ code: "event.envelope.invalid", message: `Event at index ${index} is missing envelope fields`, eventId: event.id });
      continue;
    }
    if (ids.has(event.id)) {
      errors.push({ code: "event.id.duplicate", message: `Duplicate event id ${event.id}`, eventId: event.id });
    }
    ids.add(event.id);
    const expected = hashEvent(event);
    if (expected.value !== event.hash.value) {
      errors.push({ code: "event.hash.invalid", message: `Invalid event hash for ${event.id}`, eventId: event.id });
    }
    if (event.causationId && !ids.has(event.causationId)) {
      errors.push({
        code: "event.causation.missing",
        message: `Event ${event.id} references missing prior causation event ${event.causationId}`,
        eventId: event.id,
      });
    }
    if (!event.correlationId && event.type !== "ActorRegistered" && event.type !== "GoalCreated") {
      warnings.push({ code: "event.correlation.missing", message: `Event ${event.id} has no correlation id`, eventId: event.id });
    }
  }
}

function runMinimalTraceInvariants(trace: ProtocolTrace): TraceInvariantResult[] {
  const actions = trace.snapshots.actions as Array<{ id?: string; riskLevel?: string }>;
  const policyDecisions = trace.snapshots.policyDecisions as Array<{ actionId?: string; result?: string }>;
  const decisionRecords = trace.snapshots.decisionRecords as Array<{ actionId?: string; id?: string; result?: string }>;
  const workOrders = trace.snapshots.workOrders as Array<{ actionId?: string }>;
  const knowledgeVersions = trace.snapshots.knowledgeVersions as Array<{ id?: string; commitIds?: string[]; hash?: { value?: string } }>;

  const policyByAction = new Map(policyDecisions.map((decision) => [decision.actionId, decision]));
  const decisionByAction = new Map(decisionRecords.map((decision) => [decision.actionId, decision]));
  const decisionIds = new Set(decisionRecords.map((decision) => decision.id));
  const results: TraceInvariantResult[] = [];

  results.push({
    id: "action.policy.required",
    name: "Every action has policy decision",
    status: actions.every((action) => action.id && policyByAction.has(action.id)) ? "pass" : "fail",
    message: "Every ActionIntent must have a PolicyDecision.",
  });
  results.push({
    id: "action.no-work-without-policy",
    name: "No work without policy or decision",
    status: workOrders.every((work) => work.actionId && (policyByAction.has(work.actionId) || decisionByAction.has(work.actionId))) ? "pass" : "fail",
    message: "WorkOrder must be derived from a policy-routed action.",
  });
  results.push({
    id: "knowledge.commit.requires-decision",
    name: "Knowledge commit references decision",
    status: trace.snapshots.knowledgeCommits.every((commit) => {
      const typed = commit as { decisionRecordId?: string };
      return typed.decisionRecordId && decisionIds.has(typed.decisionRecordId);
    })
      ? "pass"
      : "fail",
    message: "KnowledgeCommit must reference a valid DecisionRecord.",
  });
  results.push({
    id: "knowledge.version.has-hash",
    name: "Knowledge versions have hash",
    status: knowledgeVersions.every((knowledgeVersion) => knowledgeVersion.hash?.value) ? "pass" : "fail",
    message: "Every KnowledgeVersion must have a hash.",
  });

  return results;
}
