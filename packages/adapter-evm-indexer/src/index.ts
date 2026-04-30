/**
 * Public entry-point for @concord/adapter-evm-indexer.
 *
 * Usage:
 *
 *   import { EvmFixtureGovernanceIndexAdapter } from "@concord/adapter-evm-indexer";
 *
 *   const adapter = new EvmFixtureGovernanceIndexAdapter();
 *   concordConfig.governanceIndexFeed  = adapter.feed;
 *   concordConfig.governanceIndexQuery = adapter.query;
 */

import type { GovernanceIndexFeedPort, GovernanceIndexQueryPort } from "@concord/governance";
import { EvmFixtureGovernanceFeed } from "./evmFixtureFeed.js";
import { EvmFixtureGovernanceQuery } from "./evmFixtureQuery.js";

export { EvmFixtureGovernanceFeed } from "./evmFixtureFeed.js";
export { EvmFixtureGovernanceQuery } from "./evmFixtureQuery.js";
export { EVM_FIXTURE_PROPOSALS } from "./fixtures.js";

// ─── Convenience composite adapter ───────────────────────────────────────────

export class EvmFixtureGovernanceIndexAdapter {
  readonly feed: GovernanceIndexFeedPort;
  readonly query: GovernanceIndexQueryPort;

  constructor() {
    this.feed = new EvmFixtureGovernanceFeed();
    this.query = new EvmFixtureGovernanceQuery();
  }
}
