import { makeId, nowTimestamp } from "@concord/foundation";
import type {
  ActorId,
  ArtifactRef,
  FundingReceiptId,
  ObjectiveId,
  ProjectId,
  RewardIntentId,
  SettlementIntentId,
  SlashIntentId,
} from "@concord/foundation";
import type { AssetAmount } from "@concord/core";
import type {
  SettlementIntent,
  SettlementReceipt,
  SettlementService,
  SettlementStatus,
  SlashIntent,
  SlashStatus,
} from "./types.js";
import { checkSettlementInvariants } from "./invariants.js";

export class InMemorySettlementService implements SettlementService {
  private intents = new Map<string, SettlementIntent>();
  private receipts = new Map<string, SettlementReceipt>();
  private slashes = new Map<string, SlashIntent>();

  async createSettlementIntent(
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
  ): Promise<SettlementIntent> {
    const now = nowTimestamp();
    const intent: SettlementIntent = {
      id: makeId("SettlementIntentId"),
      projectId,
      beneficiary,
      rewardIntentIds,
      totalAmount,
      reason,
      status: "pending",
      evidence: opts?.evidence ?? [],
      createdAt: now,
      updatedAt: now,
      ...(opts?.objectiveId !== undefined && { objectiveId: opts.objectiveId }),
      ...(opts?.fundingReceiptId !== undefined && { fundingReceiptId: opts.fundingReceiptId }),
    };
    this.intents.set(intent.id, intent);
    return intent;
  }

  async processSettlement(
    id: SettlementIntentId,
  ): Promise<{ intent: SettlementIntent; receipt: SettlementReceipt }> {
    const intent = this.mustGetIntent(id);
    checkSettlementInvariants(intent, "process");

    // Mark as processing
    const processing: SettlementIntent = { ...intent, status: "processing", updatedAt: nowTimestamp() };
    this.intents.set(id, processing);

    // Create receipt (in-memory mock execution)
    const receipt: SettlementReceipt = {
      id: makeId("SettlementReceiptId"),
      settlementIntentId: id,
      amount: intent.totalAmount,
      settledAt: nowTimestamp(),
      transactionRef: `mock-tx-${Date.now()}`,
    };
    this.receipts.set(receipt.id, receipt);

    const completed: SettlementIntent = {
      ...processing,
      status: "completed",
      settlementReceiptId: receipt.id,
      updatedAt: nowTimestamp(),
    };
    this.intents.set(id, completed);
    return { intent: completed, receipt };
  }

  async failSettlement(id: SettlementIntentId, _reason: string): Promise<SettlementIntent> {
    const intent = this.mustGetIntent(id);
    const updated: SettlementIntent = { ...intent, status: "failed", updatedAt: nowTimestamp() };
    this.intents.set(id, updated);
    return updated;
  }

  async cancelSettlement(id: SettlementIntentId, _reason: string): Promise<SettlementIntent> {
    const intent = this.mustGetIntent(id);
    checkSettlementInvariants(intent, "cancel");
    const updated: SettlementIntent = { ...intent, status: "cancelled", updatedAt: nowTimestamp() };
    this.intents.set(id, updated);
    return updated;
  }

  async getSettlementIntent(id: SettlementIntentId): Promise<SettlementIntent | undefined> {
    return this.intents.get(id);
  }

  async listSettlementIntents(projectId: ProjectId, status?: SettlementStatus): Promise<SettlementIntent[]> {
    let results = [...this.intents.values()].filter((i) => i.projectId === projectId);
    if (status) results = results.filter((i) => i.status === status);
    return results;
  }

  async proposeSlash(
    projectId: ProjectId,
    targetActorId: ActorId,
    amount: AssetAmount,
    reason: string,
    opts?: { stakeReceiptId?: string; evidence?: ArtifactRef[] },
  ): Promise<SlashIntent> {
    const now = nowTimestamp();
    const slash: SlashIntent = {
      id: makeId("SlashIntentId"),
      projectId,
      targetActorId,
      amount,
      reason,
      status: "pending",
      evidence: opts?.evidence ?? [],
      createdAt: now,
      updatedAt: now,
      ...(opts?.stakeReceiptId !== undefined && { stakeReceiptId: opts.stakeReceiptId }),
    };
    this.slashes.set(slash.id, slash);
    return slash;
  }

  async executeSlash(id: SlashIntentId): Promise<SlashIntent> {
    const slash = this.mustGetSlash(id);
    if (slash.status !== "pending") {
      throw new Error(`SlashIntent ${id} is not in pending status`);
    }
    const updated: SlashIntent = { ...slash, status: "executed", updatedAt: nowTimestamp() };
    this.slashes.set(id, updated);
    return updated;
  }

  async cancelSlash(id: SlashIntentId, _reason: string): Promise<SlashIntent> {
    const slash = this.mustGetSlash(id);
    const updated: SlashIntent = { ...slash, status: "cancelled", updatedAt: nowTimestamp() };
    this.slashes.set(id, updated);
    return updated;
  }

  async listSlashIntents(projectId: ProjectId, status?: SlashStatus): Promise<SlashIntent[]> {
    let results = [...this.slashes.values()].filter((s) => s.projectId === projectId);
    if (status) results = results.filter((s) => s.status === status);
    return results;
  }

  private mustGetIntent(id: string): SettlementIntent {
    const i = this.intents.get(id);
    if (!i) throw new Error(`SettlementIntent not found: ${id}`);
    return i;
  }

  private mustGetSlash(id: string): SlashIntent {
    const s = this.slashes.get(id);
    if (!s) throw new Error(`SlashIntent not found: ${id}`);
    return s;
  }
}
