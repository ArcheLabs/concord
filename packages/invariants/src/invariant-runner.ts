import type { ProtocolTrace } from "@concord/trace";
import type { InvariantRunReport, InvariantRunnerOptions, ProtocolInvariant, TraceIndexes } from "./types.js";
import { builtinInvariants } from "./builtin-invariants/index.js";

export class DefaultInvariantRunner {
  constructor(private readonly invariants: ProtocolInvariant[] = builtinInvariants) {}

  async run(trace: ProtocolTrace, options: InvariantRunnerOptions = {}): Promise<InvariantRunReport> {
    const include = new Set(options.include ?? []);
    const exclude = new Set(options.exclude ?? []);
    const indexes = buildTraceIndexes(trace);
    const selected = this.invariants.filter((invariant) => {
      if (include.size && !include.has(invariant.id)) return false;
      return !exclude.has(invariant.id);
    });
    const results = [];
    for (const invariant of selected) {
      const result = await invariant.check({ trace, indexes });
      results.push({ ...result, id: invariant.id, name: invariant.name, severity: invariant.severity });
    }
    return {
      ok: results.every((result) => result.status !== "fail" || result.severity !== "error"),
      results,
    };
  }
}

export function buildTraceIndexes(trace: ProtocolTrace): TraceIndexes {
  const eventsById = new Map<string, unknown>();
  const eventsByType = new Map<string, unknown[]>();
  for (const event of trace.events) {
    eventsById.set(event.id, event);
    const existing = eventsByType.get(event.type) ?? [];
    existing.push(event);
    eventsByType.set(event.type, existing);
  }
  return {
    eventsById,
    eventsByType,
    actionsById: byId(trace.snapshots.actions),
    policyDecisionsByActionId: byField(trace.snapshots.policyDecisions, "actionId"),
    workOrdersByActionId: groupByField(trace.snapshots.workOrders, "actionId"),
    contextBundlesById: byId(trace.snapshots.contextBundles),
    contextReceiptsById: byField(trace.snapshots.contextReceipts, "contextBundleId"),
    submissionsById: byId(trace.snapshots.submissions),
    knowledgeCandidatesById: byId(trace.snapshots.knowledgeCandidates),
    knowledgeCommitsById: byId(trace.snapshots.knowledgeCommits),
    knowledgeVersionsById: byId(trace.snapshots.knowledgeVersions),
    decisionRecordsById: byId(trace.snapshots.decisionRecords),
    // M9
    projectsById: byId(trace.snapshots.projects ?? []),
    objectivesByProjectId: groupByField(trace.snapshots.objectives ?? [], "projectId"),
    boundariesByProjectId: groupByField(trace.snapshots.boundaries ?? [], "projectId"),
    principalsById: byId(trace.snapshots.principals ?? []),
    agentsById: byId(trace.snapshots.agents ?? []),
    agentsByPrincipalId: groupByField(trace.snapshots.agents ?? [], "principalId"),
    runtimeBindingsById: byId(trace.snapshots.runtimeBindings ?? []),
    membershipsByProjectId: groupByField(trace.snapshots.memberships ?? [], "projectId"),
  };
}

function byId(values: unknown[]): Map<string, unknown> {
  return byField(values, "id");
}

function byField(values: unknown[], field: string): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const value of values) {
    const record = asRecord(value);
    const id = record[field];
    if (typeof id === "string") map.set(id, value);
  }
  return map;
}

function groupByField(values: unknown[], field: string): Map<string, unknown[]> {
  const map = new Map<string, unknown[]>();
  for (const value of values) {
    const record = asRecord(value);
    const id = record[field];
    if (typeof id !== "string") continue;
    const existing = map.get(id) ?? [];
    existing.push(value);
    map.set(id, existing);
  }
  return map;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
