import { describe, it, expect, beforeEach } from "vitest";
import { MockLedger } from "./mock-ledger.js";
import { MockFundingGateway } from "./mock-funding-gateway.js";
import { MockStakeGateway } from "./mock-stake-gateway.js";
import { MockPriceGateway } from "./mock-price-gateway.js";
import { makeId } from "@vibly-ai/concord-foundation";

const PROJECT_ID = makeId("ProjectId", "proj_mock");
const ACTOR_A = makeId("ActorId", "actor_a");

describe("MockLedger", () => {
  let ledger: MockLedger;
  beforeEach(() => { ledger = new MockLedger(); });

  it("credits balance", () => {
    ledger.credit(ACTOR_A, "USDC", "1000");
    expect(ledger.getBalance(ACTOR_A, "USDC")).toBe("1000");
  });

  it("debits balance", () => {
    ledger.credit(ACTOR_A, "USDC", "1000");
    ledger.debit(ACTOR_A, "USDC", "400");
    expect(ledger.getBalance(ACTOR_A, "USDC")).toBe("600");
  });

  it("throws on insufficient balance debit", () => {
    ledger.credit(ACTOR_A, "USDC", "100");
    expect(() => ledger.debit(ACTOR_A, "USDC", "200")).toThrow("Insufficient balance");
  });

  it("reserves and releases funds", () => {
    ledger.credit(PROJECT_ID, "USDC", "500");
    ledger.reserve(PROJECT_ID, "USDC", "200");
    expect(ledger.getReserved(PROJECT_ID, "USDC")).toBe("200");
    ledger.releaseReserve(PROJECT_ID, "USDC", "200");
    expect(ledger.getReserved(PROJECT_ID, "USDC")).toBe("0");
  });

  it("throws on over-reserve", () => {
    ledger.credit(PROJECT_ID, "USDC", "100");
    expect(() => ledger.reserve(PROJECT_ID, "USDC", "200")).toThrow("Insufficient available balance");
  });
});

describe("MockFundingGateway", () => {
  it("reserves and gets balance", async () => {
    const ledger = new MockLedger();
    const gw = new MockFundingGateway(ledger, { [PROJECT_ID]: { asset: "USDC", amount: "1000" } });

    expect(await gw.getBalance(PROJECT_ID, "USDC")).toBe("1000");

    const intentId = makeId("RewardIntentId", "ri_1");
    const receipt = await gw.reserveFunds(PROJECT_ID, { asset: "USDC", amount: "300" }, intentId);
    expect(receipt.status).toBe("active");

    await gw.releaseFunds(receipt.id);
    expect(ledger.getReserved(PROJECT_ID, "USDC")).toBe("0");
  });
});

describe("MockStakeGateway", () => {
  it("locks, gets, and releases stake", async () => {
    const ledger = new MockLedger();
    ledger.credit(ACTOR_A, "USDC", "1000");
    const gw = new MockStakeGateway(ledger);

    const stakeId = await gw.lockStake(ACTOR_A, PROJECT_ID, { asset: "USDC", amount: "500" });
    expect(stakeId).toMatch(/^stakereceiptid_/);
    expect(await gw.getStake(ACTOR_A, PROJECT_ID, "USDC")).toBe("500");

    await gw.releaseStake(stakeId);
    expect(await gw.getStake(ACTOR_A, PROJECT_ID, "USDC")).toBe("0");
  });
});

describe("MockPriceGateway", () => {
  it("returns configured prices", async () => {
    const gw = new MockPriceGateway();
    expect(await gw.getPrice("USDC", "USD")).toBe("1");
    expect(await gw.getPrice("ETH", "USD")).toBe("3000");
    expect(await gw.getPrice("UNKNOWN", "USD")).toBe("0");
  });
});
