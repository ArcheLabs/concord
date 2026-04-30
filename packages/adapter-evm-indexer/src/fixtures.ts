/**
 * Fixture EVM governance proposals for local testing and development.
 *
 * These represent the on-chain state of an OpenZeppelin Governor contract
 * deployed on a local Anvil node (chainId 31337).
 */

import type { GovernanceProposalSummary } from "@concord/governance";

const EVM_CHAIN = { namespace: "evm", chainId: "31337" } as const;

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
