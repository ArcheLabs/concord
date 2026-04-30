import { describe, expect, it } from "vitest";
import {
  EvmFixtureGovernanceIndexAdapter,
  EvmFixtureGovernanceFeed,
  EvmFixtureGovernanceQuery,
  EVM_FIXTURE_PROPOSALS,
} from "./index.js";

const EVM_CHAIN = { namespace: "evm", chainId: "31337" } as const;

describe("EvmFixtureGovernanceIndexAdapter", () => {
  it("can be instantiated", () => {
    const adapter = new EvmFixtureGovernanceIndexAdapter();
    expect(typeof adapter.feed.subscribeGovernanceEvents).toBe("function");
    expect(typeof adapter.query.getGovernanceCheckpoint).toBe("function");
    expect(typeof adapter.query.getGovernanceState).toBe("function");
    expect(typeof adapter.query.listGovernanceSubjects).toBe("function");
  });

  it("feed implements GovernanceIndexFeedPort", () => {
    const adapter = new EvmFixtureGovernanceIndexAdapter();
    expect(adapter.feed).toBeInstanceOf(EvmFixtureGovernanceFeed);
  });

  it("query implements GovernanceIndexQueryPort", () => {
    const adapter = new EvmFixtureGovernanceIndexAdapter();
    expect(adapter.query).toBeInstanceOf(EvmFixtureGovernanceQuery);
  });
});

describe("EvmFixtureGovernanceFeed", () => {
  it("emits all fixture proposals as NormalizedChainEvent", async () => {
    const feed = new EvmFixtureGovernanceFeed();
    const events = [];
    for await (const event of feed.subscribeGovernanceEvents({ chain: EVM_CHAIN })) {
      events.push(event);
    }
    expect(events.length).toBe(EVM_FIXTURE_PROPOSALS.length);
  });

  it("all events have backend=evm-governor in payload ref", async () => {
    const feed = new EvmFixtureGovernanceFeed();
    for await (const event of feed.subscribeGovernanceEvents({ chain: EVM_CHAIN })) {
      const payload = event.payload as { ref?: { backend?: string } };
      expect(payload?.ref?.backend).toBe("evm-governor");
    }
  });

  it("events carry the correct chain", async () => {
    const feed = new EvmFixtureGovernanceFeed();
    for await (const event of feed.subscribeGovernanceEvents({ chain: EVM_CHAIN })) {
      expect(event.chain).toEqual(EVM_CHAIN);
    }
  });

  it("'Submitted' status maps to GovernanceProposalDiscovered", async () => {
    const feed = new EvmFixtureGovernanceFeed();
    const events = [];
    for await (const event of feed.subscribeGovernanceEvents({ chain: EVM_CHAIN })) {
      events.push(event);
    }
    const submitted = events.find((e) => {
      const p = e.payload as { status?: string };
      return p?.status === "Submitted";
    });
    expect(submitted?.type).toBe("GovernanceProposalDiscovered");
  });

  it("'Executed' status maps to GovernanceExecuted with finalized finality", async () => {
    const feed = new EvmFixtureGovernanceFeed();
    const events = [];
    for await (const event of feed.subscribeGovernanceEvents({ chain: EVM_CHAIN })) {
      events.push(event);
    }
    const executed = events.find((e) => e.type === "GovernanceExecuted");
    expect(executed).toBeDefined();
    expect(executed?.finality).toBe("finalized");
  });
});

describe("EvmFixtureGovernanceQuery", () => {
  it("getGovernanceCheckpoint returns a checkpoint", async () => {
    const query = new EvmFixtureGovernanceQuery();
    const checkpoint = await query.getGovernanceCheckpoint({ chain: EVM_CHAIN });
    expect(checkpoint).not.toBeNull();
    expect(checkpoint?.chain).toEqual(EVM_CHAIN);
    expect(checkpoint?.cursor.blockNumber).toBe("200");
  });

  it("getGovernanceState returns known proposal by externalId", async () => {
    const query = new EvmFixtureGovernanceQuery();
    const result = await query.getGovernanceState({
      chain: EVM_CHAIN,
      ref: { chain: EVM_CHAIN, backend: "evm-governor", externalId: "prop_evm_1" },
    });
    expect(result).not.toBeNull();
    expect(result?.ref.externalId).toBe("prop_evm_1");
    expect(result?.ref.backend).toBe("evm-governor");
  });

  it("getGovernanceState returns null for unknown externalId", async () => {
    const query = new EvmFixtureGovernanceQuery();
    const result = await query.getGovernanceState({
      chain: EVM_CHAIN,
      ref: { chain: EVM_CHAIN, backend: "evm-governor", externalId: "nonexistent" },
    });
    expect(result).toBeNull();
  });

  it("listGovernanceSubjects returns all fixture proposals", async () => {
    const query = new EvmFixtureGovernanceQuery();
    const result = await query.listGovernanceSubjects({ chain: EVM_CHAIN });
    expect(result.items.length).toBe(EVM_FIXTURE_PROPOSALS.length);
    for (const item of result.items) {
      expect(item.ref.backend).toBe("evm-governor");
    }
  });

  it("listGovernanceSubjects respects limit", async () => {
    const query = new EvmFixtureGovernanceQuery();
    const result = await query.listGovernanceSubjects({ chain: EVM_CHAIN, limit: 1 });
    expect(result.items.length).toBe(1);
  });
});

// ─── End-to-end: EVM fixture event → GovernanceProjectorService ──────────────
//
// This test verifies the full projection pipeline:
//   EvmFixtureGovernanceFeed → NormalizedChainEvent → projector → GovernanceSubjectView
//
// The projector is inlined here to avoid a dependency on vibly-coordinator.
// Phase D3 validates the data contract, not the coordinator service itself.

describe("E2E: EVM fixture event → projection", () => {
  it("feed events have the required shape for the projector", async () => {
    const feed = new EvmFixtureGovernanceFeed();
    const events = [];
    for await (const event of feed.subscribeGovernanceEvents({ chain: EVM_CHAIN })) {
      events.push(event);
    }

    for (const event of events) {
      // Every event must have id, chain, type, observedAt
      expect(event.id).toBeTruthy();
      expect(event.chain).toEqual(EVM_CHAIN);
      expect(typeof event.type).toBe("string");
      expect(event.observedAt).toBeTruthy();

      // Payload must look like a GovernanceProposalSummary
      const payload = event.payload as Record<string, unknown>;
      expect(payload).toBeDefined();
      expect(payload["ref"]).toBeDefined();
      const ref = payload["ref"] as Record<string, unknown>;
      expect(ref["externalId"]).toBeTruthy();
      expect(ref["backend"]).toBe("evm-governor");
    }
  });

  it("projector can produce a GovernanceSubjectView from EVM fixture event", async () => {
    // Inline minimal projector logic matching GovernanceProjectorService
    const feed = new EvmFixtureGovernanceFeed();
    const events = [];
    for await (const event of feed.subscribeGovernanceEvents({ chain: EVM_CHAIN })) {
      events.push(event);
    }

    const discoveredEvent = events.find(
      (e) => e.type === "GovernanceProposalDiscovered" || e.type === "GovernanceProposalUpdated",
    );
    expect(discoveredEvent).toBeDefined();

    const payload = discoveredEvent!.payload as {
      ref: { externalId: string; backend: string };
      title?: string;
      status?: string;
    };

    // Simulate what GovernanceProjectorService.project() would produce
    const subjectId = `${EVM_CHAIN.namespace}:${EVM_CHAIN.chainId}:${payload.ref.externalId}`;
    const subjectView = {
      id: subjectId,
      chain: EVM_CHAIN,
      backend: payload.ref.backend,
      externalId: payload.ref.externalId,
      title: payload.title,
      status: payload.status ?? "unknown",
    };

    expect(subjectView.backend).toBe("evm-governor");
    expect(subjectView.chain.namespace).toBe("evm");
    expect(subjectView.externalId).toBeTruthy();
  });
});
