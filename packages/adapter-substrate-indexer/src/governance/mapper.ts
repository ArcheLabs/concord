/**
 * Maps SubQuery raw entities → @concord/governance domain types.
 */

import type { GovernanceProposalSummary } from "@concord/governance";
import type { ChainCheckpoint } from "@concord/chain-indexing";
import type {
  RawGovernanceSubject,
  RawGovernanceCheckpoint,
} from "../subquery/client.js";

export function mapSubjectToProposalSummary(
  raw: RawGovernanceSubject,
): GovernanceProposalSummary {
  return {
    ref: {
      chain: {
        namespace: "substrate",
        chainId: raw.chainId,
      },
      backend: "substrate-opengov",
      externalId: String(raw.referendumIndex),
    },
    title: raw.proposalHash
      ? `Referendum #${raw.referendumIndex} (${raw.proposalHash.slice(0, 10)}…)`
      : `Referendum #${raw.referendumIndex}`,
    status: raw.status,
    createdAt: new Date(raw.submittedAt).toISOString(),
    updatedAt: new Date(raw.updatedAt).toISOString(),
    metadata: {
      track: raw.track,
      referendumIndex: raw.referendumIndex,
      proposalHash: raw.proposalHash,
      decidingSince: raw.decidingSince,
      confirmingSince: raw.confirmingSince,
      decidedAt: raw.decidedAt,
      ayeVotes: raw.ayeVotes,
      nayVotes: raw.nayVotes,
      abstainVotes: raw.abstainVotes,
      supportPct: raw.supportPct,
    },
  };
}

export function mapCheckpoint(
  raw: RawGovernanceCheckpoint,
  chainId: string,
): ChainCheckpoint {
  const chain = { namespace: "substrate" as const, chainId: raw.id };
  return {
    chain,
    cursor: {
      chain,
      position: raw.blockNumber,
      blockNumber: BigInt(raw.blockNumber),
      blockHash: raw.blockHash,
    },
    finalized: true,
    observedAt: new Date(raw.updatedAt).toISOString(),
  };
}

