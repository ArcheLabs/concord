import { createHash, randomUUID } from "node:crypto";

export type Id<T extends string> = string & { readonly __brand: T };

export type ActorId = Id<"ActorId">;
export type GoalId = Id<"GoalId">;
export type LoopId = Id<"LoopId">;
export type ActionId = Id<"ActionId">;
export type EventId = Id<"EventId">;
export type StateViewId = Id<"StateViewId">;
export type KnowledgeVersionId = Id<"KnowledgeVersionId">;
export type KnowledgeCandidateId = Id<"KnowledgeCandidateId">;
export type KnowledgeCommitId = Id<"KnowledgeCommitId">;
export type ContextBundleId = Id<"ContextBundleId">;
export type ActionPolicyId = Id<"ActionPolicyId">;
export type PolicyDecisionId = Id<"PolicyDecisionId">;
export type NegotiationInstanceId = Id<"NegotiationInstanceId">;
export type NegotiationProtocolId = Id<"NegotiationProtocolId">;
export type DecisionRecordId = Id<"DecisionRecordId">;
export type WorkOrderId = Id<"WorkOrderId">;
export type WorkClaimId = Id<"WorkClaimId">;
export type SubmissionId = Id<"SubmissionId">;
export type ReviewRecordId = Id<"ReviewRecordId">;
export type IncentiveIntentId = Id<"IncentiveIntentId">;
export type GovernanceIntentId = Id<"GovernanceIntentId">;
export type ActionIntentId = Id<"ActionIntentId">;
export type OrganizationId = Id<"OrganizationId">;
export type ProjectId = Id<"ProjectId">;
export type ProductId = Id<"ProductId">;
export type ObjectiveId = Id<"ObjectiveId">;
export type BoundaryId = Id<"BoundaryId">;
export type PrincipalId = Id<"PrincipalId">;
export type AgentId = Id<"AgentId">;
export type HumanPrincipalId = Id<"HumanPrincipalId">;
export type AuthorityRoleId = Id<"AuthorityRoleId">;
export type MechanismId = Id<"MechanismId">;
export type MechanismVersionId = Id<"MechanismVersionId">;
export type MechanismInstanceId = Id<"MechanismInstanceId">;
export type RuntimeBindingId = Id<"RuntimeBindingId">;
export type MembershipId = Id<"MembershipId">;
export type ProjectBootstrapId = Id<"ProjectBootstrapId">;
export type AddressBindingId = Id<"AddressBindingId">;
export type CapabilityId = Id<"CapabilityId">;

// M10 – External Input
export type ExternalInputId = Id<"ExternalInputId">;
export type InputClassificationId = Id<"InputClassificationId">;
export type InputRiskAssessmentId = Id<"InputRiskAssessmentId">;
export type InputRoutingDecisionId = Id<"InputRoutingDecisionId">;
export type InputDeduplicationResultId = Id<"InputDeduplicationResultId">;
export type ObservationQueueItemId = Id<"ObservationQueueItemId">;
export type ObservationTaskId = Id<"ObservationTaskId">;
export type ObservationId = Id<"ObservationId">;
export type AssignmentOfferId = Id<"AssignmentOfferId">;
export type DiscussionThreadId = Id<"DiscussionThreadId">;
export type DiscussionRoundId = Id<"DiscussionRoundId">;
export type DiscussionOutcomeId = Id<"DiscussionOutcomeId">;
export type ProposalId = Id<"ProposalId">;
export type VotingRoundId = Id<"VotingRoundId">;
export type TaskId = Id<"TaskId">;
export type ArtifactId = Id<"ArtifactId">;
export type ReviewRoundId = Id<"ReviewRoundId">;
export type ReviewId = Id<"ReviewId">;

// M11 – Selection / Lease / Failover / Reputation
export type SelectionPolicyId = Id<"SelectionPolicyId">;
export type LeaseId = Id<"LeaseId">;
export type RoleAssignmentId = Id<"RoleAssignmentId">;
export type FailoverRecordId = Id<"FailoverRecordId">;
export type ReputationEvidenceId = Id<"ReputationEvidenceId">;

// M13 – Reward / Settlement / Ledger
export type RewardIntentId = Id<"RewardIntentId">;
export type RewardPolicyId = Id<"RewardPolicyId">;
export type SettlementIntentId = Id<"SettlementIntentId">;
export type SettlementBatchId = Id<"SettlementBatchId">;
export type FundingReceiptId = Id<"FundingReceiptId">;
export type SettlementReceiptId = Id<"SettlementReceiptId">;
export type SlashIntentId = Id<"SlashIntentId">;
export type StakePositionId = Id<"StakePositionId">;
export type LedgerAccountId = Id<"LedgerAccountId">;
export type LedgerEntryId = Id<"LedgerEntryId">;
export type StakeReceiptId = Id<"StakeReceiptId">;
export type ReviewAggregationId = Id<"ReviewAggregationId">;

export type ObjectRefKind =
  | "organization"
  | "project"
  | "product"
  | "handbook"
  | "mechanism"
  | "observation_task"
  | "observation"
  | "assignment_offer"
  | "discussion_thread"
  | "discussion_round"
  | "discussion_outcome"
  | "proposal"
  | "voting_round"
  | "task"
  | "submission"
  | "artifact"
  | "review_round"
  | "review"
  | "reward_intent"
  | "settlement_batch"
  | "stake_position"
  | "authority_action";

export interface ObjectRef<TKind extends ObjectRefKind = ObjectRefKind> {
  kind: TKind;
  id: string;
  version?: Version;
}

export interface Version {
  value: string;
}

export interface Timestamp {
  iso: string;
}

export interface Hash {
  algorithm: "sha256";
  value: string;
}

export interface SchemaRef {
  uri: string;
  version?: Version;
}

export interface SignatureRef {
  algorithm: string;
  publicKey: string;
  value: string;
}

export interface ReceiptRef {
  uri: string;
  hash?: Hash;
}

export interface ArtifactRef {
  uri: string;
  hash?: Hash;
  mediaType?: string;
  schema?: SchemaRef;
}

export interface EventEnvelope<TType extends string = string, TPayload = unknown> {
  id: EventId;
  type: TType;
  version: Version;
  timestamp: Timestamp;
  actorId?: ActorId;
  causationId?: EventId;
  correlationId?: string;
  payload: TPayload;
  hash: Hash;
  signature?: SignatureRef;
}

export function makeId<T extends string>(kind: T, value = deterministicRandomSentinel): Id<T> {
  if (value !== deterministicRandomSentinel) {
    return value as Id<T>;
  }
  if (deterministicState) {
    deterministicState.idCounter += 1;
    return `${kind.toLowerCase()}_${deterministicState.seed}_${String(deterministicState.idCounter).padStart(4, "0")}` as Id<T>;
  }
  return `${kind.toLowerCase()}_${randomUUID()}` as Id<T>;
}

export function nowTimestamp(): Timestamp {
  if (deterministicState) {
    const date = new Date(deterministicState.startMs + deterministicState.timeCounter * 1000);
    deterministicState.timeCounter += 1;
    return { iso: date.toISOString() };
  }
  return { iso: new Date().toISOString() };
}

export function version(value = "1.0.0"): Version {
  return { value };
}

export function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  const source = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    const item = source[key];
    if (item !== undefined) {
      output[key] = canonicalize(item);
    }
  }
  return output;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function sha256(value: unknown): Hash {
  return {
    algorithm: "sha256",
    value: createHash("sha256").update(canonicalJson(value)).digest("hex"),
  };
}

export function hashCanonical(value: unknown): Hash {
  return sha256(value);
}

export function eventHashInput<TType extends string, TPayload>(
  event: Omit<EventEnvelope<TType, TPayload>, "hash"> | EventEnvelope<TType, TPayload>,
): Omit<EventEnvelope<TType, TPayload>, "hash" | "signature"> {
  const { hash: _hash, signature: _signature, ...hashInput } = event as EventEnvelope<TType, TPayload>;
  return hashInput;
}

export function hashEvent<TType extends string, TPayload>(
  event: Omit<EventEnvelope<TType, TPayload>, "hash"> | EventEnvelope<TType, TPayload>,
): Hash {
  return sha256(eventHashInput(event));
}

export function createEvent<TType extends string, TPayload>(input: {
  type: TType;
  payload: TPayload;
  actorId?: ActorId;
  causationId?: EventId;
  correlationId?: string;
  id?: EventId;
  timestamp?: Timestamp;
  version?: Version;
}): EventEnvelope<TType, TPayload> {
  const base: Omit<EventEnvelope<TType, TPayload>, "hash"> = {
    id: input.id ?? makeId("EventId"),
    type: input.type,
    version: input.version ?? version(),
    timestamp: input.timestamp ?? nowTimestamp(),
    payload: input.payload,
    ...(input.actorId ? { actorId: input.actorId } : {}),
    ...(input.causationId ? { causationId: input.causationId } : {}),
    ...(input.correlationId ? { correlationId: input.correlationId } : {}),
  };

  return { ...base, hash: hashEvent(base) };
}

export function assertEventHash(event: EventEnvelope<string, unknown>): void {
  const expected = hashEvent(event);
  if (event.hash.value !== expected.value) {
    throw new Error(`Invalid event hash for ${event.id}`);
  }
}

const deterministicRandomSentinel = "__concord_random__";

let deterministicState: { seed: string; idCounter: number; timeCounter: number; startMs: number } | null = null;

export function enableDeterministicMode(input: { seed?: string; startIso?: string } = {}): void {
  deterministicState = {
    seed: sanitizeSeed(input.seed ?? "det"),
    idCounter: 0,
    timeCounter: 0,
    startMs: Date.parse(input.startIso ?? "2026-01-01T00:00:00.000Z"),
  };
}

export function disableDeterministicMode(): void {
  deterministicState = null;
}

export async function withDeterministicMode<T>(
  input: { seed?: string; startIso?: string },
  callback: () => Promise<T> | T,
): Promise<T> {
  enableDeterministicMode(input);
  try {
    return await callback();
  } finally {
    disableDeterministicMode();
  }
}

function sanitizeSeed(seed: string): string {
  return seed.replace(/[^a-zA-Z0-9_-]/g, "_");
}
