import { describe, expect, it } from "vitest";
import {
  SubQueryGovernanceIndexAdapter,
  SubQueryGovernanceFeed,
  SubQueryGovernanceQuery,
} from "./index.js";

describe("@vibly-ai/concord-adapter-substrate-indexer", () => {
  it("SubQueryGovernanceIndexAdapter can be instantiated", () => {
    const adapter = new SubQueryGovernanceIndexAdapter("http://localhost:3010/graphql");
    expect(typeof adapter.feed.subscribeGovernanceEvents).toBe("function");
    expect(typeof adapter.query.getGovernanceCheckpoint).toBe("function");
    expect(typeof adapter.query.getGovernanceState).toBe("function");
    expect(typeof adapter.query.listGovernanceSubjects).toBe("function");
  });

  it("SubQueryGovernanceFeed satisfies GovernanceIndexFeedPort", () => {
    // Just check it conforms to the interface (no live network call)
    const adapter = new SubQueryGovernanceIndexAdapter("http://example.com/graphql");
    expect(adapter.feed).toBeInstanceOf(SubQueryGovernanceFeed);
  });

  it("SubQueryGovernanceQuery satisfies GovernanceIndexQueryPort", () => {
    const adapter = new SubQueryGovernanceIndexAdapter("http://example.com/graphql");
    expect(adapter.query).toBeInstanceOf(SubQueryGovernanceQuery);
  });
});
