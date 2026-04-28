import type { ProtocolTrace } from "@concord/trace";

export interface ProtocolInvariant {
  id: string;
  name: string;
  description: string;
  severity: "error" | "warning";
  check(input: InvariantCheckInput): Promise<InvariantCheckResult> | InvariantCheckResult;
}

export interface InvariantCheckInput {
  trace: ProtocolTrace;
  indexes: TraceIndexes;
}

export interface TraceIndexes {
  eventsById: Map<string, unknown>;
  eventsByType: Map<string, unknown[]>;
  actionsById: Map<string, unknown>;
  policyDecisionsByActionId: Map<string, unknown>;
  workOrdersByActionId: Map<string, unknown[]>;
  contextBundlesById: Map<string, unknown>;
  contextReceiptsById: Map<string, unknown>;
  submissionsById: Map<string, unknown>;
  knowledgeCandidatesById: Map<string, unknown>;
  knowledgeCommitsById: Map<string, unknown>;
  knowledgeVersionsById: Map<string, unknown>;
  decisionRecordsById: Map<string, unknown>;
}

export interface InvariantCheckResult {
  status: "pass" | "fail" | "warn" | "skipped";
  message?: string;
  details?: unknown;
}

export interface InvariantRunnerOptions {
  include?: string[];
  exclude?: string[];
  strict?: boolean;
}

export interface InvariantRunReport {
  ok: boolean;
  results: Array<InvariantCheckResult & { id: string; name: string; severity: ProtocolInvariant["severity"] }>;
}
