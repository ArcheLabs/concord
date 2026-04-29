import { describe, expect, it } from "vitest";
import type {
  TrustRegistryActionsPort,
  TrustRegistryQueryPort,
  TrustRegistryIndexerPort,
  FeedbackRecord,
  TrustRegistryEventType,
} from "./index.js";

describe("trust-registry exports", () => {
  it("TrustRegistryEventType covers expected events", () => {
    const events: TrustRegistryEventType[] = [
      "FeedbackGiven",
      "FeedbackRevoked",
      "FeedbackResponseAppended",
      "ValidationRequested",
      "ValidationResponded",
      "TrustFinalityUpdated",
    ];
    expect(events.length).toBe(6);
  });

  it("FeedbackRecord can be constructed", () => {
    const record: FeedbackRecord = {
      subject: {
        chain: { namespace: "eip155", chainId: "1" },
        backend: "eip8004-reputation",
        registryId: "0xRegistry",
        subjectId: "0xAgent",
      },
      clientAddress: "0xClient",
      value: "100",
      valueDecimals: 2,
    };
    expect(record.subject.backend).toBe("eip8004-reputation");
  });

  it("TrustRegistryActionsPort shape is satisfiable", () => {
    const port: TrustRegistryActionsPort = {
      kind: "eip8004-reputation",
      async giveFeedback() {
        return { txHash: "0x1", chain: { namespace: "eip155", chainId: "1" }, finality: "pending" };
      },
    };
    expect(port.kind).toBe("eip8004-reputation");
  });

  it("TrustRegistryQueryPort shape is satisfiable", () => {
    const port: TrustRegistryQueryPort = {
      kind: "eip8004-validation",
      async getFeedback() { return null; },
      async listFeedback() { return []; },
      async getFeedbackSummary() { return null; },
      async getValidationStatus() { return null; },
      async listAgentValidations() { return []; },
    };
    expect(port.kind).toBe("eip8004-validation");
  });

  it("TrustRegistryIndexerPort shape is satisfiable", () => {
    const port: TrustRegistryIndexerPort = {
      kind: "eip8004-reputation",
      async backfill() { return []; },
      async *subscribe() { /* empty */ },
      async resolveFeedbackState() { return null; },
      async resolveValidationState() { return null; },
    };
    expect(typeof port.backfill).toBe("function");
  });
});
