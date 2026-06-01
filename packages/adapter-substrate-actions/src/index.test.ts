import { describe, expect, it } from "vitest";
import { SubstrateGovernanceActionsAdapter } from "./index.js";

describe("@vibly-ai/concord-adapter-substrate-actions", () => {
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

  it("submitProposal requires a signer or injected submitter", async () => {
    const adapter = new SubstrateGovernanceActionsAdapter();
    await expect(
      adapter.submitProposal({
        chain: { namespace: "substrate" as const, chainId: "substrate:vibly-solo" },
        actor: "Alice",
        payload: {},
      }),
    ).rejects.toThrow("no transaction submitter configured");
  });

  it("submitProposal delegates normalized OpenGov payload to injected submitter", async () => {
    const chain = { namespace: "substrate" as const, chainId: "substrate:vibly-solo" };
    const adapter = new SubstrateGovernanceActionsAdapter({
      submitter: async (input) => {
        expect(input.pallet).toBe("Referenda");
        expect(input.call).toBe("submit");
        expect(input.args).toEqual({ proposal: "0xproposal", enactment: "After" });
        return { txHash: "0xsubmit", chain: input.chain, finality: "included" };
      },
    });

    const receipt = await adapter.submitProposal({
      chain,
      actor: "Alice",
      payload: {
        pallet: "Referenda",
        call: "submit",
        args: { proposal: "0xproposal", enactment: "After" },
      },
    });

    expect(receipt.txHash).toBe("0xsubmit");
  });

  it("castVote delegates normalized vote payload to injected submitter", async () => {
    const subject = {
      chain: { namespace: "substrate" as const, chainId: "substrate:vibly-solo" },
      backend: "substrate-opengov" as const,
      externalId: "42",
    };
    const adapter = new SubstrateGovernanceActionsAdapter({
      submitter: async (input) => {
        expect(input.pallet).toBe("ConvictionVoting");
        expect(input.call).toBe("vote");
        expect(input.args).toMatchObject({ poll_index: 42 });
        return { txHash: "0xvote", chain: input.chain, finality: "included" };
      },
    });
    const prepared = await adapter.prepareVote({
      subject,
      voter: "Alice",
      stance: "aye",
      weight: "2000000000",
      metadata: { conviction: 1 },
    });

    const receipt = await adapter.castVote({ subject, voter: "Alice", payload: prepared.payload });

    expect(receipt.txHash).toBe("0xvote");
  });
});
