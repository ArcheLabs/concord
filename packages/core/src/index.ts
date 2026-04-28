import { z } from "zod";
import type {
  ActionId,
  ActionPolicyId,
  ActorId,
  ArtifactRef,
  ContextBundleId,
  DecisionRecordId,
  EventEnvelope,
  EventId,
  GoalId,
  GovernanceIntentId,
  Hash,
  IncentiveIntentId,
  KnowledgeCandidateId,
  KnowledgeCommitId,
  KnowledgeVersionId,
  LoopId,
  NegotiationInstanceId,
  NegotiationProtocolId,
  PolicyDecisionId,
  ReviewRecordId,
  StateViewId,
  SubmissionId,
  Timestamp,
  Version,
  WorkClaimId,
  WorkOrderId,
} from "@concord/foundation";

export type ConcordRole = "observer" | "candidate_observer" | "delegate" | "member" | "reviewer" | "guardian";

export interface IdentityBinding {
  namespace: string;
  subject: string;
  proof?: ArtifactRef;
}

export interface CapabilityDescriptor {
  id: string;
  description?: string;
  tags?: string[];
}

export interface CapabilityRequirement {
  id: string;
  required?: boolean;
}

export interface Actor {
  id: ActorId;
  kind: "agent" | "human" | "service" | "guardian";
  displayName?: string;
  identities: IdentityBinding[];
  capabilities?: CapabilityDescriptor[];
  metadata?: Record<string, unknown>;
}

export interface RoleAssignment {
  actorId: ActorId;
  role: ConcordRole;
  scope: {
    goalId?: GoalId;
    loopId?: LoopId;
    actionId?: ActionId;
  };
  validFrom: Timestamp;
  validUntil?: Timestamp;
  source: "policy" | "coordinator" | "governance" | "manual";
}

export interface Goal {
  id: GoalId;
  title: string;
  description: string;
  createdBy: ActorId;
  createdAt: Timestamp;
  status: "active" | "paused" | "completed" | "archived";
}

export interface EventCheckpoint {
  latestEventId: EventId;
  eventRoot: Hash;
  height?: number;
}

export interface StateView {
  id: StateViewId;
  version: Version;
  checkpoint: EventCheckpoint;
  knowledgeVersionId: KnowledgeVersionId;
  projectionHash: Hash;
  createdAt: Timestamp;
}

export type ProjectionScope = { goalId?: GoalId };

export interface ContextBundle {
  id: ContextBundleId;
  goalId: GoalId;
  loopId?: LoopId;
  stateViewId: StateViewId;
  stateViewVersion: Version;
  knowledgeVersionId: KnowledgeVersionId;
  knowledgeHash: Hash;
  protocolVersion: Version;
  actionPolicyVersion: Version;
  artifacts: ArtifactRef[];
  createdAt: Timestamp;
  expiresAt?: Timestamp;
}

export interface ContextReceipt {
  contextBundleId: ContextBundleId;
  stateViewId: StateViewId;
  stateViewVersion: Version;
  knowledgeVersionId: KnowledgeVersionId;
  knowledgeHash: Hash;
  protocolVersion: Version;
  actionPolicyVersion: Version;
  acceptedAt: Timestamp;
  actorId: ActorId;
}

export interface ExpectedOutput {
  description: string;
  schema?: ArtifactRef;
}

export interface AssetAmount {
  asset: string;
  amount: string;
}

export interface ResourceRequest {
  kind: "compute" | "funding" | "human" | "tool";
  description: string;
  amount?: AssetAmount;
}

export interface RewardOffer {
  amount: AssetAmount;
  reason?: string;
}

export interface ActionIntent {
  id: ActionId;
  type: string;
  proposedBy: ActorId;
  goalId: GoalId;
  loopId?: LoopId;
  title: string;
  description: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  context: ContextReceipt;
  inputs: ArtifactRef[];
  expectedOutputs?: ExpectedOutput[];
  requestedResources?: ResourceRequest[];
  createdAt: Timestamp;
}

export type DecisionFlow =
  | "direct"
  | "delegate_vote"
  | "structured_negotiation"
  | "review_protocol"
  | "governance_request"
  | "guardian_review"
  | "reject";

export interface EligibilityRule {
  role?: ConcordRole;
  capability?: string;
}

export interface RequiredContextRule {
  field: "state" | "knowledge" | "protocol" | "policy";
  required: boolean;
}

export interface VotingRule {
  quorum: number;
  threshold: number;
}

export interface ActionPolicy {
  id: ActionPolicyId;
  version: Version;
  actionType: string;
  eligibility: EligibilityRule[];
  requiredContext: RequiredContextRule[];
  decisionFlow: DecisionFlow;
  negotiationProtocolId?: NegotiationProtocolId;
  votingRule?: VotingRule;
  requiresGuardian?: boolean;
  produces?: Array<
    "work_order" | "knowledge_candidate" | "funding_intent" | "governance_intent" | "human_request" | "settlement_intent"
  >;
  resultBinding: "advisory" | "binding" | "requires_external_execution";
}

export interface RequiredNextStep {
  kind: DecisionFlow | "work_order";
  reason: string;
}

export interface PolicyDecision {
  id: PolicyDecisionId;
  actionId: ActionId;
  policyId?: ActionPolicyId;
  result:
    | "approved_directly"
    | "requires_delegate_vote"
    | "requires_negotiation"
    | "requires_review"
    | "requires_governance"
    | "requires_guardian"
    | "rejected";
  reason: string;
  requiredNextStep?: RequiredNextStep;
  createdAt: Timestamp;
}

export interface NegotiationPosition {
  actorId: ActorId;
  stance: "support" | "oppose" | "abstain" | "revise";
  rationale: string;
  evidence: ArtifactRef[];
  score?: number;
  proposedRevision?: ArtifactRef;
}

export interface NegotiationRound {
  index: number;
  positions: NegotiationPosition[];
  openedAt: Timestamp;
  closedAt?: Timestamp;
}

export interface NegotiationInstance {
  id: NegotiationInstanceId;
  protocolId: NegotiationProtocolId;
  actionId: ActionId;
  topic: string;
  initiator: ActorId;
  participants: ActorId[];
  context: ContextReceipt;
  status: "open" | "collecting_positions" | "revising" | "scoring" | "converged" | "failed" | "escalated" | "closed";
  rounds: NegotiationRound[];
  createdAt: Timestamp;
  closedAt?: Timestamp;
}

export interface DecisionRecord {
  id: DecisionRecordId;
  source: "delegate_vote" | "structured_negotiation" | "review" | "guardian" | "governance" | "manual";
  actionId?: ActionId;
  negotiationId?: NegotiationInstanceId;
  result: "approved" | "rejected" | "needs_revision" | "escalated";
  summary: string;
  approvals: ActorId[];
  rejections: ActorId[];
  abstentions: ActorId[];
  unresolvedIssues: string[];
  outputArtifacts: ArtifactRef[];
  createdAt: Timestamp;
}

export interface WorkOrder {
  id: WorkOrderId;
  actionId: ActionId;
  goalId: GoalId;
  title: string;
  description: string;
  requiredCapabilities: CapabilityRequirement[];
  contextBundleId: ContextBundleId;
  reward?: RewardOffer;
  status: "open" | "claimed" | "submitted" | "under_review" | "accepted" | "rejected" | "expired" | "cancelled";
  createdAt: Timestamp;
  expiresAt?: Timestamp;
}

export interface WorkClaim {
  id: WorkClaimId;
  workOrderId: WorkOrderId;
  actorId: ActorId;
  claimedAt: Timestamp;
  leaseUntil?: Timestamp;
}

export interface ExecutionReceipt {
  runtimeId: string;
  actorId: ActorId;
  startedAt: Timestamp;
  finishedAt: Timestamp;
  inputContext: ContextReceipt;
  toolCalls?: ArtifactRef[];
  logs?: ArtifactRef[];
  outputHash?: Hash;
  status: "success" | "failed" | "partial";
}

export interface Submission {
  id: SubmissionId;
  workOrderId: WorkOrderId;
  submittedBy: ActorId;
  contextReceipt: ContextReceipt;
  executionReceipt: ExecutionReceipt;
  artifacts: ArtifactRef[];
  summary: string;
  submittedAt: Timestamp;
}

export type ReviewTarget =
  | { kind: "submission"; submissionId: SubmissionId }
  | { kind: "knowledge_candidate"; candidateId: KnowledgeCandidateId }
  | { kind: "action"; actionId: ActionId };

export interface ReviewRecord {
  id: ReviewRecordId;
  target: ReviewTarget;
  reviewerId: ActorId;
  result: "accept" | "reject" | "needs_revision" | "escalate";
  score?: number;
  rationale: string;
  evidence: ArtifactRef[];
  contextReceipt: ContextReceipt;
  createdAt: Timestamp;
}

export interface ReviewAggregation {
  target: ReviewTarget;
  result: "accepted" | "rejected" | "needs_revision" | "escalated" | "pending";
  records: ReviewRecord[];
}

export interface KnowledgeVersion {
  id: KnowledgeVersionId;
  parentId?: KnowledgeVersionId;
  hash: Hash;
  createdAt: Timestamp;
  createdBy: ActorId;
  commitIds: KnowledgeCommitId[];
}

export type KnowledgeLayer = "bootstrap" | "protocol" | "skill" | "external_input" | "formal" | "deprecated" | "disputed";

export interface KnowledgeCandidate {
  id: KnowledgeCandidateId;
  proposedBy: ActorId;
  source: ArtifactRef;
  summary?: string;
  targetLayer: KnowledgeLayer;
  context: ContextReceipt;
}

export interface KnowledgeCommit {
  id: KnowledgeCommitId;
  candidateIds: KnowledgeCandidateId[];
  decisionRecordId: DecisionRecordId;
  parentVersionId: KnowledgeVersionId;
  nextVersionHash: Hash;
}

export interface KnowledgeCommitInput {
  candidateIds: KnowledgeCandidateId[];
  decisionRecordId: DecisionRecordId;
  parentVersionId: KnowledgeVersionId;
  createdBy: ActorId;
}

export interface KnowledgeScope {
  goalId?: GoalId;
}

export interface KnowledgeDiffInput {
  fromVersionId: KnowledgeVersionId;
  toVersionId: KnowledgeVersionId;
}

export interface KnowledgeDiffResult {
  fromVersionId: KnowledgeVersionId;
  toVersionId: KnowledgeVersionId;
  changedCandidateIds: KnowledgeCandidateId[];
}

export interface KnowledgeMaterialization {
  version: KnowledgeVersion;
  candidates: KnowledgeCandidate[];
}

export interface IncentiveIntent {
  id: IncentiveIntentId;
  kind: "reward_reserve" | "reward_claim" | "tip_request" | "slash_request" | "stake_lock" | "stake_release";
  actorId?: ActorId;
  workOrderId?: WorkOrderId;
  submissionId?: SubmissionId;
  decisionRecordId?: DecisionRecordId;
  amount?: AssetAmount;
  reason: string;
  evidence: ArtifactRef[];
  status: "draft" | "approved" | "submitted_to_gateway" | "settled" | "rejected" | "disputed";
}

export interface GovernanceIntent {
  id: GovernanceIntentId;
  kind: "proposal_create" | "vote" | "execute" | "cancel" | "status_query";
  actionId?: ActionId;
  decisionRecordId?: DecisionRecordId;
  title: string;
  body: string;
  requestedExecution?: ArtifactRef;
  status: "draft" | "approved" | "submitted" | "confirmed" | "executed" | "rejected" | "failed";
}

export interface EventStore {
  append<T extends EventEnvelope<string, unknown>>(event: T): Promise<void>;
  appendMany(events: EventEnvelope<string, unknown>[]): Promise<void>;
  get(eventId: EventId): Promise<EventEnvelope<string, unknown> | null>;
  query(input?: {
    from?: EventId;
    type?: string[];
    correlationId?: string;
    limit?: number;
  }): Promise<EventEnvelope<string, unknown>[]>;
}

export interface ProjectionStore {
  getStateView(id: StateViewId): Promise<StateView | null>;
  getLatestStateView(scope?: ProjectionScope): Promise<StateView | null>;
  saveStateView(view: StateView): Promise<void>;
}

export interface KnowledgeStore {
  getVersion(id: KnowledgeVersionId): Promise<KnowledgeVersion | null>;
  getLatestVersion(scope?: KnowledgeScope): Promise<KnowledgeVersion | null>;
  getCandidate(id: KnowledgeCandidateId): Promise<KnowledgeCandidate | null>;
  saveCandidate(candidate: KnowledgeCandidate): Promise<void>;
  commit(input: KnowledgeCommitInput): Promise<KnowledgeVersion>;
  diff(input: KnowledgeDiffInput): Promise<KnowledgeDiffResult>;
  materialize(input: { versionId: KnowledgeVersionId }): Promise<KnowledgeMaterialization>;
}

export interface ActionPolicyRegistry {
  getPolicy(actionType: string): Promise<ActionPolicy | null>;
  evaluate(input: { action: ActionIntent; actor: Actor; context: ContextBundle }): Promise<PolicyDecision>;
  registerPolicy(input: { policy: ActionPolicy; decisionRecord: DecisionRecord }): Promise<void>;
}

export interface RuntimeExecutionResult {
  submissionDraft: {
    summary: string;
    artifacts: ArtifactRef[];
  };
  executionReceipt: ExecutionReceipt;
}

export interface AgentRuntimeAdapter {
  id: string;
  describeCapabilities(actorId: ActorId): Promise<CapabilityDescriptor[]>;
  execute(input: {
    actorId: ActorId;
    workOrder: WorkOrder;
    context: ContextBundle;
  }): Promise<RuntimeExecutionResult>;
}

export interface GovernanceReceipt {
  id: string;
  status: string;
  artifact?: ArtifactRef;
}

export interface GovernanceGateway {
  submitProposal(input: unknown): Promise<GovernanceReceipt>;
  vote(input: unknown): Promise<GovernanceReceipt>;
  execute(input: unknown): Promise<GovernanceReceipt>;
  getStatus(input: unknown): Promise<unknown>;
}

export interface FundingReceipt {
  id: string;
  status: string;
  artifact?: ArtifactRef;
}

export interface FundingGateway {
  reserve(input: unknown): Promise<FundingReceipt>;
  claim(input: unknown): Promise<FundingReceipt>;
  query(input: unknown): Promise<unknown>;
}

export interface StakeGateway {
  getStake(actorId: ActorId): Promise<unknown>;
  lock(input: unknown): Promise<unknown>;
  requestSlash(input: unknown): Promise<unknown>;
}

export interface PriceGateway {
  quote(input: unknown): Promise<unknown>;
}

export interface StateObservationRequest {
  goalId?: GoalId;
  query?: string;
}

export interface StateObservationResult {
  artifacts: ArtifactRef[];
  summary: string;
}

export interface StateSourceAdapter {
  id: string;
  observe(input: StateObservationRequest): Promise<StateObservationResult>;
  query?(input: unknown): Promise<unknown>;
}

export interface CoordinationGateway {
  publishEvent(event: EventEnvelope<string, unknown>): Promise<void>;
  subscribe(input?: { type?: string[] }): AsyncIterable<EventEnvelope<string, unknown>>;
  assignRole(input: { actorId: ActorId; role: ConcordRole; scope?: RoleAssignment["scope"] }): Promise<RoleAssignment>;
  acquireLease(input: { resourceId: string; holderId: ActorId; ttlMs: number }): Promise<{ id: string; expiresAt: Timestamp }>;
  broadcastContext(input: { contextBundle: ContextBundle; recipients?: ActorId[] }): Promise<void>;
}

export const ActorSchema = z.object({
  id: z.string(),
  kind: z.enum(["agent", "human", "service", "guardian"]),
  displayName: z.string().optional(),
  identities: z.array(z.object({ namespace: z.string(), subject: z.string() })),
  metadata: z.record(z.unknown()).optional(),
});

export const ActionIntentSchema = z.object({
  id: z.string(),
  type: z.string().min(1),
  proposedBy: z.string(),
  goalId: z.string(),
  title: z.string().min(1),
  description: z.string().min(1),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  inputs: z.array(z.object({ uri: z.string() })),
});
