import { describe, expect, it } from "vitest";
import { SubstrateGovernanceActionsAdapter } from "./index.js";

describe("@concord/adapter-substrate-actions", () => {
  it("can be instantiated with defaults", () => {
    const adapter = new SubstrateGovernanceActionsAdapter();
    expect(adapter.kind).toBe("substrate-opengov");
  });

  it("can be instantiated with config", () => {
    const adapter = new SubstrateGovernanceActionsAdapter({
      rpcUrl: "ws://127.0.0.1:9944",
      chainId: "substrate:vibly-solo",
    });
    expect(adapter.kind).toBe("substrate-opengov");
  });

  it("prepareProposal returns structured payload without network", async () => {
    const adapter = new SubstrateGovernanceActionsAdapter();
    const chain = { namespace: "substrate" as const, chainId: "substrate:vibly-solo" };
    const result = await adapter.prepareProposal({
      chain,
      actor: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
      title: "Test proposal",
    });
    expect(result.payload).toBeDefined();
    expect(result.summary.status).toBe("draft");
  });

  it("prepareVote returns payload without network", async () => {
    const adapter = new SubstrateGovernanceActionsAdapter();
    const subject = {
      chain: { namespace: "substrate" as const, chainId: "substrate:vibly-solo" },
      backend: "substrate-opengov" as const,
      externalId: "42",
    };
    const result = await adapter.prepareVote({
      subject,
      voter: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
      stance: "aye",
      weight: "2000000000",
      metadata: { conviction: 1 },
    });
    const payload = result.payload as { type: string; pollIndex: number };
    expect(payload.type).toBe("convictionVoting.vote");
    expect(payload.pollIndex).toBe(42);
  });

  it("submitProposal throws (not implemented)", async () => {
    const adapter = new SubstrateGovernanceActionsAdapter();
    await expect(
      adapter.submitProposal({
        chain: { namespace: "substrate" as const, chainId: "substrate:vibly-solo" },
        actor: "Alice",
        payload: {},
      }),
    ).rejects.toThrow("not implemented");
  });
});
