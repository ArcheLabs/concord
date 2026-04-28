import { makeId, nowTimestamp, version } from "@concord/foundation";
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
  WorkOrderId,
} from "@concord/foundation";
import type { AssetAmount } from "@concord/core";
import type {
  FundingGateway,
  FundingReceipt,
  IncentiveService,
  RewardIntent,
  RewardKind,
  RewardPolicy,
  RewardStatus,
} from "./types.js";
import { checkIncentiveInvariants } from "./invariants.js";

export class InMemoryIncentiveService implements IncentiveService {
  private policies = new Map<string, RewardPolicy>();
  private intents = new Map<string, RewardIntent>();
  private receipts = new Map<string, FundingReceipt>();

  constructor(private readonly fundingGateway?: FundingGateway) {}

  async createPolicy(policy: Omit<RewardPolicy, "id" | "createdAt">): Promise<RewardPolicy> {
    const p: RewardPolicy = {
      ...policy,
      id: makeId("RewardPolicyId"),
      version: policy.version ?? version(),
      createdAt: nowTimestamp(),
    };
    this.policies.set(p.id, p);
    return p;
  }

  async getPolicy(id: RewardPolicyId): Promise<RewardPolicy | undefined> {
    return this.policies.get(id);
  }

  async listPolicies(projectId?: ProjectId): Promise<RewardPolicy[]> {
    let results = [...this.policies.values()];
    if (projectId) results = results.filter((p) => !p.projectId || p.projectId === projectId);
    return results;
  }

  async proposeReward(
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
  ): Promise<RewardIntent> {
    const now = nowTimestamp();
    const intent: RewardIntent = {
      id: makeId("RewardIntentId"),
      projectId,
      kind,
      beneficiary,
      amount,
      reason,
      basis,
      status: "draft",
      evidence: opts?.evidence ?? [],
      createdAt: now,
      updatedAt: now,
      ...(opts?.objectiveId !== undefined && { objectiveId: opts.objectiveId }),
      ...(opts?.policyId !== undefined && { policyId: opts.policyId }),
      ...(opts?.workOrderId !== undefined && { workOrderId: opts.workOrderId }),
      ...(opts?.submissionId !== undefined && { submissionId: opts.submissionId }),
      ...(opts?.reviewRecordId !== undefined && { reviewRecordId: opts.reviewRecordId }),
    };
    this.intents.set(intent.id, intent);
    return intent;
  }

  async approveReward(id: RewardIntentId): Promise<RewardIntent> {
    const intent = this.mustGetIntent(id);
    checkIncentiveInvariants(intent, "approve");
    return this.updateIntent(id, "approved");
  }

  async rejectReward(id: RewardIntentId, _reason: string): Promise<RewardIntent> {
    const intent = this.mustGetIntent(id);
    checkIncentiveInvariants(intent, "reject");
    return this.updateIntent(id, "rejected");
  }

  async reserveFunding(id: RewardIntentId): Promise<{ intent: RewardIntent; receipt: FundingReceipt }> {
    const intent = this.mustGetIntent(id);
    checkIncentiveInvariants(intent, "reserveFunding");

    let receipt: FundingReceipt;
    if (this.fundingGateway) {
      receipt = await this.fundingGateway.reserveFunds(intent.projectId, intent.amount, intent.id);
    } else {
      // In-memory fallback
      receipt = {
        id: makeId("FundingReceiptId"),
        projectId: intent.projectId,
        amount: intent.amount,
        status: "active",
        rewardIntentId: intent.id,
        createdAt: nowTimestamp(),
      };
    }
    this.receipts.set(receipt.id, receipt);

    const updated = this.updateIntentSync(id, { status: "reserved", fundingReceiptId: receipt.id });
    return { intent: updated, receipt };
  }

  async markClaimable(id: RewardIntentId): Promise<RewardIntent> {
    return this.updateIntent(id, "claimable");
  }

  async markClaimed(id: RewardIntentId): Promise<RewardIntent> {
    return this.updateIntent(id, "claimed");
  }

  async markSettled(id: RewardIntentId, settlementIntentId: SettlementIntentId): Promise<RewardIntent> {
    return this.updateIntentSync(id, { status: "settled", settlementIntentId });
  }

  async cancelReward(id: RewardIntentId, _reason: string): Promise<RewardIntent> {
    return this.updateIntent(id, "cancelled");
  }

  async getRewardIntent(id: RewardIntentId): Promise<RewardIntent | undefined> {
    return this.intents.get(id);
  }

  async listRewardIntents(projectId: ProjectId, status?: RewardStatus): Promise<RewardIntent[]> {
    let results = [...this.intents.values()].filter((i) => i.projectId === projectId);
    if (status) results = results.filter((i) => i.status === status);
    return results;
  }

  private updateIntent(id: string, status: RewardStatus): RewardIntent {
    const intent = this.mustGetIntent(id);
    const updated: RewardIntent = { ...intent, status, updatedAt: nowTimestamp() };
    this.intents.set(id, updated);
    return updated;
  }

  private updateIntentSync(id: string, patch: Partial<RewardIntent>): RewardIntent {
    const intent = this.mustGetIntent(id);
    const updated: RewardIntent = { ...intent, ...patch, updatedAt: nowTimestamp() };
    this.intents.set(id, updated);
    return updated;
  }

  private mustGetIntent(id: string): RewardIntent {
    const i = this.intents.get(id);
    if (!i) throw new Error(`RewardIntent not found: ${id}`);
    return i;
  }
}
