import { describe, it, expect, beforeEach } from "vitest";
import { InMemorySettlementService } from "./service.js";
import { checkSettlementInvariants } from "./invariants.js";
import { makeId, nowTimestamp } from "@concord/foundation";
import type { SettlementIntent } from "./types.js";

const PROJECT_ID = makeId("ProjectId", "proj_set");
const ACTOR_A = makeId("ActorId", "actor_a");
const ACTOR_B = makeId("ActorId", "actor_b");

describe("InMemorySettlementService", () => {
  let svc: InMemorySettlementService;
  beforeEach(() => { svc = new InMemorySettlementService(); });

  it("creates a settlement intent", async () => {
    const intentId = makeId("RewardIntentId", "ri_1");
    const si = await svc.createSettlementIntent(
      PROJECT_ID,
      ACTOR_A,
      [intentId],
      { asset: "USDC", amount: "100" },
      "Work settlement",
    );
    expect(si.status).toBe("pending");
    expect(si.beneficiary).toBe(ACTOR_A);
  });

  it("processes a settlement and creates receipt", async () => {
    const si = await svc.createSettlementIntent(
      PROJECT_ID, ACTOR_A, [], { asset: "USDC", amount: "50" }, "test",
    );
    const { intent, receipt } = await svc.processSettlement(si.id);
    expect(intent.status).toBe("completed");
    expect(receipt.amount.asset).toBe("USDC");
    expect(intent.settlementReceiptId).toBe(receipt.id);
  });

  it("cannot re-process completed settlement", async () => {
    const si = await svc.createSettlementIntent(
      PROJECT_ID, ACTOR_A, [], { asset: "USDC", amount: "10" }, "test",
    );
    await svc.processSettlement(si.id);
    await expect(svc.processSettlement(si.id)).rejects.toThrow("INV-SET-1");
  });

  it("cancels a pending settlement", async () => {
    const si = await svc.createSettlementIntent(
      PROJECT_ID, ACTOR_A, [], { asset: "USDC", amount: "10" }, "test",
    );
    const cancelled = await svc.cancelSettlement(si.id, "changed mind");
    expect(cancelled.status).toBe("cancelled");
  });

  it("cannot cancel a completed settlement", async () => {
    const si = await svc.createSettlementIntent(
      PROJECT_ID, ACTOR_A, [], { asset: "USDC", amount: "10" }, "test",
    );
    await svc.processSettlement(si.id);
    await expect(svc.cancelSettlement(si.id, "late cancel")).rejects.toThrow("INV-SET-2");
  });

  it("proposes and executes a slash", async () => {
    const slash = await svc.proposeSlash(
      PROJECT_ID, ACTOR_B, { asset: "USDC", amount: "20" }, "SLA violation",
    );
    expect(slash.status).toBe("pending");
    const executed = await svc.executeSlash(slash.id);
    expect(executed.status).toBe("executed");
  });

  it("cancels a slash", async () => {
    const slash = await svc.proposeSlash(PROJECT_ID, ACTOR_B, { asset: "USDC", amount: "5" }, "test");
    const cancelled = await svc.cancelSlash(slash.id, "withdrawn");
    expect(cancelled.status).toBe("cancelled");
  });

  it("lists settlement intents by status", async () => {
    await svc.createSettlementIntent(PROJECT_ID, ACTOR_A, [], { asset: "USDC", amount: "1" }, "t1");
    await svc.createSettlementIntent(PROJECT_ID, ACTOR_A, [], { asset: "USDC", amount: "2" }, "t2");
    const pending = await svc.listSettlementIntents(PROJECT_ID, "pending");
    expect(pending.length).toBe(2);
  });
});
