/**
 * Public entry-point for @concord/adapter-substrate-indexer.
 *
 * Usage:
 *
 *   import { SubQueryGovernanceIndexAdapter } from "@concord/adapter-substrate-indexer";
 *
 *   const adapter = new SubQueryGovernanceIndexAdapter("http://localhost:3010/graphql");
 *   concordConfig.governanceIndexFeed  = adapter.feed;
 *   concordConfig.governanceIndexQuery = adapter.query;
 */

import { SubQueryClient } from "./subquery/client.js";
import { SubQueryGovernanceFeed } from "./governance/feed.js";
import { SubQueryGovernanceQuery } from "./governance/query.js";
import type { GovernanceIndexFeedPort, GovernanceIndexQueryPort } from "@concord/governance";

export { SubQueryClient } from "./subquery/client.js";
export { SubQueryGovernanceFeed } from "./governance/feed.js";
export { SubQueryGovernanceQuery } from "./governance/query.js";

// ─── Convenience composite adapter ───────────────────────────────────────────

export class SubQueryGovernanceIndexAdapter {
  readonly feed: GovernanceIndexFeedPort;
  readonly query: GovernanceIndexQueryPort;

  constructor(graphqlEndpoint: string) {
    const client = new SubQueryClient(graphqlEndpoint);
    this.feed = new SubQueryGovernanceFeed(client);
    this.query = new SubQueryGovernanceQuery(client);
  }
}
