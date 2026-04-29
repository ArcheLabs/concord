import { describe, expect, it } from "vitest";
import type {
  AgentDirectoryActionsPort,
  AgentDirectoryQueryPort,
  AgentDirectoryIndexerPort,
  AgentRegistrationRecord,
  AgentDirectoryEventType,
} from "./index.js";

describe("agent-directory exports", () => {
  it("AgentDirectoryEventType covers expected events", () => {
    const events: AgentDirectoryEventType[] = [
      "AgentRegistered",
      "AgentURIUpdated",
      "AgentMetadataUpdated",
      "AgentWalletUpdated",
      "AgentTransferred",
    ];
    expect(events.length).toBe(5);
  });

  it("AgentRegistrationRecord can be constructed", () => {
    const record: AgentRegistrationRecord = {
      ref: {
        chain: { namespace: "eip155", chainId: "1" },
        backend: "eip8004-identity",
        registryId: "0xRegistry",
        agentId: "0xAgent",
      },
      owner: "0xOwner",
      agentURI: "https://agent.example.com/descriptor.json",
    };
    expect(record.ref.backend).toBe("eip8004-identity");
  });

  it("AgentDirectoryActionsPort shape is satisfiable", () => {
    const port: AgentDirectoryActionsPort = {
      kind: "eip8004-identity",
      async registerAgent() {
        return { txHash: "0x1", chain: { namespace: "eip155", chainId: "1" }, finality: "pending" };
      },
      async updateAgentURI() {
        return { txHash: "0x2", chain: { namespace: "eip155", chainId: "1" }, finality: "pending" };
      },
    };
    expect(port.kind).toBe("eip8004-identity");
  });

  it("AgentDirectoryQueryPort shape is satisfiable", () => {
    const port: AgentDirectoryQueryPort = {
      kind: "eip8004-identity",
      async getRegistration() { return null; },
      async listRegistrations() { return { items: [] }; },
      async resolveAgentDescriptor() { return null; },
    };
    expect(port.kind).toBe("eip8004-identity");
  });

  it("AgentDirectoryIndexerPort shape is satisfiable", () => {
    const port: AgentDirectoryIndexerPort = {
      kind: "eip8004-identity",
      async backfill() { return []; },
      async *subscribe() { /* empty */ },
      async resolveState() { return null; },
    };
    expect(typeof port.backfill).toBe("function");
  });
});
