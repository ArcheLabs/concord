import type { ChainRef, IndexCursor, NormalizedChainEvent } from "@vibly-ai/concord-core";

// ─── Checkpoint ──────────────────────────────────────────────────────────────

export interface ChainCheckpoint {
  chain: ChainRef;
  cursor: IndexCursor;
  finalized: boolean;
  observedAt: string;
}

// ─── Reorg Notice ────────────────────────────────────────────────────────────

export interface ReorgNotice {
  chain: ChainRef;
  revertedFrom?: IndexCursor;
  replacementFrom?: IndexCursor;
  observedAt: string;
}

// ─── Indexer Runtime ─────────────────────────────────────────────────────────

export interface IndexerRuntime<TEvent extends NormalizedChainEvent = NormalizedChainEvent> {
  backfill(input: {
    from?: IndexCursor;
    to?: IndexCursor;
  }): Promise<TEvent[]>;

  subscribe(input?: {
    from?: IndexCursor;
  }): AsyncIterable<TEvent>;

  checkpoint(): Promise<ChainCheckpoint | null>;
}
