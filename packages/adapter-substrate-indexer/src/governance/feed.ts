/**
 * GovernanceIndexFeedPort adapter backed by SubQuery.
 *
 * Polls the SubQuery GraphQL API for governance subjects on a schedule,
 * emitting NormalizedChainEvent entries to the consumer. This is a
 * polling adapter suitable for prototyping; a WebSocket subscription
 * can be added later when SubQuery supports it.
 */

import type { ChainRef, IndexCursor, NormalizedChainEvent } from "@concord/core";
import type { GovernanceIndexFeedPort, GovernanceEventType } from "@concord/governance";
import { SubQueryClient } from "../subquery/client.js";
import { mapSubjectToProposalSummary } from "./mapper.js";

const POLL_INTERVAL_MS = Number(process.env["INDEXER_POLL_INTERVAL_MS"] ?? "3000");

export class SubQueryGovernanceFeed implements GovernanceIndexFeedPort {
  constructor(private readonly client: SubQueryClient) {}

  async *subscribeGovernanceEvents(input: {
    chain: ChainRef;
    from?: IndexCursor;
  }): AsyncIterable<NormalizedChainEvent<GovernanceEventType>> {
    const chainId = input.chain.chainId ?? "substrate:vibly-solo";
    let lastUpdated: string | null = null;

    while (true) {
      try {
        const page = await this.client.listSubjects({ chainId, first: 50 });
        for (const raw of page.nodes) {
          if (lastUpdated && raw.updatedAt <= lastUpdated) continue;
          const summary = mapSubjectToProposalSummary(raw);
          const eventType = mapStatusToEventType(raw.status);
          const event: NormalizedChainEvent<GovernanceEventType> = {
            id: `${raw.id}:${raw.status}:${raw.updatedAt}`,
            chain: input.chain,
            type: eventType,
            payload: summary,
            observedAt: new Date(raw.updatedAt).toISOString(),
            finality: "finalized" as const,
          };
          if (raw.submittedAt) event.blockNumber = BigInt(raw.submittedAt);
          yield event;
        }
        if (page.nodes.length > 0) {
          // Track the most recently updated event we've seen
          const newest = page.nodes.reduce((a, b) =>
            a.updatedAt > b.updatedAt ? a : b,
          );
          lastUpdated = newest.updatedAt;
        }
      } catch (err) {
        // Log and continue — transient SubQuery / network errors should not crash the loop
        console.error("[SubQueryGovernanceFeed] poll error:", err);
      }
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

function mapStatusToEventType(status: string): GovernanceEventType {
  switch (status) {
    case "Submitted": return "GovernanceProposalDiscovered";
    case "Deciding":
    case "Confirming": return "GovernanceProposalUpdated";
    case "Approved": return "GovernanceExecutionQueued";
    case "Rejected":
    case "Cancelled":
    case "TimedOut":
    case "Killed": return "GovernanceProposalUpdated";
    default: return "GovernanceProposalUpdated";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
