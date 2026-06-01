import { z } from "zod";
import type {
  ActorId,
  MechanismId,
  MechanismInstanceId,
  MechanismVersionId,
  ObjectRef,
  OrganizationId,
  ProjectId,
  Timestamp,
  Version,
} from "@vibly-ai/concord-foundation";
import type { MechanismStatus } from "@vibly-ai/concord-core";

export type EligibilityRule =
  | { type: "skill_gte"; skill: string; min: number }
  | { type: "reputation_gte"; scope: "global" | "organization" | "project" | "skill"; min: number; skill?: string }
  | { type: "stake_gte"; asset: string; minAmount: string }
  | { type: "role_in"; roles: string[] }
  | { type: "project_member" }
  | { type: "not_penalized"; since?: Timestamp }
  | { type: "human_authorized"; permission: string };

export type AssignmentRule =
  | { type: "claimable"; maxAssignees?: number }
  | { type: "assigned"; assigneeIds: ActorId[] }
  | { type: "random_from_qualified"; count: number }
  | { type: "rotating_observer"; count: number }
  | { type: "weighted_random_by_reputation"; count: number; scope: "global" | "organization" | "project" | "skill"; skill?: string }
  | { type: "human_select"; selectorRoles: string[] };

export type ParticipationRule =
  | { type: "min_participants"; count: number }
  | { type: "max_participants"; count: number }
  | { type: "include_observer" }
  | { type: "include_proposer" }
  | { type: "contribution_required" };

export type SubmissionRule =
  | { type: "artifact_required"; minCount: number }
  | { type: "structured_result_required"; schemaRef: string }
  | { type: "no_submission_required" };

export type ReviewRule =
  | { type: "reviewer_count"; count: number }
  | { type: "reviewer_eligibility"; eligibility: EligibilityRule[] }
  | { type: "score_required"; min: number; max: number };

export type VotingRule =
  | { type: "all_active_agents" }
  | { type: "project_members" }
  | { type: "one_agent_one_vote" }
  | { type: "stake_weighted"; asset?: string }
  | { type: "reputation_weighted"; scope: "global" | "organization" | "project" | "skill"; skill?: string }
  | { type: "quorum"; minCount?: number; minPercent?: number }
  | { type: "majority_threshold"; percent: number };

export type FailureRule =
  | { type: "select_backup_assignee" }
  | { type: "mark_failed" }
  | { type: "escalate_to_guardian" };

export type TimeoutRule =
  | { type: "assignment_response_deadline"; seconds: number }
  | { type: "submit_deadline"; seconds: number }
  | { type: "discussion_deadline"; seconds: number }
  | { type: "review_deadline"; seconds: number }
  | { type: "voting_deadline"; seconds: number };

export type RewardRule =
  | { type: "fixed_reward"; asset: string; amount: string }
  | { type: "split_percent"; splits: Array<{ recipient: "assignee" | "reviewer" | "observer" | "treasury"; percent: number }> }
  | { type: "quality_multiplier"; min: number; max: number }
  | { type: "reviewer_reward"; asset: string; amount: string }
  | { type: "obligation_reward"; asset: string; amount: string }
  | { type: "no_reward" };

export type ReputationRule =
  | { type: "onAccepted"; delta: number }
  | { type: "onRejected"; delta: number }
  | { type: "onFailed"; delta: number }
  | { type: "onReviewAccurate"; delta: number }
  | { type: "onObligationMissed"; delta: number };

export interface RuleTree {
  eligibility?: EligibilityRule[];
  assignment?: AssignmentRule[];
  participation?: ParticipationRule[];
  submission?: SubmissionRule[];
  review?: ReviewRule[];
  voting?: VotingRule[];
  failure?: FailureRule[];
  timeout?: TimeoutRule[];
  reward?: RewardRule[];
  reputation?: ReputationRule[];
}

export interface CoordinationMechanism {
  id: MechanismId;
  organizationId: OrganizationId;
  projectId?: ProjectId;
  name: string;
  description?: string;
  version: Version;
  status: MechanismStatus;
  rules: RuleTree;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface MechanismTemplate {
  id: MechanismId;
  name: string;
  description?: string;
  parameterSchema?: Record<string, unknown>;
  rules: RuleTree;
}

export type MechanismParams = Record<string, string | number | boolean | string[] | number[]>;

export interface MechanismVersion {
  id: MechanismVersionId;
  mechanismId: MechanismId;
  version: Version;
  rules: RuleTree;
  publishedAt: Timestamp;
}

export interface MechanismInstance {
  id: MechanismInstanceId;
  mechanismId: MechanismId;
  versionId: MechanismVersionId;
  organizationId: OrganizationId;
  projectId?: ProjectId;
  targetRef: ObjectRef;
  params: MechanismParams;
  createdAt: Timestamp;
}

const positiveInt = z.number().int().positive();
const timestampSchema = z.object({ iso: z.string() }).strict();
const versionSchema = z.object({ value: z.string() }).strict();

export const EligibilityRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("skill_gte"), skill: z.string().min(1), min: z.number() }).strict(),
  z.object({ type: z.literal("reputation_gte"), scope: z.enum(["global", "organization", "project", "skill"]), min: z.number(), skill: z.string().min(1).optional() }).strict(),
  z.object({ type: z.literal("stake_gte"), asset: z.string().min(1), minAmount: z.string().min(1) }).strict(),
  z.object({ type: z.literal("role_in"), roles: z.array(z.string().min(1)).min(1) }).strict(),
  z.object({ type: z.literal("project_member") }).strict(),
  z.object({ type: z.literal("not_penalized"), since: timestampSchema.optional() }).strict(),
  z.object({ type: z.literal("human_authorized"), permission: z.string().min(1) }).strict(),
]);

export const AssignmentRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("claimable"), maxAssignees: positiveInt.optional() }).strict(),
  z.object({ type: z.literal("assigned"), assigneeIds: z.array(z.string().min(1)).min(1) }).strict(),
  z.object({ type: z.literal("random_from_qualified"), count: positiveInt }).strict(),
  z.object({ type: z.literal("rotating_observer"), count: positiveInt }).strict(),
  z.object({ type: z.literal("weighted_random_by_reputation"), count: positiveInt, scope: z.enum(["global", "organization", "project", "skill"]), skill: z.string().min(1).optional() }).strict(),
  z.object({ type: z.literal("human_select"), selectorRoles: z.array(z.string().min(1)).min(1) }).strict(),
]);

export const ParticipationRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("min_participants"), count: positiveInt }).strict(),
  z.object({ type: z.literal("max_participants"), count: positiveInt }).strict(),
  z.object({ type: z.literal("include_observer") }).strict(),
  z.object({ type: z.literal("include_proposer") }).strict(),
  z.object({ type: z.literal("contribution_required") }).strict(),
]);

export const SubmissionRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("artifact_required"), minCount: positiveInt }).strict(),
  z.object({ type: z.literal("structured_result_required"), schemaRef: z.string().min(1) }).strict(),
  z.object({ type: z.literal("no_submission_required") }).strict(),
]);

export const ReviewRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("reviewer_count"), count: positiveInt }).strict(),
  z.object({ type: z.literal("reviewer_eligibility"), eligibility: z.array(EligibilityRuleSchema) }).strict(),
  z.object({ type: z.literal("score_required"), min: z.number(), max: z.number() }).strict(),
]);

export const VotingRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("all_active_agents") }).strict(),
  z.object({ type: z.literal("project_members") }).strict(),
  z.object({ type: z.literal("one_agent_one_vote") }).strict(),
  z.object({ type: z.literal("stake_weighted"), asset: z.string().min(1).optional() }).strict(),
  z.object({ type: z.literal("reputation_weighted"), scope: z.enum(["global", "organization", "project", "skill"]), skill: z.string().min(1).optional() }).strict(),
  z.object({ type: z.literal("quorum"), minCount: positiveInt.optional(), minPercent: z.number().min(0).max(1).optional() }).strict(),
  z.object({ type: z.literal("majority_threshold"), percent: z.number().min(0).max(1) }).strict(),
]);

export const FailureRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("select_backup_assignee") }).strict(),
  z.object({ type: z.literal("mark_failed") }).strict(),
  z.object({ type: z.literal("escalate_to_guardian") }).strict(),
]);

export const TimeoutRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("assignment_response_deadline"), seconds: positiveInt }).strict(),
  z.object({ type: z.literal("submit_deadline"), seconds: positiveInt }).strict(),
  z.object({ type: z.literal("discussion_deadline"), seconds: positiveInt }).strict(),
  z.object({ type: z.literal("review_deadline"), seconds: positiveInt }).strict(),
  z.object({ type: z.literal("voting_deadline"), seconds: positiveInt }).strict(),
]);

export const RewardRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("fixed_reward"), asset: z.string().min(1), amount: z.string().min(1) }).strict(),
  z.object({ type: z.literal("split_percent"), splits: z.array(z.object({ recipient: z.enum(["assignee", "reviewer", "observer", "treasury"]), percent: z.number().min(0).max(100) }).strict()).min(1) }).strict(),
  z.object({ type: z.literal("quality_multiplier"), min: z.number(), max: z.number() }).strict(),
  z.object({ type: z.literal("reviewer_reward"), asset: z.string().min(1), amount: z.string().min(1) }).strict(),
  z.object({ type: z.literal("obligation_reward"), asset: z.string().min(1), amount: z.string().min(1) }).strict(),
  z.object({ type: z.literal("no_reward") }).strict(),
]);

export const ReputationRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("onAccepted"), delta: z.number() }).strict(),
  z.object({ type: z.literal("onRejected"), delta: z.number() }).strict(),
  z.object({ type: z.literal("onFailed"), delta: z.number() }).strict(),
  z.object({ type: z.literal("onReviewAccurate"), delta: z.number() }).strict(),
  z.object({ type: z.literal("onObligationMissed"), delta: z.number() }).strict(),
]);

export const RuleTreeSchema = z.object({
  eligibility: z.array(EligibilityRuleSchema).optional(),
  assignment: z.array(AssignmentRuleSchema).optional(),
  participation: z.array(ParticipationRuleSchema).optional(),
  submission: z.array(SubmissionRuleSchema).optional(),
  review: z.array(ReviewRuleSchema).optional(),
  voting: z.array(VotingRuleSchema).optional(),
  failure: z.array(FailureRuleSchema).optional(),
  timeout: z.array(TimeoutRuleSchema).optional(),
  reward: z.array(RewardRuleSchema).optional(),
  reputation: z.array(ReputationRuleSchema).optional(),
}).strict();

export const CoordinationMechanismSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  projectId: z.string().min(1).optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  version: versionSchema,
  status: z.enum(["draft", "under_review", "enabled", "disabled", "archived"]),
  rules: RuleTreeSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}).strict();
