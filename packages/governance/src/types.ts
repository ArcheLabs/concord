import type { ChainRef, TxReceipt } from "@concord/core";

// ─── Backend Kind ─────────────────────────────────────────────────────────────

export type GovernanceBackendKind =
  | "substrate-opengov"
  | "evm-governor"
  | "unknown";

// ─── Subject Reference ───────────────────────────────────────────────────────

export interface GovernanceSubjectRef {
  chain: ChainRef;
  backend: GovernanceBackendKind;
  externalId: string;
}

// ─── Proposal ────────────────────────────────────────────────────────────────

export interface GovernanceProposalSummary {
  ref: GovernanceSubjectRef;
  title?: string;
  description?: string;
  proposer?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

// ─── Vote ─────────────────────────────────────────────────────────────────────

export type GovernanceVoteStance =
  | "support"
  | "oppose"
  | "abstain"
  | "split"
  | "aye"
  | "nay";

export interface GovernanceVoteReceipt {
  ref: GovernanceSubjectRef;
  voter: string;
  stance: GovernanceVoteStance;
  weight?: string;
  reason?: string;
  tx?: TxReceipt;
  submittedAt?: string;
}

// ─── Delegation ───────────────────────────────────────────────────────────────

export interface GovernanceDelegationState {
  chain: ChainRef;
  delegator: string;
  delegatee: string;
  scope?: string;
  conviction?: string;
  updatedAt?: string;
}
