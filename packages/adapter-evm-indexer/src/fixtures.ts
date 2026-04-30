/**
 * Fixture EVM governance proposals for local testing and development.
 *
 * These represent the on-chain state of an OpenZeppelin Governor contract
 * deployed on a local Anvil node (chainId 31337).
 */

import type { GovernanceProposalSummary, GovernanceVoteReceipt } from "@concord/governance";

const EVM_CHAIN = { namespace: "eip155", chainId: "31337" } as const;

export const EVM_FIXTURE_PROPOSALS: GovernanceProposalSummary[] = [
  {
    ref: {
      chain: EVM_CHAIN,
      backend: "evm-governor",
      externalId: "prop_evm_1",
    },
    title: "EVM Proposal #1 — Increase Quorum Threshold",
    description:
      "Increase the quorum threshold from 4% to 6% to improve governance security.",
    proposer: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    status: "Deciding",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
  {
    ref: {
      chain: EVM_CHAIN,
      backend: "evm-governor",
      externalId: "prop_evm_2",
    },
    title: "EVM Proposal #2 — Treasury Transfer",
    description:
      "Transfer 1000 tokens from the treasury to the development fund address.",
    proposer: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    status: "Submitted",
    createdAt: "2026-01-03T00:00:00.000Z",
    updatedAt: "2026-01-03T12:00:00.000Z",
  },
  {
    ref: {
      chain: EVM_CHAIN,
      backend: "evm-governor",
      externalId: "prop_evm_3",
    },
    title: "EVM Proposal #3 — Protocol Upgrade",
    description:
      "Upgrade the core protocol contract to v2.1.0 with improved gas efficiency.",
    proposer: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    status: "Executed",
    createdAt: "2025-12-01T00:00:00.000Z",
    updatedAt: "2025-12-15T00:00:00.000Z",
  },
];

export interface EvmFixtureVote {
  proposalExternalId: string;
  voter: string;
  support: 0 | 1 | 2;
  weight: string;
  reason?: string;
  submittedAt: string;
}

export type EvmFixtureVoteReceipt = GovernanceVoteReceipt & {
  metadata: {
    evmSupport: 0 | 1 | 2;
    proposalId: string;
  };
};

export const EVM_FIXTURE_VOTES: EvmFixtureVote[] = [
  {
    proposalExternalId: "prop_evm_1",
    voter: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    support: 1,
    weight: "120000000000000000000",
    reason: "Increase quorum improves governance safety.",
    submittedAt: "2026-01-02T01:00:00.000Z",
  },
  {
    proposalExternalId: "prop_evm_1",
    voter: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    support: 0,
    weight: "45000000000000000000",
    reason: "Higher quorum may slow down execution.",
    submittedAt: "2026-01-02T02:00:00.000Z",
  },
  {
    proposalExternalId: "prop_evm_2",
    voter: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    support: 2,
    weight: "30000000000000000000",
    submittedAt: "2026-01-03T13:00:00.000Z",
  },
];

export function toEvmFixtureVoteReceipt(vote: EvmFixtureVote): EvmFixtureVoteReceipt {
  const receipt: EvmFixtureVoteReceipt = {
    ref: {
      chain: EVM_CHAIN,
      backend: "evm-governor",
      externalId: vote.proposalExternalId,
    },
    voter: vote.voter,
    stance: mapSupportToStance(vote.support),
    weight: vote.weight,
    submittedAt: vote.submittedAt,
    metadata: {
      evmSupport: vote.support,
      proposalId: vote.proposalExternalId,
    },
  };
  if (vote.reason !== undefined) receipt.reason = vote.reason;
  return receipt;
}

function mapSupportToStance(support: 0 | 1 | 2): EvmFixtureVoteReceipt["stance"] {
  switch (support) {
    case 0:
      return "oppose";
    case 1:
      return "support";
    case 2:
      return "abstain";
  }
}
