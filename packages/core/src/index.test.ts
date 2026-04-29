import { describe, expect, it } from "vitest";
import { ActorSchema, ActionIntentSchema } from "./index.js";
import type { NormalizedChainEvent, ChainRef } from "./index.js";

describe("core schemas", () => {
  it("validates a minimal actor", () => {
    expect(() =>
      ActorSchema.parse({
        id: "actor_1",
        kind: "agent",
        identities: [{ namespace: "local", subject: "agent-1" }],
      }),
    ).not.toThrow();
  });

  it("rejects action intents without an action type", () => {
    expect(() =>
      ActionIntentSchema.parse({
        id: "action_1",
        type: "",
        proposedBy: "actor_1",
        goalId: "goal_1",
        title: "Create plan",
        description: "Create plan",
        riskLevel: "low",
        inputs: [],
      }),
    ).toThrow();
  });
});

describe("chain-first abstractions", () => {
  it("can construct a NormalizedChainEvent", () => {
    const chain: ChainRef = { namespace: "substrate", chainId: "1", network: "testnet" };
    const event: NormalizedChainEvent<"GovernanceVoteCast", { voter: string }> = {
      id: "evt_1",
      chain,
      type: "GovernanceVoteCast",
      payload: { voter: "0xabc" },
      txHash: "0xdeadbeef",
      observedAt: new Date().toISOString(),
      finality: "finalized",
    };
    expect(event.type).toBe("GovernanceVoteCast");
    expect(event.chain.namespace).toBe("substrate");
    expect(event.finality).toBe("finalized");
  });
});
