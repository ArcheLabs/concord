import type {
  ChainRef,
  TxReceipt,
  IndexCursor,
  NormalizedChainEvent,
} from "@vibly-ai/concord-core";
import type {
  AgentDirectoryBackendKind,
  AgentRegistrationRef,
  AgentRegistrationRecord,
} from "./types.js";
import type { AgentDirectoryEventType } from "./events.js";

// ─── Actions Port ────────────────────────────────────────────────────────────

export interface AgentDirectoryActionsPort {
  readonly kind: AgentDirectoryBackendKind;

  registerAgent(input: {
    chain: ChainRef;
    actor: string;
    agentURI: string;
    metadata?: Record<string, unknown>;
  }): Promise<TxReceipt>;

  updateAgentURI(input: {
    ref: AgentRegistrationRef;
    actor: string;
    agentURI: string;
  }): Promise<TxReceipt>;

  setAgentMetadata?(input: {
    ref: AgentRegistrationRef;
    actor: string;
    key: string;
    value: string | Uint8Array;
  }): Promise<TxReceipt>;

  setAgentWallet?(input: {
    ref: AgentRegistrationRef;
    actor: string;
    wallet: string;
    metadata?: Record<string, unknown>;
  }): Promise<TxReceipt>;
}

// ─── Query Port ──────────────────────────────────────────────────────────────

export interface AgentDirectoryQueryPort {
  readonly kind: AgentDirectoryBackendKind;

  getRegistration(ref: AgentRegistrationRef): Promise<AgentRegistrationRecord | null>;

  listRegistrations(input: {
    chain: ChainRef;
    owner?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{
    items: AgentRegistrationRecord[];
    nextCursor?: string;
  }>;

  resolveAgentDescriptor(ref: AgentRegistrationRef): Promise<AgentRegistrationRecord | null>;
}

// ─── Indexer Port ────────────────────────────────────────────────────────────

export interface AgentDirectoryIndexerPort {
  readonly kind: AgentDirectoryBackendKind;

  backfill(input: {
    chain: ChainRef;
    from?: IndexCursor;
    to?: IndexCursor;
  }): Promise<NormalizedChainEvent<AgentDirectoryEventType>[]>;

  subscribe(input: {
    chain: ChainRef;
    from?: IndexCursor;
  }): AsyncIterable<NormalizedChainEvent<AgentDirectoryEventType>>;

  resolveState(ref: AgentRegistrationRef): Promise<AgentRegistrationRecord | null>;
}
