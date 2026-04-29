import type {
  ActionIntent,
  ActionPolicy,
  ActionPolicyRegistry,
  Actor,
  AgentRuntimeAdapter,
  ContextBundle,
  ContextReceipt,
  EventStore,
  FundingGateway,
  Goal,
  GovernanceGateway,
  KnowledgeCandidate,
  KnowledgeStore,
  NegotiationInstance,
  PolicyDecision,
  ProjectionStore,
  ReviewAggregation,
  ReviewRecord,
  StateView,
  Submission,
  WorkOrder,
} from "@concord/core";
import {
  AgentService,
  BoundaryAwareActionPolicyRegistry,
  BoundaryService,
  MemoryProjectStore,
  ObjectiveService,
  PrincipalService,
  ProjectService,
  SQLiteProjectStore,
  type ProjectStore,
} from "@concord/project";
import {
  MockGovernanceGateway,
  MockRuntimeAdapter,
  receiptFromBundle,
  MemoryEventStore,
  MemoryKnowledgeStore,
  MemoryProjectionStore,
  SQLiteEventStore,
  SQLiteKnowledgeStore,
  SQLiteProjectionStore,
  createStateView,
} from "@concord/adapters";
import { InMemoryNegotiationService } from "@concord/negotiation";
import { InMemoryActionPolicyRegistry } from "@concord/policy";
import { InMemoryReviewService, InMemoryWorkService, RuntimeService } from "@concord/workflow";
import { createEvent, type ActorId, type GoalId, makeId, nowTimestamp, sha256, version } from "@concord/foundation";
import type { ExternalInputService } from "@concord/external-input";
import { InMemoryExternalInputService } from "@concord/external-input";
import type { SelectionService, LeaseManager, FailoverService } from "@concord/selection";
import { InMemorySelectionService, InMemoryLeaseManager, InMemoryFailoverService } from "@concord/selection";
import type { ReputationEvidenceService } from "@concord/reputation";
import { InMemoryReputationEvidenceService } from "@concord/reputation";
import type { IncentiveService, FundingGateway as M13FundingGateway, StakeGateway, PriceGateway } from "@concord/incentive";
import { InMemoryIncentiveService } from "@concord/incentive";
import type { SettlementService } from "@concord/settlement";
import { InMemorySettlementService } from "@concord/settlement";
import { MockFundingGateway as MockLedgerFundingGateway, MockLedger } from "@concord/adapters-mock-ledger";
// Keep legacy MockFundingGateway import for existing fundingGateway field
import { MockFundingGateway } from "@concord/adapters";

export interface ConcordConfig {
  eventStore?: EventStore;
  projectionStore?: ProjectionStore;
  knowledgeStore?: KnowledgeStore;
  policyRegistry?: ActionPolicyRegistry;
  projectStore?: ProjectStore;
  runtimes?: AgentRuntimeAdapter[];
  fundingGateway?: FundingGateway;
  governanceGateway?: GovernanceGateway;
  // M10 – External Input
  externalInputService?: ExternalInputService;
  // M11 – Selection / Lease / Failover / Reputation
  selectionService?: SelectionService;
  leaseManager?: LeaseManager;
  failoverService?: FailoverService;
  reputationService?: ReputationEvidenceService;
  // M13 – Incentive / Settlement / Ledger
  incentiveService?: IncentiveService;
  settlementService?: SettlementService;
  m13FundingGateway?: M13FundingGateway;
  stakeGateway?: StakeGateway;
  priceGateway?: PriceGateway;
}

export interface LoopResult {
  actors: {
    observer: Actor;
    delegate: Actor;
    worker: Actor;
    reviewer: Actor;
    guardian: Actor;
  };
  goal: Goal;
  contextBundle: ContextBundle;
  action: ActionIntent;
  policyDecision: PolicyDecision;
  negotiation: NegotiationInstance;
  decisionRecordId: string;
  workOrder: WorkOrder;
  submission: Submission;
  review: ReviewRecord;
  reviewAggregation: ReviewAggregation;
  knowledgeCandidate: KnowledgeCandidate;
  stateView: StateView;
  eventCount: number;
  knowledgeHash: string;
}

export interface Concord {
  actors: ActorService;
  goals: GoalService;
  context: ContextService;
  actions: ActionService;
  policies: ActionPolicyRegistry;
  projects: ProjectService;
  objectives: ObjectiveService;
  boundaries: BoundaryService;
  principals: PrincipalService;
  agents: AgentService;
  negotiation: InMemoryNegotiationService;
  work: InMemoryWorkService;
  runtime: RuntimeService;
  review: InMemoryReviewService;
  knowledge: KnowledgeStore;
  state: {
    events: EventStore;
    projections: ProjectionStore;
    refresh(knowledgeVersionId: string): Promise<StateView>;
  };
  loop: LoopService;
  fundingGateway: FundingGateway;
  governanceGateway: GovernanceGateway;
  // M10 – External Input
  externalInputs: ExternalInputService;
  // M11 – Selection / Lease / Failover / Reputation
  selection: SelectionService;
  leases: LeaseManager;
  failover: FailoverService;
  reputation: ReputationEvidenceService;
  // M13 – Incentive / Settlement / Ledger
  incentives: IncentiveService;
  settlement: SettlementService;
}

export function createConcord(config: ConcordConfig = {}): Concord {
  const eventStore = config.eventStore ?? new MemoryEventStore();
  const projectionStore = config.projectionStore ?? new MemoryProjectionStore();
  const knowledgeStore = config.knowledgeStore ?? new MemoryKnowledgeStore();
  const projectStore = config.projectStore ?? new MemoryProjectStore();
  const boundaries = new BoundaryService(projectStore, eventStore);
  const basePolicyRegistry = config.policyRegistry ?? new InMemoryActionPolicyRegistry(eventStore);
  const policyRegistry = new BoundaryAwareActionPolicyRegistry(basePolicyRegistry, projectStore, boundaries, eventStore);
  const reputationService = config.reputationService ?? new InMemoryReputationEvidenceService();
  const negotiation = new InMemoryNegotiationService(eventStore, reputationService);
  const work = new InMemoryWorkService(eventStore, { projectStore });
  const runtime = new RuntimeService(config.runtimes?.length ? config.runtimes : [new MockRuntimeAdapter()], { projectStore });
  const review = new InMemoryReviewService(eventStore);

  const actors = new ActorService(eventStore);
  const principals = new PrincipalService(projectStore, eventStore);
  const projectAgents = new AgentService(projectStore, eventStore);
  const projects = new ProjectService(projectStore, eventStore);
  const objectives = new ObjectiveService(projectStore, eventStore);
  const goals = new GoalService(eventStore);
  const state = {
    events: eventStore,
    projections: projectionStore,
    async refresh(knowledgeVersionId: string): Promise<StateView> {
      const events = await eventStore.query();
      const stateView = createStateView({ events, knowledgeVersionId: knowledgeVersionId as never });
      await projectionStore.saveStateView(stateView);
      await eventStore.append(createEvent({ type: "StateViewUpdated", payload: stateView }));
      return stateView;
    },
  };
  const context = new ContextService(eventStore, projectionStore, knowledgeStore);
  const actions = new ActionService(eventStore, policyRegistry);
  const loop = new LoopService({
    actors,
    goals,
    context,
    actions,
    policies: policyRegistry,
    negotiation,
    work,
    runtime,
    review,
    knowledge: knowledgeStore,
    eventStore,
    projectionStore,
  });

  return {
    actors,
    goals,
    context,
    actions,
    policies: policyRegistry,
    projects,
    objectives,
    boundaries,
    principals,
    agents: projectAgents,
    negotiation,
    work,
    runtime,
    review,
    knowledge: knowledgeStore,
    state,
    loop,
    fundingGateway: config.fundingGateway ?? new MockFundingGateway(),
    governanceGateway: config.governanceGateway ?? new MockGovernanceGateway(),
    externalInputs: config.externalInputService ?? new InMemoryExternalInputService(),
    selection: config.selectionService ?? new InMemorySelectionService(),
    leases: config.leaseManager ?? new InMemoryLeaseManager(),
    failover: config.failoverService ?? new InMemoryFailoverService(),
    reputation: reputationService,
    incentives: config.incentiveService ?? new InMemoryIncentiveService(config.m13FundingGateway),
    settlement: config.settlementService ?? new InMemorySettlementService(),
  };
}

export function createSQLiteConcord(filename: string, config: Omit<ConcordConfig, "eventStore" | "projectionStore" | "knowledgeStore"> = {}): Concord {
  const eventStore = new SQLiteEventStore(filename);
  return createConcord({
    ...config,
    eventStore,
    projectionStore: new SQLiteProjectionStore(filename, eventStore.db),
    knowledgeStore: new SQLiteKnowledgeStore(filename, eventStore.db),
    projectStore: new SQLiteProjectStore(filename, eventStore.db),
  });
}

export class ActorService {
  private readonly actors = new Map<ActorId, Actor>();

  constructor(private readonly eventStore: EventStore) {}

  async register(input: Omit<Actor, "id"> & { id?: ActorId }): Promise<Actor> {
    const actor: Actor = { ...input, id: input.id ?? makeId("ActorId") };
    this.actors.set(actor.id, actor);
    await this.eventStore.append(createEvent({ type: "ActorRegistered", actorId: actor.id, payload: actor }));
    return actor;
  }

  async get(id: ActorId): Promise<Actor | null> {
    return this.actors.get(id) ?? null;
  }

  async list(): Promise<Actor[]> {
    return [...this.actors.values()];
  }
}

export class GoalService {
  private readonly goals = new Map<GoalId, Goal>();

  constructor(private readonly eventStore: EventStore) {}

  async create(input: Omit<Goal, "id" | "createdAt" | "status"> & { id?: GoalId; status?: Goal["status"] }): Promise<Goal> {
    const goal: Goal = {
      ...input,
      id: input.id ?? makeId("GoalId"),
      createdAt: nowTimestamp(),
      status: input.status ?? "active",
    };
    this.goals.set(goal.id, goal);
    await this.eventStore.append(createEvent({ type: "GoalCreated", actorId: goal.createdBy, payload: goal }));
    return goal;
  }

  async get(id: GoalId): Promise<Goal | null> {
    return this.goals.get(id) ?? null;
  }

  async list(): Promise<Goal[]> {
    return [...this.goals.values()];
  }
}

export class ContextService {
  private readonly bundles = new Map<string, ContextBundle>();

  constructor(
    private readonly eventStore: EventStore,
    private readonly projectionStore: ProjectionStore,
    private readonly knowledgeStore: KnowledgeStore,
  ) {}

  async createBundle(input: { goalId: GoalId; actorId: ActorId; artifacts?: ContextBundle["artifacts"] }): Promise<ContextBundle> {
    const knowledgeVersion = await this.knowledgeStore.getLatestVersion();
    if (!knowledgeVersion) {
      throw new Error("Cannot create context without an initial knowledge version");
    }
    let stateView = await this.projectionStore.getLatestStateView();
    if (!stateView) {
      stateView = createStateView({ events: await this.eventStore.query(), knowledgeVersionId: knowledgeVersion.id });
      await this.projectionStore.saveStateView(stateView);
    }
    const bundle: ContextBundle = {
      id: makeId("ContextBundleId"),
      goalId: input.goalId,
      stateViewId: stateView.id,
      stateViewVersion: stateView.version,
      knowledgeVersionId: knowledgeVersion.id,
      knowledgeHash: knowledgeVersion.hash,
      protocolVersion: version("1.0.0"),
      actionPolicyVersion: version("1.0.0"),
      artifacts: input.artifacts ?? [],
      createdAt: nowTimestamp(),
    };
    this.bundles.set(bundle.id, bundle);
    await this.eventStore.append(createEvent({ type: "ContextBundleCreated", actorId: input.actorId, payload: bundle }));
    return bundle;
  }

  async acceptBundle(input: { actorId: ActorId; contextBundleId: string }): Promise<ContextReceipt> {
    const bundle = this.bundles.get(input.contextBundleId);
    if (!bundle) {
      throw new Error(`Context bundle not found: ${input.contextBundleId}`);
    }
    const receipt = receiptFromBundle(bundle, input.actorId);
    await this.eventStore.append(createEvent({ type: "ContextReceiptSubmitted", actorId: input.actorId, payload: receipt }));
    return receipt;
  }

  async getBundle(id: string): Promise<ContextBundle | null> {
    return this.bundles.get(id) ?? null;
  }
}

export class ActionService {
  private readonly actions = new Map<string, ActionIntent>();

  constructor(
    private readonly eventStore: EventStore,
    private readonly policyRegistry: ActionPolicyRegistry,
  ) {}

  async propose(input: Omit<ActionIntent, "id" | "createdAt"> & { id?: ActionIntent["id"] }): Promise<ActionIntent> {
    const action: ActionIntent = {
      ...input,
      id: input.id ?? makeId("ActionId"),
      createdAt: nowTimestamp(),
    };
    this.actions.set(action.id, action);
    await this.eventStore.append(createEvent({ type: "ActionProposed", actorId: action.proposedBy, payload: action }));
    return action;
  }

  async evaluate(input: { action: ActionIntent; actor: Actor; context: ContextBundle }): Promise<PolicyDecision> {
    return this.policyRegistry.evaluate(input);
  }

  async get(id: string): Promise<ActionIntent | null> {
    return this.actions.get(id) ?? null;
  }
}

export class LoopService {
  constructor(
    private readonly deps: {
      actors: ActorService;
      goals: GoalService;
      context: ContextService;
      actions: ActionService;
      policies: ActionPolicyRegistry;
      negotiation: InMemoryNegotiationService;
      work: InMemoryWorkService;
      runtime: RuntimeService;
      review: InMemoryReviewService;
      knowledge: KnowledgeStore;
      eventStore: EventStore;
      projectionStore: ProjectionStore;
    },
  ) {}

  async runOnce(): Promise<LoopResult> {
    const observer = await this.deps.actors.register(actorInput("observer", "Observer Agent"));
    const delegate = await this.deps.actors.register(actorInput("delegate", "Delegate Agent"));
    const worker = await this.deps.actors.register(actorInput("member", "Worker Agent"));
    const reviewer = await this.deps.actors.register(actorInput("reviewer", "Reviewer Agent"));
    const guardian = await this.deps.actors.register(actorInput("guardian", "Guardian Agent", "guardian"));

    await ensureInitialKnowledge(this.deps.knowledge, observer.id);
    await ensureDefaultPolicy(this.deps.policies);

    const goal = await this.deps.goals.create({
      title: "Bootstrap Concord MVP Loop",
      description: "Run a complete observe, decide, execute, review, and knowledge update loop.",
      createdBy: observer.id,
    });
    const contextBundle = await this.deps.context.createBundle({ goalId: goal.id, actorId: observer.id });
    const observerReceipt = await this.deps.context.acceptBundle({ actorId: observer.id, contextBundleId: contextBundle.id });
    const action = await this.deps.actions.propose({
      type: "create_plan",
      proposedBy: observer.id,
      goalId: goal.id,
      title: "Create MVP coordination plan",
      description: "Produce a concrete execution plan for the next Concord iteration.",
      riskLevel: "medium",
      context: observerReceipt,
      inputs: [{ uri: "memory://observations/bootstrap" }],
      expectedOutputs: [{ description: "A concise coordination plan" }],
    });
    const policyDecision = await this.deps.actions.evaluate({ action, actor: observer, context: contextBundle });
    const negotiation = await this.deps.negotiation.create({
      action,
      protocolId: policyDecision.result === "requires_delegate_vote" ? "delegate-fast-vote" : "simple-structured-negotiation",
      participants: [delegate],
      context: observerReceipt,
    });
    await this.deps.negotiation.submitPosition({
      negotiationId: negotiation.id,
      position: { actorId: delegate.id, stance: "support", rationale: "MVP action is scoped and auditable.", evidence: [] },
    });
    const { decision } = await this.deps.negotiation.close({ negotiationId: negotiation.id, votingRule: { quorum: 1, threshold: 0.5 } });
    const workOrder = await this.deps.work.createWorkOrder({
      actionId: action.id,
      goalId: goal.id,
      title: "Execute approved MVP plan task",
      description: "Use the runtime adapter to produce the first accepted submission.",
      requiredCapabilities: [{ id: "mock.execute" }],
      contextBundleId: contextBundle.id,
    });
    await this.deps.work.claim({ actorId: worker.id, workOrderId: workOrder.id });
    const execution = await this.deps.runtime.execute({ actorId: worker.id, workOrder, context: contextBundle });
    const submission = await this.deps.work.submit({
      workOrderId: workOrder.id,
      submittedBy: worker.id,
      contextReceipt: execution.executionReceipt.inputContext,
      executionReceipt: execution.executionReceipt,
      artifacts: execution.submissionDraft.artifacts,
      summary: execution.submissionDraft.summary,
    });
    await this.deps.review.requestReview({
      target: { kind: "submission", submissionId: submission.id },
      requestedBy: worker.id,
    });
    const review = await this.deps.review.submitReview({
      target: { kind: "submission", submissionId: submission.id },
      reviewerId: reviewer.id,
      result: "accept",
      score: 1,
      rationale: "Submission contains an execution receipt and artifact hash.",
      evidence: submission.artifacts,
      contextReceipt: receiptFromBundle(contextBundle, reviewer.id),
    });
    const reviewAggregation = await this.deps.review.aggregate({ target: { kind: "submission", submissionId: submission.id } });
    await this.deps.work.accept(workOrder.id);
    const knowledgeCandidate: KnowledgeCandidate = {
      id: makeId("KnowledgeCandidateId"),
      proposedBy: reviewer.id,
      source: { uri: `memory://submissions/${submission.id}`, hash: sha256(submission) },
      summary: submission.summary,
      targetLayer: "formal",
      context: receiptFromBundle(contextBundle, reviewer.id),
    };
    await this.deps.knowledge.saveCandidate(knowledgeCandidate);
    await this.deps.eventStore.append(createEvent({ type: "KnowledgeCandidateCreated", actorId: reviewer.id, payload: knowledgeCandidate }));
    const parentKnowledge = await this.deps.knowledge.getLatestVersion();
    if (!parentKnowledge) {
      throw new Error("Missing parent knowledge after review");
    }
    const nextKnowledge = await this.deps.knowledge.commit({
      candidateIds: [knowledgeCandidate.id],
      decisionRecordId: decision.id,
      parentVersionId: parentKnowledge.id,
      createdBy: reviewer.id,
    });
    await this.deps.eventStore.append(createEvent({ type: "KnowledgeVersionCreated", actorId: reviewer.id, payload: nextKnowledge }));
    const stateView = createStateView({ events: await this.deps.eventStore.query(), knowledgeVersionId: nextKnowledge.id });
    await this.deps.projectionStore.saveStateView(stateView);
    await this.deps.eventStore.append(createEvent({ type: "StateViewUpdated", payload: stateView }));
    const eventCount = (await this.deps.eventStore.query()).length;

    return {
      actors: { observer, delegate, worker, reviewer, guardian },
      goal,
      contextBundle,
      action,
      policyDecision,
      negotiation,
      decisionRecordId: decision.id,
      workOrder: (await this.deps.work.getWorkOrder(workOrder.id)) ?? workOrder,
      submission,
      review,
      reviewAggregation,
      knowledgeCandidate,
      stateView,
      eventCount,
      knowledgeHash: nextKnowledge.hash.value,
    };
  }
}

function actorInput(role: string, displayName: string, kind: Actor["kind"] = "agent"): Omit<Actor, "id"> {
  return {
    kind,
    displayName,
    identities: [{ namespace: "local", subject: role }],
    capabilities: [{ id: `${role}.default` }],
  };
}

async function ensureInitialKnowledge(knowledge: KnowledgeStore, createdBy: ActorId): Promise<void> {
  if (await knowledge.getLatestVersion()) return;
  const seedable = knowledge as KnowledgeStore & {
    seedInitialVersion?: (input: { createdBy: ActorId; seed?: unknown }) => Promise<unknown>;
  };
  if (!seedable.seedInitialVersion) {
    throw new Error("Knowledge store does not support initial version seeding");
  }
  await seedable.seedInitialVersion({ createdBy, seed: "Concord MVP bootstrap knowledge" });
}

async function ensureDefaultPolicy(registry: ActionPolicyRegistry): Promise<void> {
  if (await registry.getPolicy("create_plan")) return;
  const policy: ActionPolicy = {
    id: makeId("ActionPolicyId", "policy_create_plan"),
    version: version("1.0.0"),
    actionType: "create_plan",
    eligibility: [],
    requiredContext: [
      { field: "state", required: true },
      { field: "knowledge", required: true },
      { field: "protocol", required: true },
      { field: "policy", required: true },
    ],
    decisionFlow: "structured_negotiation",
    negotiationProtocolId: makeId("NegotiationProtocolId", "simple-structured-negotiation"),
    votingRule: { quorum: 1, threshold: 0.5 },
    produces: ["work_order", "knowledge_candidate"],
    resultBinding: "binding",
  };
  await registry.registerPolicy({
    policy,
    decisionRecord: {
      id: makeId("DecisionRecordId", "decision_seed_policy"),
      source: "manual",
      result: "approved",
      summary: "Seed default MVP policy.",
      approvals: [],
      rejections: [],
      abstentions: [],
      unresolvedIssues: [],
      outputArtifacts: [],
      createdAt: nowTimestamp(),
    },
  });
}

export { MockRuntimeAdapter, ScriptRuntimeAdapter } from "@concord/adapters";
