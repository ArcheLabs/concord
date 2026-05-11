import { describe, expect, it } from "vitest";
import { ActionIntentSchema, CoordinationMechanismSchema, DeterministicRandomSource, createConcord, createSQLiteConcord } from "./index.js";
import type { ConcordConfig } from "./index.js";
import type { GovernanceActionsPort } from "@concord/governance";
import type { AgentDirectoryActionsPort } from "@concord/agent-directory";
import type { TrustRegistryActionsPort } from "@concord/trust-registry";
import type { GovernanceProjectionPort } from "@concord/coordination-view";

describe("Concord facade", () => {
  it("exports v0.2 contracts from the public facade", () => {
    expect(
      ActionIntentSchema.parse({
        id: "intent_1",
        type: "SubmitProposal",
        actorId: "actor_1",
        organizationId: "org_1",
        payload: { title: "Proposal" },
        createdAt: { iso: "2026-01-01T00:00:00.000Z" },
      }).type,
    ).toBe("SubmitProposal");
    expect(
      CoordinationMechanismSchema.parse({
        id: "mechanism_1",
        organizationId: "org_1",
        name: "Claimable task",
        version: { value: "0.2.0" },
        status: "enabled",
        rules: { assignment: [{ type: "claimable", maxAssignees: 1 }] },
        createdAt: { iso: "2026-01-01T00:00:00.000Z" },
        updatedAt: { iso: "2026-01-01T00:00:00.000Z" },
      }).rules.assignment?.[0]?.type,
    ).toBe("claimable");
    expect(new DeterministicRandomSource("sdk").nextInt(10)).toBe(new DeterministicRandomSource("sdk").nextInt(10));
  });

  it("runs the MVP loop with memory adapters", async () => {
    const concord = createConcord();
    const result = await concord.loop.runOnce();

    expect(result.reviewAggregation.result).toBe("accepted");
    expect(result.eventCount).toBeGreaterThan(0);
    expect(result.knowledgeHash).toHaveLength(64);
  });

  it("runs the MVP loop with sqlite adapters", async () => {
    const concord = createSQLiteConcord(":memory:");
    const result = await concord.loop.runOnce();

    expect(result.workOrder.status).toBe("accepted");
    expect(await concord.state.projections.getLatestStateView()).toMatchObject({ id: result.stateView.id });
  });
});

describe("ConcordConfig chain-first extension", () => {
  it("createConcord accepts new optional chain-first ports without error", () => {
    const mockGovernanceActions: GovernanceActionsPort = {
      kind: "substrate-opengov",
      async prepareProposal(input) {
        return { chain: input.chain, actor: input.actor, payload: {}, summary: { ref: { chain: input.chain, backend: "substrate-opengov", externalId: "" }, status: "draft" } };
      },
      async submitProposal() { return { txHash: "0x1", chain: { namespace: "substrate", chainId: "1" }, finality: "pending" }; },
      async prepareVote(input) { return { subject: input.subject, voter: input.voter, payload: {} }; },
      async castVote() { return { txHash: "0x2", chain: { namespace: "substrate", chainId: "1" }, finality: "pending" }; },
      async delegate() { return { txHash: "0x3", chain: { namespace: "substrate", chainId: "1" }, finality: "pending" }; },
      async undelegate() { return { txHash: "0x4", chain: { namespace: "substrate", chainId: "1" }, finality: "pending" }; },
    };

    const mockAgentDirectoryActions: AgentDirectoryActionsPort = {
      kind: "eip8004-identity",
      async registerAgent() { return { txHash: "0x5", chain: { namespace: "eip155", chainId: "1" }, finality: "pending" }; },
      async updateAgentURI() { return { txHash: "0x6", chain: { namespace: "eip155", chainId: "1" }, finality: "pending" }; },
    };

    const mockTrustActions: TrustRegistryActionsPort = {
      kind: "eip8004-reputation",
      async giveFeedback() { return { txHash: "0x7", chain: { namespace: "eip155", chainId: "1" }, finality: "pending" }; },
    };

    const mockGovernanceProjection: GovernanceProjectionPort = {
      async projectGovernanceEvent() { /* noop */ },
    };

    const config: ConcordConfig = {
      governanceActions: mockGovernanceActions,
      agentDirectoryActions: mockAgentDirectoryActions,
      trustRegistryActions: mockTrustActions,
      governanceProjection: mockGovernanceProjection,
    };

    const concord = createConcord(config);
    // Existing loop remains available while the public facade moves to v0.2 contracts.
    expect(concord.actors).toBeDefined();
    expect(concord.governanceGateway).toBeDefined();
  });

  it("createConcord works without optional chain-first ports", () => {
    const concord = createConcord();
    expect(concord.actors).toBeDefined();
    expect(concord.negotiation).toBeDefined();
  });
});
