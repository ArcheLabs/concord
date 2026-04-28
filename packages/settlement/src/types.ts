import type {
  ActorId,
  ArtifactRef,
  FundingReceiptId,
  ObjectiveId,
  ProjectId,
  RewardIntentId,
  SettlementIntentId,
  SettlementReceiptId,
  SlashIntentId,
  Timestamp,
} from "@concord/foundation";
import type { AssetAmount } from "@concord/core";

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
