import type { ChainRef } from "@concord/core";
import type { GovernanceBackendKind } from "./types.js";
import type { GovernanceEventType } from "./events.js";

// ─── Projection Cursor ───────────────────────────────────────────────────────

export interface ChainProjectionCursor {
  /** Stored as string to survive JSON serialization of bigint. */
  blockNumber?: string | bigint;
  blockHash?: string;
  eventIndex?: number;
  extrinsicIndex?: number;
  position?: string;
}

// ─── Finality & Source ────────────────────────────────────────────────────────

export type ProjectionFinality =
  | "pending"
  | "included"
  | "finalized"
  | "reverted"
  | "unknown";

export interface ProjectionSource {
  adapter: string;
  endpoint?: string;
  schemaVersion?: string;
}

export interface ProjectionMetadata {
  version: string;
  hash: string;
  projectedAt: string;
  projector: string;
}

// ─── Governance Subject View ──────────────────────────────────────────────────

export interface GovernanceSubjectView {
  id: string;
  chain: ChainRef;
  backend: GovernanceBackendKind;
  externalId: string;
  title?: string;
  description?: string;
  proposer?: string;
  status: string;
  lifecycle: {
    discoveredAt?: string;
    submittedAt?: string;
    decidingSince?: string;
    confirmingSince?: string;
    decidedAt?: string;
    updatedAt?: string;
  };
  tally?: {
    aye?: string;
    nay?: string;
    abstain?: string;
    supportPct?: number;
    turnout?: number;
  };
  proposal?: {
    hash?: string;
    len?: number;
    preimageStatus?: string;
    decoded?: unknown;
  };
  chainCursor?: ChainProjectionCursor;
  finality: ProjectionFinality;
  source: ProjectionSource;
  projection: ProjectionMetadata;
  metadata?: Record<string, unknown>;
}

// ─── Vote Activity View ────────────────────────────────────────────────────────

export interface GovernanceVoteActivityView {
  id: string;
  subjectId: string;
  chain: ChainRef;
  backend: GovernanceBackendKind;
  externalId: string;
  voter: string;
  stance: string;
  conviction?: string;
  balance?: string;
  isRemoved?: boolean;
  chainCursor?: ChainProjectionCursor;
  finality: ProjectionFinality;
  source: ProjectionSource;
  projection: ProjectionMetadata;
  metadata?: Record<string, unknown>;
}

// ─── Delegation View ──────────────────────────────────────────────────────────

export interface GovernanceDelegationView {
  id: string;
  chain: ChainRef;
  backend: GovernanceBackendKind;
  scope?: string;
  delegator: string;
  delegatee: string;
  conviction?: string;
  balance?: string;
  isActive: boolean;
  chainCursor?: ChainProjectionCursor;
  finality: ProjectionFinality;
  source: ProjectionSource;
  projection: ProjectionMetadata;
  metadata?: Record<string, unknown>;
}

// ─── Checkpoint View ──────────────────────────────────────────────────────────

export interface GovernanceCheckpointView {
  id: string;
  chain: ChainRef;
  cursor?: ChainProjectionCursor;
  finalized: boolean;
  observedAt: string;
  source: ProjectionSource;
  projection: ProjectionMetadata;
}

// ─── Intent–Chain Link ────────────────────────────────────────────────────────

export type GovernanceIntentLinkSource =
  | "explicit"
  | "tx_receipt"
  | "metadata_match"
  | "manual";

export type GovernanceIntentLinkConfidence = "high" | "medium" | "low";

export interface GovernanceIntentChainLink {
  id: string;
  governanceIntentId: string;
  subjectId: string;
  chain: ChainRef;
  backend: GovernanceBackendKind;
  externalId: string;
  linkSource: GovernanceIntentLinkSource;
  confidence: GovernanceIntentLinkConfidence;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

// ─── Merged Status ────────────────────────────────────────────────────────────

export type GovernanceMergedStatus =
  | "not_submitted"
  | "active_on_chain"
  | "approved_on_chain"
  | "failed_on_chain"
  | "stale"
  | "unknown";

// ─── Merged View ──────────────────────────────────────────────────────────────

export interface GovernanceMergedView {
  id: string;
  projectId?: string;
  intent?: {
    id: string;
    title?: string;
    status?: string;
    proposedBy?: string;
    createdAt?: string;
  };
  subject?: GovernanceSubjectView;
  votes?: GovernanceVoteActivityView[];
  delegations?: GovernanceDelegationView[];
  link?: GovernanceIntentChainLink;
  status: {
    coordination?: string;
    chain?: string;
    merged: GovernanceMergedStatus;
  };
  freshness: {
    checkpoint?: GovernanceCheckpointView;
    lastIndexedAt?: string;
    stale: boolean;
    reason?: string;
  };
}

// ─── Projector Interface ──────────────────────────────────────────────────────

export type GovernanceProjectionPatch =
  | { kind: "subject"; id: string; value: GovernanceSubjectView }
  | { kind: "vote"; id: string; value: GovernanceVoteActivityView }
  | { kind: "delegation"; id: string; value: GovernanceDelegationView }
  | { kind: "checkpoint"; id: string; value: GovernanceCheckpointView }
  | { kind: "link"; id: string; value: GovernanceIntentChainLink };

export interface GovernanceProjector<TEventType extends string = GovernanceEventType> {
  project(event: import("@concord/core").NormalizedChainEvent<TEventType>): GovernanceProjectionPatch[];
}
