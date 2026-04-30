import { describe, expect, it } from "vitest";
import {
  EvmProposalState,
  mapEvmStateToStatus,
  mapSupportToStance,
  mapStanceToSupport,
} from "./evmStatusMapping.js";
import { EvmGovernanceActionsAdapter } from "./evmGovernanceActionsAdapter.js";

const EVM_CHAIN = { namespace: "eip155", chainId: "31337" } as const;
const EVM_REF = { chain: EVM_CHAIN, backend: "evm-governor" as const, externalId: "1" };

describe("evmStatusMapping — mapEvmStateToStatus", () => {
  it("maps all 8 EVM proposal states", () => {
    expect(mapEvmStateToStatus(EvmProposalState.Pending)).toBe("Submitted");
    expect(mapEvmStateToStatus(EvmProposalState.Active)).toBe("Deciding");
    expect(mapEvmStateToStatus(EvmProposalState.Canceled)).toBe("Cancelled");
    expect(mapEvmStateToStatus(EvmProposalState.Defeated)).toBe("Rejected");
    expect(mapEvmStateToStatus(EvmProposalState.Succeeded)).toBe("Confirming");
    expect(mapEvmStateToStatus(EvmProposalState.Queued)).toBe("ExecutionQueued");
    expect(mapEvmStateToStatus(EvmProposalState.Expired)).toBe("TimedOut");
    expect(mapEvmStateToStatus(EvmProposalState.Executed)).toBe("Executed");
  });

  it("returns Unknown for unrecognized state", () => {
    expect(mapEvmStateToStatus(99)).toBe("Unknown");
  });
});

describe("evmStatusMapping — mapSupportToStance", () => {
  it("0 (Against) → oppose", () => {
    expect(mapSupportToStance(0)).toBe("oppose");
  });

  it("1 (For) → support", () => {
    expect(mapSupportToStance(1)).toBe("support");
  });

  it("2 (Abstain) → abstain", () => {
    expect(mapSupportToStance(2)).toBe("abstain");
  });
});

describe("evmStatusMapping — mapStanceToSupport", () => {
  it("support / aye → 1", () => {
    expect(mapStanceToSupport("support")).toBe(1);
    expect(mapStanceToSupport("aye")).toBe(1);
  });

  it("oppose / nay → 0", () => {
    expect(mapStanceToSupport("oppose")).toBe(0);
    expect(mapStanceToSupport("nay")).toBe(0);
  });

  it("abstain / split → 2", () => {
    expect(mapStanceToSupport("abstain")).toBe(2);
    expect(mapStanceToSupport("split")).toBe(2);
  });
});

describe("EvmGovernanceActionsAdapter", () => {
  const adapter = new EvmGovernanceActionsAdapter({ chain: EVM_CHAIN });

  it("kind is evm-governor", () => {
    expect(adapter.kind).toBe("evm-governor");
  });

  it("prepareProposal returns chain + payload + summary", async () => {
    const result = await adapter.prepareProposal({
      chain: EVM_CHAIN,
      actor: "0xalice",
      title: "Test Proposal",
      description: "A test",
    });
    expect(result.chain).toEqual(EVM_CHAIN);
    expect(result.actor).toBe("0xalice");
    expect(result.summary.status).toBe("Pending");
    expect(result.summary.ref.backend).toBe("evm-governor");
    const payload = result.payload as Record<string, unknown>;
    expect(payload["description"]).toBe("A test");
  });

  it("prepareVote returns correct support value for support stance", async () => {
    const result = await adapter.prepareVote({
      subject: EVM_REF,
      voter: "0xvoter",
      stance: "support",
    });
    expect((result.payload as { support: number }).support).toBe(1);
  });

  it("prepareVote returns correct support value for oppose stance", async () => {
    const result = await adapter.prepareVote({
      subject: EVM_REF,
      voter: "0xvoter",
      stance: "oppose",
    });
    expect((result.payload as { support: number }).support).toBe(0);
  });

  it("prepareVote returns correct support value for abstain stance", async () => {
    const result = await adapter.prepareVote({
      subject: EVM_REF,
      voter: "0xvoter",
      stance: "abstain",
    });
    expect((result.payload as { support: number }).support).toBe(2);
  });

  it("castVote returns fixture receipt without throwing", async () => {
    const receipt = await adapter.castVote({
      subject: EVM_REF,
      voter: "0xvoter",
      payload: { support: 1 },
    });
    expect(receipt.finality).toBe("pending");
    expect(receipt.txHash).toMatch(/^0xfixture_castVote_/);
  });

  it("submitProposal returns fixture receipt", async () => {
    const receipt = await adapter.submitProposal({
      chain: EVM_CHAIN,
      actor: "0xalice",
      payload: {},
    });
    expect(receipt.finality).toBe("pending");
  });

  it("queueExecution returns fixture receipt", async () => {
    const receipt = await adapter.queueExecution({ subject: EVM_REF, actor: "0xalice" });
    expect(receipt.finality).toBe("pending");
  });

  it("executeProposal returns fixture receipt", async () => {
    const receipt = await adapter.executeProposal({ subject: EVM_REF, actor: "0xalice" });
    expect(receipt.finality).toBe("pending");
  });

  it("delegate throws NOT_SUPPORTED error", async () => {
    await expect(
      adapter.delegate({ chain: EVM_CHAIN, delegator: "0xa", delegatee: "0xb" })
    ).rejects.toThrow(/not supported/i);
  });

  it("undelegate throws NOT_SUPPORTED error", async () => {
    await expect(
      adapter.undelegate({ chain: EVM_CHAIN, delegator: "0xa" })
    ).rejects.toThrow(/not supported/i);
  });
});
