/**
 * GovernanceIndexQueryPort adapter backed by SubQuery.
 */

import type { ChainRef } from "@vibly-ai/concord-core";
import type {
  GovernanceIndexQueryPort,
  GovernanceSubjectRef,
  GovernanceProposalSummary,
} from "@vibly-ai/concord-governance";
import type { ChainCheckpoint } from "@vibly-ai/concord-chain-indexing";
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
    const query: { chainId: string; first?: number; after?: string } = { chainId };
    if (input.limit !== undefined) query.first = input.limit;
    if (input.cursor !== undefined) query.after = input.cursor;
    const page = await this.client.listSubjects(query);
    const result: { items: GovernanceProposalSummary[]; nextCursor?: string } = {
      items: page.nodes.map(mapSubjectToProposalSummary),
    };
    if (page.pageInfo.endCursor !== undefined && page.pageInfo.endCursor !== null) {
      result.nextCursor = page.pageInfo.endCursor;
    }
    return result;
  }
}
