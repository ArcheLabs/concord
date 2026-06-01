import type { ActorId, ProjectId } from "@vibly-ai/concord-foundation";
import type { AssetAmount } from "@vibly-ai/concord-core";
import type { StakeGateway } from "@concord/incentive";
import { MockLedger } from "./mock-ledger.js";
import { makeId } from "@vibly-ai/concord-foundation";

export class MockStakeGateway implements StakeGateway {
  private stakes = new Map<string, { actorId: ActorId; projectId: ProjectId; asset: string; amount: string }>();

  constructor(private readonly ledger: MockLedger) {}

  async lockStake(actorId: ActorId, projectId: ProjectId, amount: AssetAmount): Promise<string> {
    const stakeReceiptId = makeId("StakeReceiptId");
    this.ledger.reserve(actorId, amount.asset, amount.amount, stakeReceiptId);
    this.stakes.set(stakeReceiptId, { actorId, projectId, asset: amount.asset, amount: amount.amount });
    return stakeReceiptId;
  }

  async releaseStake(stakeReceiptId: string): Promise<void> {
    const stake = this.stakes.get(stakeReceiptId);
    if (!stake) throw new Error(`StakeReceipt not found: ${stakeReceiptId}`);
    this.ledger.releaseReserve(stake.actorId, stake.asset, stake.amount, stakeReceiptId);
    this.stakes.delete(stakeReceiptId);
  }

  async slashStake(stakeReceiptId: string, amount: AssetAmount, _reason: string): Promise<void> {
    const stake = this.stakes.get(stakeReceiptId);
    if (!stake) throw new Error(`StakeReceipt not found: ${stakeReceiptId}`);
    this.ledger.claim(stake.actorId, amount.asset, amount.amount, stakeReceiptId);
  }

  async getStake(actorId: ActorId, _projectId: ProjectId, asset: string): Promise<string> {
    return this.ledger.getReserved(actorId, asset);
  }
}
