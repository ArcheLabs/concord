import type { EventStore } from "@concord/core";
import {
  hashCanonical,
  type EventEnvelope,
  type EventId,
  makeId,
  nowTimestamp,
  version,
} from "@concord/foundation";
import { exportTraceJson } from "./trace-exporter.js";
import type {
  FinishTraceInput,
  ProtocolTrace,
  StartTraceInput,
  TraceEnvironment,
  TraceInitialState,
  TraceRecorder,
  TraceSnapshots,
} from "./types.js";

const emptySnapshots = (): TraceSnapshots => ({
  contextBundles: [],
  contextReceipts: [],
  actions: [],
  policyDecisions: [],
  negotiations: [],
  decisionRecords: [],
  workOrders: [],
  claims: [],
  submissions: [],
  reviews: [],
  knowledgeCandidates: [],
  knowledgeCommits: [],
  knowledgeVersions: [],
  stateViews: [],
  incentiveIntents: [],
  governanceIntents: [],
  humanRequests: [],
  projects: [],
  objectives: [],
  boundaries: [],
  principals: [],
  agents: [],
  runtimeBindings: [],
  memberships: [],
  projectBootstraps: [],
});

const emptyInitialState = (): TraceInitialState => ({
  actors: [],
  goals: [],
  policies: [],
});

export class DefaultTraceRecorder implements TraceRecorder {
  private trace: ProtocolTrace | null = null;

  async start(input: StartTraceInput = {}): Promise<void> {
    const environment: TraceEnvironment = {
      runtime: "node",
      store: "memory",
      coordinator: "memory",
      deterministic: false,
      ...input.environment,
    };
    this.trace = {
      traceId: input.traceId ?? makeId("TraceId", `trace_${cryptoRandomSuffix()}`),
      schemaVersion: version("0.1.0"),
      ...(input.sdkVersion ? { sdkVersion: input.sdkVersion } : {}),
      ...(input.scenario ? { scenario: input.scenario } : {}),
      startedAt: nowTimestamp(),
      environment,
      initialState: { ...emptyInitialState(), ...input.initialState },
      events: [],
      snapshots: emptySnapshots(),
      finalState: {},
    };
  }

  async recordEvent(event: EventEnvelope<string, unknown>): Promise<void> {
    this.ensureStarted();
    const snapshot = structuredClone(event);
    this.trace!.events.push(snapshot);
    captureEventSnapshot(this.trace!.snapshots, snapshot);
  }

  async finish(input: FinishTraceInput = {}): Promise<ProtocolTrace> {
    this.ensureStarted();
    const events = this.trace!.events;
    const finalState = {
      ...this.trace!.finalState,
      eventRoot: hashCanonical(events.map((event) => event.hash?.value ?? "")),
      stateHash: hashCanonical({
        eventCount: events.length,
        lastEventHash: events.at(-1)?.hash?.value,
      }),
      ...input.finalState,
    };
    this.trace = {
      ...this.trace!,
      finishedAt: nowTimestamp(),
      snapshots: mergeSnapshots(this.trace!.snapshots, input.snapshots),
      finalState,
      ...(input.verification ? { verification: input.verification } : {}),
    };
    return this.trace;
  }

  async exportJson(trace: ProtocolTrace): Promise<string> {
    return exportTraceJson(trace);
  }

  private ensureStarted(): void {
    if (!this.trace) {
      throw new Error("Trace recorder has not been started");
    }
  }
}

export function createTracedEventStore(eventStore: EventStore, recorder: TraceRecorder): EventStore {
  return {
    async append<T extends EventEnvelope<string, unknown>>(event: T): Promise<void> {
      await eventStore.append(event);
      await recorder.recordEvent(event);
    },
    async appendMany(events: EventEnvelope<string, unknown>[]): Promise<void> {
      await eventStore.appendMany(events);
      for (const event of events) {
        await recorder.recordEvent(event);
      }
    },
    get(eventId: EventId) {
      return eventStore.get(eventId);
    },
    query(input) {
      return eventStore.query(input);
    },
  };
}

export function captureEventSnapshot(snapshots: TraceSnapshots, event: EventEnvelope<string, unknown>): void {
  const payload = event.payload as Record<string, unknown>;
  switch (event.type) {
    case "ActorRegistered":
      break;
    case "ContextBundleCreated":
      snapshots.contextBundles.push(event.payload);
      break;
    case "ContextReceiptSubmitted":
      snapshots.contextReceipts.push(event.payload);
      break;
    case "ActionProposed":
      snapshots.actions.push(event.payload);
      break;
    case "ActionPolicyEvaluated":
      if (payload["decision"]) snapshots.policyDecisions.push(payload["decision"]);
      break;
    case "NegotiationStarted":
      snapshots.negotiations.push(event.payload);
      break;
    case "NegotiationDecisionRecorded":
      if (payload["decision"]) snapshots.decisionRecords.push(payload["decision"]);
      if (payload["instance"]) snapshots.negotiations.push(payload["instance"]);
      break;
    case "WorkOrderCreated":
      snapshots.workOrders.push(event.payload);
      break;
    case "WorkOrderClaimed":
      snapshots.claims.push(event.payload);
      break;
    case "WorkSubmitted":
      snapshots.submissions.push(event.payload);
      break;
    case "WorkReviewSubmitted":
      snapshots.reviews.push(event.payload);
      break;
    case "KnowledgeCandidateCreated":
      snapshots.knowledgeCandidates.push(event.payload);
      break;
    case "KnowledgeCommitted":
      snapshots.knowledgeCommits.push(event.payload);
      break;
    case "KnowledgeVersionCreated":
      snapshots.knowledgeVersions.push(event.payload);
      break;
    case "StateViewUpdated":
      snapshots.stateViews.push(event.payload);
      break;
    case "ProjectCreated":
      if (payload["project"]) snapshots.projects?.push(payload["project"]);
      break;
    case "ProjectBootstrapped":
      if (payload["bootstrap"]) snapshots.projectBootstraps?.push(payload["bootstrap"]);
      break;
    case "ObjectiveCreated":
      if (payload["objective"]) snapshots.objectives?.push(payload["objective"]);
      break;
    case "BoundaryCreated":
      if (payload["boundary"]) snapshots.boundaries?.push(payload["boundary"]);
      break;
    case "PrincipalRegistered":
      if (payload["principal"]) snapshots.principals?.push(payload["principal"]);
      break;
    case "AgentRegistered":
      if (payload["agent"]) snapshots.agents?.push(payload["agent"]);
      break;
    case "RuntimeBindingCreated":
      if (payload["runtimeBinding"]) snapshots.runtimeBindings?.push(payload["runtimeBinding"]);
      break;
    case "ProjectMemberAdded":
      if (payload["membership"]) snapshots.memberships?.push(payload["membership"]);
      break;
  }
}

function mergeSnapshots(base: TraceSnapshots, input: Partial<TraceSnapshots> = {}): TraceSnapshots {
  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(input).map(([key, value]) => [key, value ?? base[key as keyof TraceSnapshots]]),
    ),
  };
}

function cryptoRandomSuffix(): string {
  return Math.random().toString(36).slice(2, 10);
}
