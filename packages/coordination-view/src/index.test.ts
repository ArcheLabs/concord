import { describe, expect, it } from "vitest";
import type {
  GovernanceProjectionPort,
  AgentDirectoryProjectionPort,
  TrustViewProjectionPort,
  ReputationComputationPort,
} from "./index.js";

describe("coordination-view exports", () => {
  it("GovernanceProjectionPort shape is satisfiable", () => {
    const port: GovernanceProjectionPort = {
      async projectGovernanceEvent(_event) { /* noop */ },
    };
    expect(typeof port.projectGovernanceEvent).toBe("function");
  });

  it("AgentDirectoryProjectionPort shape is satisfiable", () => {
    const port: AgentDirectoryProjectionPort = {
      async projectAgentDirectoryEvent(_event) { /* noop */ },
    };
    expect(typeof port.projectAgentDirectoryEvent).toBe("function");
  });

  it("TrustViewProjectionPort shape is satisfiable", () => {
    const port: TrustViewProjectionPort = {
      async projectTrustEvent(_event) { /* noop */ },
    };
    expect(typeof port.projectTrustEvent).toBe("function");
  });

  it("ReputationComputationPort shape is satisfiable", () => {
    const port: ReputationComputationPort = {
      async recomputeForSubject(_input) { /* noop */ },
    };
    expect(typeof port.recomputeForSubject).toBe("function");
  });
});
