import type {
  ChainRef,
  TxReceipt,
  IndexCursor,
  NormalizedChainEvent,
} from "@concord/core";
import type {
  GovernanceBackendKind,
  GovernanceSubjectRef,
  GovernanceProposalSummary,
  GovernanceVoteStance,
  GovernanceVoteReceipt,
  GovernanceDelegationState,
} from "./types.js";
import type { GovernanceEventType } from "./events.js";

// ─── Actions Port ────────────────────────────────────────────────────────────

export interface GovernanceActionsPort {
  readonly kind: GovernanceBackendKind;

  prepareProposal(input: {
    chain: ChainRef;
    actor: string;
    title: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{
    chain: ChainRef;
    actor: string;
    payload: unknown;
    summary: GovernanceProposalSummary;
  }>;

  submitProposal(input: {
    chain: ChainRef;
    actor: string;
    payload: unknown;
  }): Promise<TxReceipt>;

  prepareVote(input: {
    subject: GovernanceSubjectRef;
    voter: string;
    stance: GovernanceVoteStance;
    weight?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{
    subject: GovernanceSubjectRef;
    voter: string;
    payload: unknown;
  }>;

  castVote(input: {
    subject: GovernanceSubjectRef;
    voter: string;
    payload: unknown;
  }): Promise<TxReceipt>;

  delegate(input: {
    chain: ChainRef;
    delegator: string;
    delegatee: string;
    scope?: string;
    conviction?: string;
    metadata?: Record<string, unknown>;
  }): Promise<TxReceipt>;

  undelegate(input: {
    chain: ChainRef;
    delegator: string;
    scope?: string;
  }): Promise<TxReceipt>;

  queueExecution?(input: {
    subject: GovernanceSubjectRef;
    actor: string;
    metadata?: Record<string, unknown>;
  }): Promise<TxReceipt>;

  executeProposal?(input: {
    subject: GovernanceSubjectRef;
    actor: string;
    metadata?: Record<string, unknown>;
  }): Promise<TxReceipt>;

  unlockOrReclaim?(input: {
    chain: ChainRef;
    actor: string;
    subject?: GovernanceSubjectRef;
  }): Promise<TxReceipt>;
}

// ─── Query Port ──────────────────────────────────────────────────────────────

export interface GovernanceQueryPort {
  readonly kind: GovernanceBackendKind;

  getProposal(ref: GovernanceSubjectRef): Promise<GovernanceProposalSummary | null>;

  listOpenItems(input: {
    chain: ChainRef;
    limit?: number;
    cursor?: string;
  }): Promise<{
    items: GovernanceProposalSummary[];
    nextCursor?: string;
  }>;

  getVoteReceipt(input: {
    subject: GovernanceSubjectRef;
    voter: string;
  }): Promise<GovernanceVoteReceipt | null>;

  getDelegation(input: {
    chain: ChainRef;
    delegator: string;
    scope?: string;
  }): Promise<GovernanceDelegationState | null>;

  getTally(input: {
    subject: GovernanceSubjectRef;
  }): Promise<Record<string, unknown> | null>;

  getExecutionStatus(input: {
    subject: GovernanceSubjectRef;
  }): Promise<{
    status: string;
    metadata?: Record<string, unknown>;
  } | null>;
}

// ─── Indexer Port ────────────────────────────────────────────────────────────

export interface GovernanceIndexerPort {
  readonly kind: GovernanceBackendKind;

  backfill(input: {
    chain: ChainRef;
    from?: IndexCursor;
    to?: IndexCursor;
  }): Promise<NormalizedChainEvent<GovernanceEventType>[]>;

  subscribe(input: {
    chain: ChainRef;
    from?: IndexCursor;
  }): AsyncIterable<NormalizedChainEvent<GovernanceEventType>>;

  resolveState(input: {
    chain: ChainRef;
    ref: GovernanceSubjectRef;
  }): Promise<GovernanceProposalSummary | null>;
}
