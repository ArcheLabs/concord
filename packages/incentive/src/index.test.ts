import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryIncentiveService } from "./service.js";
import { checkIncentiveInvariants } from "./invariants.js";
import { makeId, nowTimestamp, version } from "@concord/foundation";
import type { RewardIntent, RewardPolicy } from "./types.js";

const PROJECT_ID = makeId("ProjectId", "proj_inc");
const ACTOR_A = makeId("ActorId", "actor_a");

describe("InMemoryIncentiveService", () => {
  let svc: InMemoryIncentiveService;
  beforeEach(() => { svc = new InMemoryIncentiveService(); });

  it("creates reward policy", async () => {
    const policy = await svc.createPolicy({
      trigger: "work_accepted",
      amount: { asset: "USDC", amount: "100" },
      eligibility: {},
      requiresApproval: false,
      requiresFundingReserve: false,
      version: version(),
    });
    expect(policy.id).toMatch(/^rewardpolicyid_/);
  });

  it("proposes a reward intent with draft status", async () => {
    const intent = await svc.proposeReward(
      PROJECT_ID,
      "work_reward",
      ACTOR_A,
      { asset: "USDC", amount: "100" },
      "Work completed",
      "WorkOrder#123",
    );
    expect(intent.status).toBe("draft");
    expect(intent.beneficiary).toBe(ACTOR_A);
  });

  it("approves and reserves funding", async () => {
    const intent = await svc.proposeReward(PROJECT_ID, "work_reward", ACTOR_A, { asset: "USDC", amount: "50" }, "Work done", "basis");
    const approved = await svc.approveReward(intent.id);
    expect(approved.status).toBe("approved");

    const { intent: reserved, receipt } = await svc.reserveFunding(intent.id);
    expect(reserved.status).toBe("reserved");
    expect(receipt.amount.asset).toBe("USDC");
    expect(reserved.fundingReceiptId).toBe(receipt.id);
  });

  it("marks reward claimable → claimed → settled", async () => {
    const intent = await svc.proposeReward(PROJECT_ID, "review_reward", ACTOR_A, { asset: "USDC", amount: "25" }, "Review done", "basis");
    await svc.approveReward(intent.id);
    await svc.reserveFunding(intent.id);
    const claimable = await svc.markClaimable(intent.id);
    expect(claimable.status).toBe("claimable");
    const claimed = await svc.markClaimed(intent.id);
    expect(claimed.status).toBe("claimed");
    const settlementIntentId = makeId("SettlementIntentId", "si_1");
    const settled = await svc.markSettled(intent.id, settlementIntentId);
    expect(settled.status).toBe("settled");
    expect(settled.settlementIntentId).toBe(settlementIntentId);
  });

  it("cancels a reward", async () => {
    const intent = await svc.proposeReward(PROJECT_ID, "tip", ACTOR_A, { asset: "USDC", amount: "10" }, "tip", "basis");
    const cancelled = await svc.cancelReward(intent.id, "Changed mind");
    expect(cancelled.status).toBe("cancelled");
  });

  it("rejects a reward", async () => {
    const intent = await svc.proposeReward(PROJECT_ID, "tip", ACTOR_A, { asset: "USDC", amount: "10" }, "tip", "basis");
    const rejected = await svc.rejectReward(intent.id, "Not eligible");
    expect(rejected.status).toBe("rejected");
  });

  it("lists reward intents by status", async () => {
    await svc.proposeReward(PROJECT_ID, "tip", ACTOR_A, { asset: "USDC", amount: "5" }, "tip", "basis");
    const drafts = await svc.listRewardIntents(PROJECT_ID, "draft");
    expect(drafts.length).toBeGreaterThan(0);
    expect(drafts.every((i) => i.status === "draft")).toBe(true);
  });
});

describe("checkIncentiveInvariants", () => {
  function makeIntent(status: RewardIntent["status"]): RewardIntent {
    const now = nowTimestamp();
    return {
      id: makeId("RewardIntentId"),
      projectId: PROJECT_ID,
      kind: "work_reward",
      beneficiary: ACTOR_A,
      amount: { asset: "USDC", amount: "100" },
      reason: "test",
      basis: "test",
      status,
      evidence: [],
      createdAt: now,
      updatedAt: now,
    };
  }

  it("INV-INC-1: cannot approve settled intent", () => {
    expect(() => checkIncentiveInvariants(makeIntent("settled"), "approve")).toThrow("INV-INC-1");
  });

  it("INV-INC-2: cannot reserve funding for draft", () => {
    expect(() => checkIncentiveInvariants(makeIntent("draft"), "reserveFunding")).toThrow("INV-INC-2");
  });

  it("INV-INC-4: cannot reject already rejected", () => {
    expect(() => checkIncentiveInvariants(makeIntent("rejected"), "reject")).toThrow("INV-INC-4");
  });

  it("approving draft is valid", () => {
    expect(() => checkIncentiveInvariants(makeIntent("draft"), "approve")).not.toThrow();
  });
});
