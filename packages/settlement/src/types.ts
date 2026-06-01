import type {
  ActorId,
  ArtifactRef,
  ObjectRef,
  FundingReceiptId,
  ObjectiveId,
  OrganizationId,
  ProjectId,
  RewardIntentId,
  SettlementBatchId,
  SettlementIntentId,
  SettlementReceiptId,
  SlashIntentId,
  Timestamp,
} from "@vibly-ai/concord-foundation";
import type { AssetAmount } from "@vibly-ai/concord-core";

export type RewardIntentStatus = "created" | "paused" | "pending_settlement" | "submitted" | "settled" | "failed" | "cancelled";

export interface RewardIntent {
  id: RewardIntentId;
  organizationId: OrganizationId;
  projectId?: ProjectId;
  targetRef: ObjectRef;
  beneficiary: ActorId;
  amount: AssetAmount;
  status: RewardIntentStatus;
  reason: string;
  evidence: ArtifactRef[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SettlementBatch {
  id: SettlementBatchId;
  organizationId: OrganizationId;
  projectId?: ProjectId;
  rewardIntentIds: RewardIntentId[];
  status: "created" | "submitted" | "confirmed" | "failed" | "cancelled";
  settlementReceiptIds: SettlementReceiptId[];
  reason?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Settlement Intent ────────────────────────────────────────────────────────

export type SettlementStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "disputed"
  | "cancelled";

export interface SettlementIntent {
  id: SettlementIntentId;
  projectId: ProjectId;
  objectiveId?: ObjectiveId;
  rewardIntentIds: RewardIntentId[];
  fundingReceiptId?: FundingReceiptId;
  beneficiary: ActorId;
  totalAmount: AssetAmount;
  status: SettlementStatus;
  settlementReceiptId?: SettlementReceiptId;
  reason: string;
  evidence: ArtifactRef[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Settlement Receipt ───────────────────────────────────────────────────────

export interface SettlementReceipt {
  id: SettlementReceiptId;
  settlementIntentId: SettlementIntentId;
  transactionRef?: string;
  amount: AssetAmount;
  settledAt: Timestamp;
}

// ─── Slash Intent ─────────────────────────────────────────────────────────────

export type SlashStatus = "pending" | "executed" | "disputed" | "cancelled";

export interface SlashIntent {
  id: SlashIntentId;
  projectId: ProjectId;
  targetActorId: ActorId;
  stakeReceiptId?: string;
  amount: AssetAmount;
  reason: string;
  evidence: ArtifactRef[];
  status: SlashStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Service Interface ────────────────────────────────────────────────────────

export interface SettlementService {
  createSettlementIntent(
    projectId: ProjectId,
    beneficiary: ActorId,
    rewardIntentIds: RewardIntentId[],
    totalAmount: AssetAmount,
    reason: string,
    opts?: {
      objectiveId?: ObjectiveId;
      fundingReceiptId?: FundingReceiptId;
      evidence?: ArtifactRef[];
    },
  ): Promise<SettlementIntent>;

  processSettlement(id: SettlementIntentId): Promise<{ intent: SettlementIntent; receipt: SettlementReceipt }>;
  failSettlement(id: SettlementIntentId, reason: string): Promise<SettlementIntent>;
  cancelSettlement(id: SettlementIntentId, reason: string): Promise<SettlementIntent>;

  getSettlementIntent(id: SettlementIntentId): Promise<SettlementIntent | undefined>;
  listSettlementIntents(projectId: ProjectId, status?: SettlementStatus): Promise<SettlementIntent[]>;

  proposeSlash(
    projectId: ProjectId,
    targetActorId: ActorId,
    amount: AssetAmount,
    reason: string,
    opts?: {
      stakeReceiptId?: string;
      evidence?: ArtifactRef[];
    },
  ): Promise<SlashIntent>;

  executeSlash(id: SlashIntentId): Promise<SlashIntent>;
  cancelSlash(id: SlashIntentId, reason: string): Promise<SlashIntent>;
  listSlashIntents(projectId: ProjectId, status?: SlashStatus): Promise<SlashIntent[]>;
}
