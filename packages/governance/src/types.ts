import type { ChainRef, TxReceipt } from "@concord/core";

// ─── Backend Kind ─────────────────────────────────────────────────────────────

export type GovernanceBackendKind =
  | "substrate-opengov"
  | "evm-governor"
  | "unknown";

// ─── Backend Capabilities ─────────────────────────────────────────────────────

export interface GovernanceBackendCapabilities {
  readSubjects: boolean;
  readVotes: boolean;
  readDelegations: boolean;
  checkpoint: boolean;
  prepareProposal: boolean;
  submitProposal: boolean;
  castVote: boolean;
  delegate: boolean;
  queueExecution: boolean;
  executeProposal: boolean;
  requiresWallet: boolean;
  supportsReason: boolean;
  supportsWeightedVote: boolean;
}

// ─── Backend Descriptor ───────────────────────────────────────────────────────

export type GovernanceBackendSourceKind =
  | "subquery"
  | "evm-rpc"
  | "fixture"
  | "custom";

export interface GovernanceBackendSource {
  kind: GovernanceBackendSourceKind;
  endpoint?: string;
}

export interface GovernanceBackendDescriptor {
  id: string;
  backend: GovernanceBackendKind;
  chain: ChainRef;
  displayName: string;
  source: GovernanceBackendSource;
  capabilities: GovernanceBackendCapabilities;
  metadata?: Record<string, unknown>;
}

// ─── Backend Capability Helpers ───────────────────────────────────────────────

export function defaultSubstrateCapabilities(): GovernanceBackendCapabilities {
  return {
    readSubjects: true,
    readVotes: true,
    readDelegations: true,
    checkpoint: true,
    prepareProposal: true,
    submitProposal: true,
    castVote: true,
    delegate: true,
    queueExecution: false,
    executeProposal: false,
    requiresWallet: true,
    supportsReason: true,
    supportsWeightedVote: true,
  };
}

export function defaultEvmCapabilities(): GovernanceBackendCapabilities {
  return {
    readSubjects: true,
    readVotes: true,
    readDelegations: false,
    checkpoint: true,
    prepareProposal: true,
    submitProposal: true,
    castVote: true,
    delegate: false,
    queueExecution: true,
    executeProposal: true,
    requiresWallet: true,
    supportsReason: true,
    supportsWeightedVote: false,
  };
}

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
