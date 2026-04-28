import type {
  ActorId,
  ArtifactRef,
  FundingReceiptId,
  ObjectiveId,
  ProjectId,
  RewardIntentId,
  RewardPolicyId,
  ReviewRecordId,
  SettlementIntentId,
  SubmissionId,
  Timestamp,
  Version,
  WorkOrderId,
} from "@concord/foundation";
import type { AssetAmount } from "@concord/core";

// ─── Reward Kind ──────────────────────────────────────────────────────────────

export type RewardKind =
  | "work_reward"
  | "observer_reward"
  | "delegate_reward"
  | "review_reward"
  | "knowledge_reward"
  | "risk_report_reward"
  | "tip"
  | "retroactive_reward";

// ─── Reward Status ────────────────────────────────────────────────────────────

export type RewardStatus =
  | "draft"
  | "reserved"
  | "approved"
  | "claimable"
  | "claimed"
  | "settled"
  | "rejected"
  | "disputed"
  | "cancelled";

// ─── Reward Intent ────────────────────────────────────────────────────────────

export interface RewardIntent {
  id: RewardIntentId;
  projectId: ProjectId;
  objectiveId?: ObjectiveId;
  kind: RewardKind;
  beneficiary: ActorId;
  amount: AssetAmount;
  reason: string;
  basis: string;
  status: RewardStatus;
  policyId?: RewardPolicyId;
  fundingReceiptId?: FundingReceiptId;
  settlementIntentId?: SettlementIntentId;
  evidence: ArtifactRef[];
  workOrderId?: WorkOrderId;
  submissionId?: SubmissionId;
  reviewRecordId?: ReviewRecordId;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Reward Policy Trigger ────────────────────────────────────────────────────

export type RewardPolicyTrigger =
  | "work_accepted"
  | "review_completed"
  | "observer_completed"
  | "delegate_voted"
  | "knowledge_committed"
  | "risk_report_valid";

// ─── Reward Policy ────────────────────────────────────────────────────────────

export interface RewardPolicyEligibility {
  minReputationScore?: number;
  requiredRoles?: string[];
}

export interface RewardPolicy {
  id: RewardPolicyId;
  projectId?: ProjectId;
  version: Version;
  trigger: RewardPolicyTrigger;
  amount: AssetAmount;
  eligibility: RewardPolicyEligibility;
  requiresApproval: boolean;
  requiresFundingReserve: boolean;
  createdAt: Timestamp;
}

// ─── Funding Receipt ──────────────────────────────────────────────────────────

export type FundingReceiptStatus = "active" | "consumed" | "released" | "expired";

export interface FundingReceipt {
  id: FundingReceiptId;
  projectId: ProjectId;
  amount: AssetAmount;
  status: FundingReceiptStatus;
  rewardIntentId?: RewardIntentId;
  createdAt: Timestamp;
}

// ─── Gateway Ports ────────────────────────────────────────────────────────────

export interface FundingGateway {
  reserveFunds(
    projectId: ProjectId,
    amount: AssetAmount,
    rewardIntentId: RewardIntentId,
  ): Promise<FundingReceipt>;

  releaseFunds(receiptId: FundingReceiptId): Promise<void>;
  getBalance(projectId: ProjectId, asset: string): Promise<string>;
}

export interface StakeGateway {
  lockStake(actorId: ActorId, projectId: ProjectId, amount: AssetAmount): Promise<string>; // stakeReceiptId
  releaseStake(stakeReceiptId: string): Promise<void>;
  slashStake(stakeReceiptId: string, amount: AssetAmount, reason: string): Promise<void>;
  getStake(actorId: ActorId, projectId: ProjectId, asset: string): Promise<string>;
}

export interface PriceGateway {
  getPrice(asset: string, denominatedIn: string): Promise<string>;
}

// ─── Service Interface ────────────────────────────────────────────────────────

export interface IncentiveService {
  createPolicy(policy: Omit<RewardPolicy, "id" | "createdAt">): Promise<RewardPolicy>;
  getPolicy(id: RewardPolicyId): Promise<RewardPolicy | undefined>;
  listPolicies(projectId?: ProjectId): Promise<RewardPolicy[]>;

  proposeReward(
    projectId: ProjectId,
    kind: RewardKind,
    beneficiary: ActorId,
    amount: AssetAmount,
    reason: string,
    basis: string,
    opts?: {
      objectiveId?: ObjectiveId;
      policyId?: RewardPolicyId;
      evidence?: ArtifactRef[];
      workOrderId?: WorkOrderId;
      submissionId?: SubmissionId;
      reviewRecordId?: ReviewRecordId;
    },
  ): Promise<RewardIntent>;

  approveReward(id: RewardIntentId): Promise<RewardIntent>;
  rejectReward(id: RewardIntentId, reason: string): Promise<RewardIntent>;
  reserveFunding(id: RewardIntentId): Promise<{ intent: RewardIntent; receipt: FundingReceipt }>;
  markClaimable(id: RewardIntentId): Promise<RewardIntent>;
  markClaimed(id: RewardIntentId): Promise<RewardIntent>;
  markSettled(id: RewardIntentId, settlementIntentId: SettlementIntentId): Promise<RewardIntent>;
  cancelReward(id: RewardIntentId, reason: string): Promise<RewardIntent>;

  getRewardIntent(id: RewardIntentId): Promise<RewardIntent | undefined>;
  listRewardIntents(projectId: ProjectId, status?: RewardStatus): Promise<RewardIntent[]>;
}
