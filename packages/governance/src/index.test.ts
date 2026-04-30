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
  GovernanceSubjectView,
  GovernanceVoteActivityView,
  GovernanceDelegationView,
  GovernanceCheckpointView,
  GovernanceIntentChainLink,
  GovernanceMergedView,
  GovernanceProjectionPatch,
  GovernanceProjector,
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

describe("governance view type exports", () => {
  const CHAIN = { namespace: "substrate", chainId: "vibly-solo" } as const;
  const SOURCE = { adapter: "subquery", endpoint: "http://localhost:3010/graphql" };
  const PROJECTION = { version: "1", hash: "abc", projectedAt: "2026-01-01T00:00:00Z", projector: "GovernanceProjectorService" };

  it("GovernanceSubjectView can be constructed", () => {
    const view: GovernanceSubjectView = {
      id: "substrate:vibly-solo:42",
      chain: CHAIN,
      backend: "substrate-opengov",
      externalId: "42",
      status: "Deciding",
      lifecycle: { discoveredAt: "2026-01-01T00:00:00Z" },
      finality: "finalized",
      source: SOURCE,
      projection: PROJECTION,
    };
    expect(view.backend).toBe("substrate-opengov");
    expect(view.finality).toBe("finalized");
  });

  it("GovernanceVoteActivityView can be constructed", () => {
    const view: GovernanceVoteActivityView = {
      id: "vote:42:0xabc",
      subjectId: "substrate:vibly-solo:42",
      chain: CHAIN,
      backend: "substrate-opengov",
      externalId: "42",
      voter: "0xabc",
      stance: "aye",
      conviction: "Locked1x",
      balance: "100000000",
      finality: "finalized",
      source: SOURCE,
      projection: PROJECTION,
    };
    expect(view.stance).toBe("aye");
  });

  it("GovernanceDelegationView can be constructed", () => {
    const view: GovernanceDelegationView = {
      id: "delegation:0xdelegator:0xdelegatee",
      chain: CHAIN,
      backend: "substrate-opengov",
      delegator: "0xdelegator",
      delegatee: "0xdelegatee",
      isActive: true,
      finality: "finalized",
      source: SOURCE,
      projection: PROJECTION,
    };
    expect(view.isActive).toBe(true);
  });

  it("GovernanceCheckpointView can be constructed", () => {
    const view: GovernanceCheckpointView = {
      id: "checkpoint:substrate:vibly-solo",
      chain: CHAIN,
      finalized: true,
      observedAt: "2026-01-01T00:00:00Z",
      source: SOURCE,
      projection: PROJECTION,
    };
    expect(view.finalized).toBe(true);
  });

  it("GovernanceIntentChainLink can be constructed", () => {
    const link: GovernanceIntentChainLink = {
      id: "link:intent-1:42",
      governanceIntentId: "intent-1",
      subjectId: "substrate:vibly-solo:42",
      chain: CHAIN,
      backend: "substrate-opengov",
      externalId: "42",
      linkSource: "explicit",
      confidence: "high",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    expect(link.linkSource).toBe("explicit");
  });

  it("GovernanceMergedView can be constructed with not_submitted status", () => {
    const view: GovernanceMergedView = {
      id: "merged:intent-1",
      intent: { id: "intent-1", status: "proposed" },
      status: { coordination: "proposed", merged: "not_submitted" },
      freshness: { stale: false },
    };
    expect(view.status.merged).toBe("not_submitted");
  });

  it("GovernanceProjectionPatch union covers all kinds", () => {
    const subjectPatch: GovernanceProjectionPatch = {
      kind: "subject",
      id: "s1",
      value: {
        id: "s1", chain: CHAIN, backend: "substrate-opengov", externalId: "42",
        status: "Deciding", lifecycle: {}, finality: "finalized", source: SOURCE, projection: PROJECTION,
      },
    };
    const checkpointPatch: GovernanceProjectionPatch = {
      kind: "checkpoint",
      id: "c1",
      value: {
        id: "c1", chain: CHAIN, finalized: true, observedAt: "2026-01-01T00:00:00Z",
        source: SOURCE, projection: PROJECTION,
      },
    };
    const patches: GovernanceProjectionPatch[] = [subjectPatch, checkpointPatch];
    expect(patches.map((p) => p.kind)).toEqual(["subject", "checkpoint"]);
  });

  it("GovernanceProjector interface is satisfiable", () => {
    const projector: GovernanceProjector<GovernanceEventType> = {
      project: () => [],
    };
    expect(typeof projector.project).toBe("function");
  });
});
