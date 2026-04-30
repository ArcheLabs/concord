/**
 * GovernanceIndexQueryPort adapter backed by SubQuery.
 */

import type { ChainRef } from "@concord/core";
import type {
  GovernanceIndexQueryPort,
  GovernanceSubjectRef,
  GovernanceProposalSummary,
} from "@concord/governance";
import type { ChainCheckpoint } from "@concord/chain-indexing";
import { SubQueryClient } from "../subquery/client.js";
import { mapSubjectToProposalSummary, mapCheckpoint } from "./mapper.js";

export class SubQueryGovernanceQuery implements GovernanceIndexQueryPort {
  constructor(private readonly client: SubQueryClient) {}

  async getGovernanceCheckpoint(input: {
    chain: ChainRef;
  }): Promise<ChainCheckpoint | null> {
    const chainId = input.chain.chainId ?? "substrate:vibly-solo";
    const raw = await this.client.getCheckpoint(chainId);
    if (!raw) return null;
    return mapCheckpoint(raw, chainId);
  }

  async getGovernanceState(input: {
    chain: ChainRef;
    ref: GovernanceSubjectRef;
  }): Promise<GovernanceProposalSummary | null> {
    const chainId = input.chain.chainId ?? "substrate:vibly-solo";
    const id = `${chainId}:${input.ref.externalId}`;
    const raw = await this.client.getSubject(id);
    if (!raw) return null;
    return mapSubjectToProposalSummary(raw);
  }

  async listGovernanceSubjects(input: {
    chain: ChainRef;
    limit?: number;
    cursor?: string;
  }): Promise<{ items: GovernanceProposalSummary[]; nextCursor?: string }> {
    const chainId = input.chain.chainId ?? "substrate:vibly-solo";
    const page = await this.client.listSubjects({
      chainId,
      first: input.limit,
      after: input.cursor,
    });
    return {
      items: page.nodes.map(mapSubjectToProposalSummary),
      nextCursor: page.pageInfo.endCursor ?? undefined,
    };
  }
}
