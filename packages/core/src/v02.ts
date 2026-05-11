import { z } from "zod";
import type {
  ActionIntentId,
  ActorId,
  ArtifactId,
  ArtifactRef,
  AssignmentOfferId,
  DiscussionOutcomeId,
  DiscussionRoundId,
  DiscussionThreadId,
  EventId,
  HumanPrincipalId,
  MechanismId,
  MechanismInstanceId,
  MechanismVersionId,
  ObjectRef,
  ObservationId,
  ObservationTaskId,
  OrganizationId,
  PrincipalId,
  ProductId,
  ProjectId,
  ProposalId,
  ReviewId,
  ReviewRoundId,
  RewardIntentId,
  SettlementBatchId,
  StakePositionId,
  SubmissionId,
  TaskId,
  Timestamp,
  Version,
  VotingRoundId,
} from "@concord/foundation";

export const organizationStatuses = ["draft", "active", "paused", "archived"] as const;
export type OrganizationStatus = (typeof organizationStatuses)[number];

export const projectStatuses = ["draft", "active", "paused", "stopped", "archived"] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

export const observationTaskStatuses = ["created", "offered", "assigned", "submitted", "completed", "timed_out", "cancelled"] as const;
export type ObservationTaskStatus = (typeof observationTaskStatuses)[number];

export const assignmentOfferStatuses = ["pending", "accepted", "declined", "timed_out", "cancelled"] as const;
export type AssignmentOfferStatus = (typeof assignmentOfferStatuses)[number];

export const observationStatuses = ["submitted", "discussing", "converted_to_proposal", "knowledge_updated", "closed", "archived"] as const;
export type ObservationStatus = (typeof observationStatuses)[number];

export const discussionRoundStatuses = ["created", "active", "completed", "timed_out", "cancelled"] as const;
export type DiscussionRoundStatus = (typeof discussionRoundStatuses)[number];

export const votingRoundStatuses = ["created", "active", "completed", "failed_quorum", "cancelled"] as const;
export type VotingRoundStatus = (typeof votingRoundStatuses)[number];

export const proposalStatuses = ["submitted", "under_review", "voting", "accepted", "rejected", "vetoed", "archived"] as const;
export type ProposalStatus = (typeof proposalStatuses)[number];

export const taskStatuses = ["draft", "open", "assigned", "active", "submitted", "under_review", "completed", "failed", "cancelled"] as const;
export type TaskStatus = (typeof taskStatuses)[number];

export const artifactStatuses = ["submitted", "under_review", "accepted", "rejected", "merged"] as const;
export type ArtifactStatus = (typeof artifactStatuses)[number];

export const rewardIntentStatuses = ["created", "paused", "pending_settlement", "submitted", "settled", "failed", "cancelled"] as const;
export type RewardIntentStatus = (typeof rewardIntentStatuses)[number];

export const mechanismStatuses = ["draft", "under_review", "enabled", "disabled", "archived"] as const;
export type MechanismStatus = (typeof mechanismStatuses)[number];

export type DiscussionOutcomeKind =
  | "no_action_needed"
  | "proposal_created"
  | "knowledge_updated"
  | "request_created"
  | "reobserve_later"
  | "archived";

export interface Organization {
  id: OrganizationId;
  name: string;
  mission?: string;
  vision?: string;
  values?: string[];
  status: OrganizationStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Product {
  id: ProductId;
  organizationId: OrganizationId;
  projectId?: ProjectId;
  name: string;
  description?: string;
  status: "draft" | "active" | "retired" | "archived";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Handbook {
  id: string;
  scope: ObjectRef<"organization" | "project">;
  version: Version;
  title: string;
  body: string;
  artifact?: ArtifactRef;
  publishedBy: PrincipalId | HumanPrincipalId;
  publishedAt: Timestamp;
}

export interface ObservationTask {
  id: ObservationTaskId;
  organizationId: OrganizationId;
  projectId?: ProjectId;
  targetRef?: ObjectRef;
  mechanismRef: ObjectRef<"mechanism">;
  title: string;
  description: string;
  status: ObservationTaskStatus;
  createdAt: Timestamp;
  deadline?: Timestamp;
}

export interface Observation {
  id: ObservationId;
  organizationId: OrganizationId;
  projectId?: ProjectId;
  sourceTaskId?: ObservationTaskId;
  targetRef?: ObjectRef;
  submittedBy: ActorId;
  summary: string;
  evidence: ArtifactRef[];
  status: ObservationStatus;
  submittedAt: Timestamp;
}

export interface AssignmentOffer {
  id: AssignmentOfferId;
  organizationId: OrganizationId;
  projectId?: ProjectId;
  targetRef: ObjectRef;
  offeredTo: ActorId;
  mechanismInstanceId?: MechanismInstanceId;
  status: AssignmentOfferStatus;
  offeredAt: Timestamp;
  responseDeadline?: Timestamp;
}

export interface AssignmentTimeout {
  offerId: AssignmentOfferId;
  targetRef: ObjectRef;
  timedOutAt: Timestamp;
  replacementRequired: boolean;
}

export interface DiscussionThread {
  id: DiscussionThreadId;
  organizationId: OrganizationId;
  projectId?: ProjectId;
  subjectRef: ObjectRef;
  status: "open" | "closed" | "archived";
  createdAt: Timestamp;
  closedAt?: Timestamp;
}

export interface Comment {
  id: string;
  threadId: DiscussionThreadId;
  authorId: ActorId;
  body: string;
  evidence: ArtifactRef[];
  createdAt: Timestamp;
}

export interface DiscussionRound {
  id: DiscussionRoundId;
  threadId: DiscussionThreadId;
  organizationId: OrganizationId;
  projectId?: ProjectId;
  subjectRef: ObjectRef;
  participants: ActorId[];
  status: DiscussionRoundStatus;
  openedAt: Timestamp;
  deadline?: Timestamp;
  closedAt?: Timestamp;
}

export interface DiscussionOutcome {
  id: DiscussionOutcomeId;
  threadId: DiscussionThreadId;
  roundId?: DiscussionRoundId;
  outcome: DiscussionOutcomeKind;
  summary: string;
  outputRefs: ObjectRef[];
  recordedBy: ActorId;
  recordedAt: Timestamp;
}

export interface Proposal {
  id: ProposalId;
  organizationId: OrganizationId;
  projectId?: ProjectId;
  sourceRef?: ObjectRef;
  title: string;
  body: string;
  status: ProposalStatus;
  submittedBy: ActorId;
  submittedAt: Timestamp;
}

export interface VotingRound {
  id: VotingRoundId;
  organizationId: OrganizationId;
  projectId?: ProjectId;
  subjectRef: ObjectRef;
  eligibleVoters: ActorId[];
  status: VotingRoundStatus;
  openedAt: Timestamp;
  deadline?: Timestamp;
  completedAt?: Timestamp;
}

export interface TaskPlan {
  proposalId?: ProposalId;
  tasks: Task[];
  createdAt: Timestamp;
}

export interface Task {
  id: TaskId;
  organizationId: OrganizationId;
  projectId?: ProjectId;
  proposalRef?: ObjectRef<"proposal">;
  mechanismRef: ObjectRef<"mechanism">;
  title: string;
  description: string;
  requiredOutputs: string[];
  acceptanceCriteria: string[];
  status: TaskStatus;
  deadline?: Timestamp;
}

export interface Artifact {
  id: ArtifactId;
  organizationId: OrganizationId;
  projectId?: ProjectId;
  sourceRef?: ObjectRef;
  ref: ArtifactRef;
  status: ArtifactStatus;
  submittedBy: ActorId;
  submittedAt: Timestamp;
}

export interface ReviewRound {
  id: ReviewRoundId;
  organizationId: OrganizationId;
  projectId?: ProjectId;
  targetRef: ObjectRef;
  reviewers: ActorId[];
  status: "created" | "active" | "completed" | "timed_out" | "cancelled";
  openedAt: Timestamp;
  deadline?: Timestamp;
  completedAt?: Timestamp;
}

export interface Review {
  id: ReviewId;
  roundId?: ReviewRoundId;
  targetRef: ObjectRef;
  reviewerId: ActorId;
  decision: "accept" | "reject" | "needs_revision" | "escalate";
  score?: number;
  rationale: string;
  evidence: ArtifactRef[];
  createdAt: Timestamp;
}

export interface RewardIntent {
  id: RewardIntentId;
  organizationId: OrganizationId;
  projectId?: ProjectId;
  targetRef: ObjectRef;
  beneficiary: ActorId;
  amount: { asset: string; amount: string };
  status: RewardIntentStatus;
  createdAt: Timestamp;
}

export interface SettlementBatch {
  id: SettlementBatchId;
  organizationId: OrganizationId;
  rewardIntentIds: RewardIntentId[];
  status: "created" | "submitted" | "confirmed" | "failed" | "cancelled";
  createdAt: Timestamp;
}

export interface StakePosition {
  id: StakePositionId;
  organizationId: OrganizationId;
  actorId: ActorId;
  amount: { asset: string; amount: string };
  status: "active" | "locked" | "slashed" | "released";
  updatedAt: Timestamp;
}

export type ActionIntentType =
  | "CreateOrganization"
  | "PublishOrganizationHandbook"
  | "CreateProject"
  | "PublishProjectHandbook"
  | "ProposeMechanism"
  | "EnableMechanism"
  | "CreateObservationTask"
  | "RespondAssignmentOffer"
  | "SubmitObservationResult"
  | "CreateObservation"
  | "StartDiscussion"
  | "CreateDiscussionRound"
  | "AddComment"
  | "CloseDiscussionWithOutcome"
  | "SubmitProposal"
  | "ReviseProposal"
  | "SubmitReview"
  | "CreateVotingRound"
  | "SubmitVote"
  | "VetoProposal"
  | "CreateTask"
  | "ClaimTask"
  | "AssignTask"
  | "SubmitTask"
  | "SubmitArtifact"
  | "CreateRewardIntent"
  | "SubmitSettlementBatch";

export interface ActionIntent<TType extends ActionIntentType = ActionIntentType, TPayload = Record<string, unknown>> {
  id: ActionIntentId;
  type: TType;
  actorId: ActorId;
  organizationId?: OrganizationId;
  projectId?: ProjectId;
  targetRef?: ObjectRef;
  idempotencyKey?: string;
  payload: TPayload;
  createdAt: Timestamp;
}

export type DomainEventType =
  | "OrganizationCreated"
  | "OrganizationHandbookPublished"
  | "ProjectCreated"
  | "ProjectHandbookPublished"
  | "MechanismProposed"
  | "MechanismEnabled"
  | "ObservationTaskCreated"
  | "ObserverSelected"
  | "AssignmentOffered"
  | "AssignmentAccepted"
  | "AssignmentDeclined"
  | "AssignmentTimedOut"
  | "BackupAssigneeSelected"
  | "ObservationSubmitted"
  | "ObservationCreated"
  | "DiscussionStarted"
  | "DiscussionRoundCreated"
  | "DiscussionParticipantSelected"
  | "CommentAdded"
  | "DiscussionOutcomeRecorded"
  | "DiscussionClosed"
  | "ProposalSubmitted"
  | "ProposalRevised"
  | "ProposalAccepted"
  | "ProposalRejected"
  | "ProposalVetoed"
  | "VotingRoundCreated"
  | "VoteRequested"
  | "VoteSubmitted"
  | "VotingRoundCompleted"
  | "TaskCreated"
  | "TaskClaimed"
  | "TaskAssigned"
  | "TaskSubmitted"
  | "ArtifactSubmitted"
  | "ReviewSubmitted"
  | "RewardIntentCreated"
  | "SettlementBatchSubmitted";

export interface DomainEvent<TType extends DomainEventType = DomainEventType, TPayload = Record<string, unknown>> {
  id: EventId;
  type: TType;
  aggregateRef: ObjectRef;
  objectRefs: ObjectRef[];
  actorId?: ActorId;
  organizationId?: OrganizationId;
  projectId?: ProjectId;
  causationId?: EventId | ActionIntentId;
  correlationId?: string;
  payload: TPayload;
  createdAt: Timestamp;
  schemaVersion: Version;
}

const timestampSchema = z.object({ iso: z.string() });
const versionSchema = z.object({ value: z.string() });

export const ObjectRefSchema = z.object({
  kind: z.enum([
    "organization",
    "project",
    "product",
    "handbook",
    "mechanism",
    "observation_task",
    "observation",
    "assignment_offer",
    "discussion_thread",
    "discussion_round",
    "discussion_outcome",
    "proposal",
    "voting_round",
    "task",
    "submission",
    "artifact",
    "review_round",
    "review",
    "reward_intent",
    "settlement_batch",
    "stake_position",
    "authority_action",
  ]),
  id: z.string().min(1),
  version: versionSchema.optional(),
});

const baseIntentSchema = z.object({
  id: z.string().min(1),
  actorId: z.string().min(1),
  organizationId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  targetRef: ObjectRefSchema.optional(),
  idempotencyKey: z.string().min(1).optional(),
  payload: z.record(z.unknown()).default({}),
  createdAt: timestampSchema,
}).strict();

function intentSchema<T extends ActionIntentType>(type: T) {
  return baseIntentSchema.extend({ type: z.literal(type) });
}

export const ActionIntentSchema = z.discriminatedUnion("type", [
  intentSchema("CreateOrganization"),
  intentSchema("PublishOrganizationHandbook"),
  intentSchema("CreateProject"),
  intentSchema("PublishProjectHandbook"),
  intentSchema("ProposeMechanism"),
  intentSchema("EnableMechanism"),
  intentSchema("CreateObservationTask"),
  intentSchema("RespondAssignmentOffer"),
  intentSchema("SubmitObservationResult"),
  intentSchema("CreateObservation"),
  intentSchema("StartDiscussion"),
  intentSchema("CreateDiscussionRound"),
  intentSchema("AddComment"),
  intentSchema("CloseDiscussionWithOutcome"),
  intentSchema("SubmitProposal"),
  intentSchema("ReviseProposal"),
  intentSchema("SubmitReview"),
  intentSchema("CreateVotingRound"),
  intentSchema("SubmitVote"),
  intentSchema("VetoProposal"),
  intentSchema("CreateTask"),
  intentSchema("ClaimTask"),
  intentSchema("AssignTask"),
  intentSchema("SubmitTask"),
  intentSchema("SubmitArtifact"),
  intentSchema("CreateRewardIntent"),
  intentSchema("SubmitSettlementBatch"),
]);

const baseEventSchema = z.object({
  id: z.string().min(1),
  aggregateRef: ObjectRefSchema,
  objectRefs: z.array(ObjectRefSchema).default([]),
  actorId: z.string().min(1).optional(),
  organizationId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  causationId: z.string().min(1).optional(),
  correlationId: z.string().min(1).optional(),
  payload: z.record(z.unknown()).default({}),
  createdAt: timestampSchema,
  schemaVersion: versionSchema,
}).strict();

function eventSchema<T extends DomainEventType>(type: T) {
  return baseEventSchema.extend({ type: z.literal(type) });
}

export const DomainEventSchema = z.discriminatedUnion("type", [
  eventSchema("OrganizationCreated"),
  eventSchema("OrganizationHandbookPublished"),
  eventSchema("ProjectCreated"),
  eventSchema("ProjectHandbookPublished"),
  eventSchema("MechanismProposed"),
  eventSchema("MechanismEnabled"),
  eventSchema("ObservationTaskCreated"),
  eventSchema("ObserverSelected"),
  eventSchema("AssignmentOffered"),
  eventSchema("AssignmentAccepted"),
  eventSchema("AssignmentDeclined"),
  eventSchema("AssignmentTimedOut"),
  eventSchema("BackupAssigneeSelected"),
  eventSchema("ObservationSubmitted"),
  eventSchema("ObservationCreated"),
  eventSchema("DiscussionStarted"),
  eventSchema("DiscussionRoundCreated"),
  eventSchema("DiscussionParticipantSelected"),
  eventSchema("CommentAdded"),
  eventSchema("DiscussionOutcomeRecorded"),
  eventSchema("DiscussionClosed"),
  eventSchema("ProposalSubmitted"),
  eventSchema("ProposalRevised"),
  eventSchema("ProposalAccepted"),
  eventSchema("ProposalRejected"),
  eventSchema("ProposalVetoed"),
  eventSchema("VotingRoundCreated"),
  eventSchema("VoteRequested"),
  eventSchema("VoteSubmitted"),
  eventSchema("VotingRoundCompleted"),
  eventSchema("TaskCreated"),
  eventSchema("TaskClaimed"),
  eventSchema("TaskAssigned"),
  eventSchema("TaskSubmitted"),
  eventSchema("ArtifactSubmitted"),
  eventSchema("ReviewSubmitted"),
  eventSchema("RewardIntentCreated"),
  eventSchema("SettlementBatchSubmitted"),
]);

export const StateEnumSchemas = {
  organization: z.enum(organizationStatuses),
  project: z.enum(projectStatuses),
  observationTask: z.enum(observationTaskStatuses),
  assignmentOffer: z.enum(assignmentOfferStatuses),
  observation: z.enum(observationStatuses),
  discussionRound: z.enum(discussionRoundStatuses),
  votingRound: z.enum(votingRoundStatuses),
  proposal: z.enum(proposalStatuses),
  task: z.enum(taskStatuses),
  artifact: z.enum(artifactStatuses),
  rewardIntent: z.enum(rewardIntentStatuses),
  mechanism: z.enum(mechanismStatuses),
};

export interface MechanismRef {
  mechanismId: MechanismId;
  versionId?: MechanismVersionId;
  instanceId?: MechanismInstanceId;
}
