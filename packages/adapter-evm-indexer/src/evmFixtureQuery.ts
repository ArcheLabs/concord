/**
 * EvmFixtureGovernanceQuery
 *
 * Implements GovernanceIndexQueryPort using hardcoded fixture proposals.
 * Designed for Phase D local development — no live EVM RPC required.
 */

import type { ChainRef } from "@concord/core";
import type {
  GovernanceIndexQueryPort,
  GovernanceSubjectRef,
  GovernanceProposalSummary,
} from "@concord/governance";
import type { ChainCheckpoint } from "@concord/chain-indexing";
import { EVM_FIXTURE_PROPOSALS } from "./fixtures.js";

export class EvmFixtureGovernanceQuery implements GovernanceIndexQueryPort {
  async getGovernanceCheckpoint(input: {
    chain: ChainRef;
  }): Promise<ChainCheckpoint | null> {
    // Fixture checkpoint at a known block height
    return {
      chain: input.chain,
      cursor: { chain: input.chain, position: "200", blockNumber: 200n },
      finalized: false,
      observedAt: new Date().toISOString(),
    };
  }

  async getGovernanceState(input: {
    chain: ChainRef;
    ref: GovernanceSubjectRef;
  }): Promise<GovernanceProposalSummary | null> {
    return (
      EVM_FIXTURE_PROPOSALS.find(
        (p) => p.ref.externalId === input.ref.externalId,
      ) ?? null
    );
  }

  async listGovernanceSubjects(input: {
    chain: ChainRef;
    limit?: number;
    cursor?: string;
  }): Promise<{ items: GovernanceProposalSummary[]; nextCursor?: string }> {
    const limit = input.limit ?? EVM_FIXTURE_PROPOSALS.length;
    const items = EVM_FIXTURE_PROPOSALS.slice(0, limit);
    return { items };
  }
}
