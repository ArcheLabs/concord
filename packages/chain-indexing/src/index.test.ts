import { describe, expect, it } from "vitest";
import type { ChainCheckpoint, ReorgNotice, IndexerRuntime } from "./index.js";
import type { NormalizedChainEvent } from "@vibly-ai/concord-core";

describe("chain-indexing exports", () => {
  it("can construct a ChainCheckpoint", () => {
    const checkpoint: ChainCheckpoint = {
      chain: { namespace: "substrate", chainId: "1" },
      cursor: { chain: { namespace: "substrate", chainId: "1" }, position: "100" },
      finalized: true,
      observedAt: new Date().toISOString(),
    };
    expect(checkpoint.finalized).toBe(true);
  });

  it("can construct a ReorgNotice", () => {
    const notice: ReorgNotice = {
      chain: { namespace: "eip155", chainId: "1" },
      observedAt: new Date().toISOString(),
    };
    expect(notice.chain.namespace).toBe("eip155");
  });

  it("IndexerRuntime is structurally correct", () => {
    const mockRuntime: IndexerRuntime<NormalizedChainEvent> = {
      async backfill() { return []; },
      async *subscribe() { /* empty */ },
      async checkpoint() { return null; },
    };
    expect(typeof mockRuntime.backfill).toBe("function");
  });
});
