import { makeId, nowTimestamp } from "@concord/foundation";
import type { ProjectId, RewardIntentId, FundingReceiptId } from "@concord/foundation";
import type { AssetAmount } from "@concord/core";
import type { FundingGateway, FundingReceipt } from "@concord/incentive";
import { MockLedger } from "./mock-ledger.js";

export class MockFundingGateway implements FundingGateway {
  private receipts = new Map<string, FundingReceipt>();

  constructor(
    private readonly ledger: MockLedger,
    /** Pre-funded project owners mapping projectId → initial USDC balance */
    private readonly initialFunding?: Record<string, { asset: string; amount: string }>,
  ) {
    if (initialFunding) {
      for (const [projectId, { asset, amount }] of Object.entries(initialFunding)) {
        ledger.credit(projectId as ProjectId, asset, amount, "initial_funding");
      }
    }
  }

  async reserveFunds(
    projectId: ProjectId,
    amount: AssetAmount,
    rewardIntentId: RewardIntentId,
  ): Promise<FundingReceipt> {
    this.ledger.reserve(projectId, amount.asset, amount.amount, rewardIntentId);
    const receipt: FundingReceipt = {
      id: makeId("FundingReceiptId"),
      projectId,
      amount,
      status: "active",
      rewardIntentId,
      createdAt: nowTimestamp(),
    };
    this.receipts.set(receipt.id, receipt);
    return receipt;
  }

  async releaseFunds(receiptId: FundingReceiptId): Promise<void> {
    const receipt = this.receipts.get(receiptId);
    if (!receipt) throw new Error(`FundingReceipt not found: ${receiptId}`);
    this.ledger.releaseReserve(receipt.projectId, receipt.amount.asset, receipt.amount.amount, receiptId);
    const updated: FundingReceipt = { ...receipt, status: "released" };
    this.receipts.set(receiptId, updated);
  }

  async getBalance(projectId: ProjectId, asset: string): Promise<string> {
    return this.ledger.getBalance(projectId, asset);
  }
}
