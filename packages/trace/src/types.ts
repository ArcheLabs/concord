import type { EventEnvelope, Hash, Timestamp, Version } from "@concord/foundation";

export interface ProtocolTrace {
  traceId: string;
  schemaVersion: Version;
  sdkVersion?: string;
  scenario?: ScenarioTraceInfo;
  startedAt: Timestamp;
  finishedAt?: Timestamp;
  environment: TraceEnvironment;
  initialState: TraceInitialState;
  events: EventEnvelope<string, unknown>[];
  snapshots: TraceSnapshots;
  finalState: TraceFinalState;
  verification?: TraceVerificationReport;
}

export interface ScenarioTraceInfo {
  scenarioId: string;
  scenarioName?: string;
  scenarioHash?: Hash;
  sourcePath?: string;
}

export interface TraceEnvironment {
  runtime: "node" | "browser" | "test" | "unknown";
  store: "memory" | "sqlite" | "postgres" | "unknown";
  coordinator?: "memory" | "fastify" | "p2p" | "unknown";
  deterministic: boolean;
}

export interface TraceInitialState {
  actors: unknown[];
  goals: unknown[];
  knowledgeVersion?: unknown;
  stateView?: unknown;
  policies?: unknown[];
}

export interface TraceSnapshots {
  contextBundles: unknown[];
  contextReceipts: unknown[];
  actions: unknown[];
  policyDecisions: unknown[];
  negotiations: unknown[];
  decisionRecords: unknown[];
  workOrders: unknown[];
  claims: unknown[];
  submissions: unknown[];
  reviews: unknown[];
  knowledgeCandidates: unknown[];
  knowledgeCommits: unknown[];
  knowledgeVersions: unknown[];
  stateViews: unknown[];
  incentiveIntents?: unknown[];
  governanceIntents?: unknown[];
  humanRequests?: unknown[];
}

export interface TraceFinalState {
  latestStateView?: unknown;
  latestKnowledgeVersion?: unknown;
  eventRoot?: Hash;
  stateHash?: Hash;
}

export interface TraceVerificationReport {
  ok: boolean;
  traceId: string;
  verifiedAt: Timestamp;
  eventCount: number;
  errors: TraceVerificationError[];
  warnings: TraceVerificationWarning[];
  invariantResults: TraceInvariantResult[];
}

export interface TraceVerificationError {
  code: string;
  message: string;
  eventId?: string;
  path?: string;
  details?: unknown;
}

export interface TraceVerificationWarning {
  code: string;
  message: string;
  eventId?: string;
  path?: string;
  details?: unknown;
}

export interface TraceInvariantResult {
  id: string;
  name: string;
  status: "pass" | "fail" | "warn" | "skipped";
  message?: string;
  details?: unknown;
}

export interface StartTraceInput {
  traceId?: string;
  scenario?: ScenarioTraceInfo;
  environment?: Partial<TraceEnvironment>;
  initialState?: Partial<TraceInitialState>;
  sdkVersion?: string;
}

export interface FinishTraceInput {
  snapshots?: Partial<TraceSnapshots>;
  finalState?: Partial<TraceFinalState>;
  verification?: TraceVerificationReport;
}

export interface TraceRecorder {
  start(input?: StartTraceInput): Promise<void>;
  recordEvent(event: EventEnvelope<string, unknown>): Promise<void>;
  finish(input?: FinishTraceInput): Promise<ProtocolTrace>;
  exportJson(trace: ProtocolTrace): Promise<string>;
}

export interface TraceReplayOptions {
  store?: "memory" | "sqlite";
  sqlitePath?: string;
  stopAtEventId?: string;
  stopAfterEventCount?: number;
}

export interface ReplayError {
  code: string;
  message: string;
  eventId?: string;
  details?: unknown;
}

export interface TraceReplayResult {
  ok: boolean;
  replayedEventCount: number;
  latestStateView?: unknown;
  latestKnowledgeVersion?: unknown;
  eventRoot?: Hash;
  stateHash?: Hash;
  errors: ReplayError[];
}

export interface TraceVerifyOptions {
  strict?: boolean;
  invariants?: string[];
  skipInvariants?: string[];
  runInvariants?: (trace: ProtocolTrace, options?: TraceVerifyOptions) => Promise<TraceInvariantResult[]> | TraceInvariantResult[];
}

export interface TraceVerifier {
  verify(trace: ProtocolTrace, options?: TraceVerifyOptions): Promise<TraceVerificationReport>;
}
