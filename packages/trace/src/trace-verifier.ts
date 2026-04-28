import { hashEvent, nowTimestamp, type EventEnvelope } from "@concord/foundation";
import { hashBoundary } from "@concord/project";
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
    validateProjectArtifacts(trace, errors, warnings);
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

function validateProjectArtifacts(trace: ProtocolTrace, errors: TraceVerificationError[], warnings: TraceVerificationWarning[]): void {
  const snapshots = trace.snapshots;
  const projects = byId(snapshots.projects ?? []);
  const objectives = byId(snapshots.objectives ?? []);
  const boundaries = byId(snapshots.boundaries ?? []);
  const principals = byId(snapshots.principals ?? []);
  const agents = byId(snapshots.agents ?? []);
  const runtimeBindings = byId(snapshots.runtimeBindings ?? []);
  const memberships = byId(snapshots.memberships ?? []);
  if (!projects.size && !principals.size && !agents.size) return;

  for (const project of projects.values()) {
    const projectId = stringField(project, "id");
    const boundaryId = stringField(project, "boundaryId");
    if (project.status === "active") {
      const activeBoundaries = [...boundaries.values()].filter((boundary) => boundary.projectId === projectId && boundary.status === "active");
      if (activeBoundaries.length !== 1) errors.push({ code: "project.active_boundary.invalid", message: `Active project must have exactly one active boundary: ${projectId}` });
    }
    if (boundaryId && !boundaries.has(boundaryId)) errors.push({ code: "project.boundary_missing", message: `Project references missing boundary: ${boundaryId}` });
    const sponsor = stringField(project, "sponsorPrincipalId");
    if (sponsor && !principals.has(sponsor)) errors.push({ code: "project.sponsor_missing", message: `Project references missing sponsor principal: ${sponsor}` });
  }
  for (const objective of objectives.values()) {
    const projectId = stringField(objective, "projectId");
    if (projectId && !projects.has(projectId)) errors.push({ code: "objective.project_missing", message: `Objective references missing project: ${projectId}` });
  }
  for (const agent of agents.values()) {
    const principalId = stringField(agent, "principalId");
    const principal = principalId ? principals.get(principalId) : undefined;
    if (!principalId || !principal) errors.push({ code: "agent.principal_missing", message: `Agent references missing principal: ${stringField(agent, "id")}` });
    if (agent.status === "active" && principal && ["suspended", "revoked"].includes(String(principal.status))) {
      errors.push({ code: "agent.principal_inactive", message: `Active agent belongs to inactive principal: ${stringField(agent, "id")}` });
    }
  }
  for (const binding of runtimeBindings.values()) {
    const agentId = stringField(binding, "agentId");
    const principalId = stringField(binding, "principalId");
    if (agentId && !agents.has(agentId)) errors.push({ code: "runtime_binding.agent_missing", message: `Runtime binding references missing agent: ${agentId}` });
    if (principalId && !principals.has(principalId)) errors.push({ code: "runtime_binding.principal_missing", message: `Runtime binding references missing principal: ${principalId}` });
  }
  for (const membership of memberships.values()) {
    const projectId = stringField(membership, "projectId");
    const principalId = stringField(membership, "principalId");
    const agentId = stringField(membership, "agentId");
    if (projectId && !projects.has(projectId)) errors.push({ code: "membership.project_missing", message: `Membership references missing project: ${projectId}` });
    if (principalId && !principals.has(principalId)) errors.push({ code: "membership.principal_missing", message: `Membership references missing principal: ${principalId}` });
    if (agentId && !agents.has(agentId)) errors.push({ code: "membership.agent_missing", message: `Membership references missing agent: ${agentId}` });
  }
  for (const context of snapshots.contextBundles as Record<string, unknown>[]) {
    const projectId = stringField(context, "projectId");
    if (projectId && !projects.has(projectId)) errors.push({ code: "context.project_missing", message: `Context references missing project: ${projectId}` });
    const boundaryId = stringField(context, "boundaryId");
    const boundary = boundaryId ? boundaries.get(boundaryId) : undefined;
    const boundaryHash = hashValue(context.boundaryHash);
    if (boundary && boundaryHash && hashBoundary(boundary as never).value !== boundaryHash) {
      warnings.push({ code: "context.boundary_hash_stale", message: `Context boundary hash is stale: ${String(context.id)}` });
    }
  }
  for (const submission of snapshots.submissions as Record<string, unknown>[]) {
    const bindingId = stringField(submission, "runtimeBindingId");
    const binding = bindingId ? runtimeBindings.get(bindingId) : undefined;
    if (bindingId && !binding) errors.push({ code: "submission.runtime_binding_missing", message: `Submission references missing runtime binding: ${bindingId}` });
    if (binding && stringField(submission, "principalId") !== stringField(binding, "principalId")) {
      errors.push({ code: "submission.principal_mismatch", message: `Submission principal does not match runtime binding: ${String(submission.id)}` });
    }
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

function byId(values: unknown[]): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  for (const value of values) {
    if (!value || typeof value !== "object") continue;
    const record = value as Record<string, unknown>;
    const id = stringField(record, "id");
    if (id) map.set(id, record);
  }
  return map;
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  return typeof record[key] === "string" ? record[key] : undefined;
}

function hashValue(value: unknown): string | undefined {
  return value && typeof value === "object" && typeof (value as { value?: unknown }).value === "string"
    ? String((value as { value: string }).value)
    : undefined;
}
