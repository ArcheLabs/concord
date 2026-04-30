import { describe, expect, it } from "vitest";
import type {
  GovernanceActionsPort,
  GovernanceQueryPort,
  GovernanceIndexerPort,
  GovernanceIndexFeedPort,
  GovernanceIndexQueryPort,
  ServiceChainActionsPort,
  GovernanceProposalSummary,
  GovernanceEventType,
} from "./index.js";

describe("governance exports", () => {
  it("GovernanceEventType covers expected events", () => {
    const events: GovernanceEventType[] = [
      "GovernanceProposalDiscovered",
      "GovernanceVoteCast",
      "GovernanceDelegated",
      "GovernanceExecuted",
      "GovernanceFinalityUpdated",
    ];
    expect(events.length).toBe(5);
  });

  it("GovernanceProposalSummary can be constructed", () => {
    const summary: GovernanceProposalSummary = {
      ref: {
        chain: { namespace: "substrate", chainId: "1" },
        backend: "substrate-opengov",
        externalId: "ref_42",
      },
      status: "ongoing",
    };
    expect(summary.ref.backend).toBe("substrate-opengov");
  });

  it("GovernanceActionsPort shape is satisfiable", () => {
    const port: GovernanceActionsPort = {
      kind: "substrate-opengov",
      async prepareProposal(input) {
        return {
          chain: input.chain,
          actor: input.actor,
          payload: {},
          summary: { ref: { chain: input.chain, backend: "substrate-opengov", externalId: "" }, status: "draft" },
        };
      },
      async submitProposal() {
        return { txHash: "0x1", chain: { namespace: "substrate", chainId: "1" }, finality: "pending" };
      },
      async prepareVote(input) {
        return { subject: input.subject, voter: input.voter, payload: {} };
      },
      async castVote() {
        return { txHash: "0x2", chain: { namespace: "substrate", chainId: "1" }, finality: "pending" };
      },
      async delegate() {
        return { txHash: "0x3", chain: { namespace: "substrate", chainId: "1" }, finality: "pending" };
      },
      async undelegate() {
        return { txHash: "0x4", chain: { namespace: "substrate", chainId: "1" }, finality: "pending" };
      },
    };
    expect(port.kind).toBe("substrate-opengov");
  });

  it("GovernanceQueryPort shape is satisfiable", () => {
    const port: GovernanceQueryPort = {
      kind: "evm-governor",
      async getProposal() { return null; },
      async listOpenItems() { return { items: [] }; },
      async getVoteReceipt() { return null; },
      async getDelegation() { return null; },
      async getTally() { return null; },
      async getExecutionStatus() { return null; },
    };
    expect(port.kind).toBe("evm-governor");
  });

  it("GovernanceIndexerPort shape is satisfiable", () => {
    const port: GovernanceIndexerPort = {
      kind: "substrate-opengov",
      async backfill() { return []; },
      async *subscribe() { /* empty */ },
      async resolveState() { return null; },
    };
    expect(typeof port.backfill).toBe("function");
  });

  it("GovernanceIndexFeedPort shape is satisfiable", () => {
    const port: GovernanceIndexFeedPort = {
      async *subscribeGovernanceEvents() { /* empty */ },
    };
    expect(typeof port.subscribeGovernanceEvents).toBe("function");
  });

  it("GovernanceIndexQueryPort shape is satisfiable", () => {
    const port: GovernanceIndexQueryPort = {
      async getGovernanceCheckpoint() { return null; },
      async getGovernanceState() { return null; },
      async listGovernanceSubjects() { return { items: [] }; },
    };
    expect(typeof port.listGovernanceSubjects).toBe("function");
  });

  it("ServiceChainActionsPort shape is satisfiable", () => {
    const port: ServiceChainActionsPort = {};
    expect(typeof port).toBe("object");
  });
});
