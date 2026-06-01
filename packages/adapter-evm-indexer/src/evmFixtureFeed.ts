/**
 * EvmFixtureGovernanceFeed
 *
 * Implements GovernanceIndexFeedPort using hardcoded fixture proposals.
 * Designed for Phase D local development — no live EVM RPC required.
 *
 * Phase E+: Replace with a real eth_getLogs / WebSocket subscription.
 */

import type { ChainRef, IndexCursor, NormalizedChainEvent } from "@vibly-ai/concord-core";
import type { GovernanceIndexFeedPort, GovernanceEventType } from "@vibly-ai/concord-governance";
import { EVM_FIXTURE_PROPOSALS, EVM_FIXTURE_VOTES, toEvmFixtureVoteReceipt } from "./fixtures.js";

export class EvmFixtureGovernanceFeed implements GovernanceIndexFeedPort {
  async *subscribeGovernanceEvents(input: {
    chain: ChainRef;
    from?: IndexCursor;
  }): AsyncIterable<NormalizedChainEvent<GovernanceEventType>> {
    // Yield all fixture proposals once, then stop (no polling in fixture mode).
    for (let i = 0; i < EVM_FIXTURE_PROPOSALS.length; i++) {
      const proposal = EVM_FIXTURE_PROPOSALS[i]!;
      const blockNumber = BigInt(100 + i);
      const eventType = mapStatusToEventType(proposal.status);
      const event: NormalizedChainEvent<GovernanceEventType> = {
        id: `evm-fixture:${proposal.ref.externalId}:${proposal.status}`,
        chain: input.chain,
        type: eventType,
        payload: proposal,
        blockNumber,
        observedAt: proposal.updatedAt ?? new Date().toISOString(),
        finality: proposal.status === "Executed" ? "finalized" : "pending",
      };
      yield event;
    }

    for (let i = 0; i < EVM_FIXTURE_VOTES.length; i++) {
      const vote = EVM_FIXTURE_VOTES[i]!;
      const receipt = toEvmFixtureVoteReceipt(vote);
      const event: NormalizedChainEvent<GovernanceEventType> = {
        id: `evm-fixture:${vote.proposalExternalId}:vote:${vote.voter}`,
        chain: input.chain,
        type: "GovernanceVoteCast",
        payload: receipt,
        blockNumber: BigInt(150 + i),
        observedAt: vote.submittedAt,
        finality: "included",
      };
      yield event;
    }
  }
}

function mapStatusToEventType(status: string): GovernanceEventType {
  switch (status) {
    case "Submitted":
      return "GovernanceProposalDiscovered";
    case "Deciding":
    case "Confirming":
    case "ExecutionQueued":
      return "GovernanceProposalUpdated";
    case "Executed":
      return "GovernanceExecuted";
    case "Rejected":
    case "Cancelled":
    case "TimedOut":
      return "GovernanceProposalUpdated";
    default:
      return "GovernanceProposalDiscovered";
  }
}
