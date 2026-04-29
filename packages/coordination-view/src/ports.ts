import type { NormalizedChainEvent } from "@concord/core";

// ─── Governance Projection Port ──────────────────────────────────────────────

export interface GovernanceProjectionPort {
  projectGovernanceEvent(event: NormalizedChainEvent): Promise<void>;
}

// ─── Agent Directory Projection Port ────────────────────────────────────────

export interface AgentDirectoryProjectionPort {
  projectAgentDirectoryEvent(event: NormalizedChainEvent): Promise<void>;
}

// ─── Trust View Projection Port ──────────────────────────────────────────────

export interface TrustViewProjectionPort {
  projectTrustEvent(event: NormalizedChainEvent): Promise<void>;
}

// ─── Reputation Computation Port ─────────────────────────────────────────────

export interface ReputationComputationPort {
  recomputeForSubject(input: {
    subjectId: string;
    projectId?: string;
  }): Promise<void>;
}
