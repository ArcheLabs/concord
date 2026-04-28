import { describe, expect, it } from "vitest";
import { DefaultInvariantRunner } from "./index.js";
import type { ProtocolTrace } from "@concord/trace";

describe("invariant runner", () => {
  it("passes core invariants for a coherent trace", async () => {
    const report = await new DefaultInvariantRunner().run(validTrace());

    expect(report.results.find((result) => result.id === "action.policy.required")?.status).toBe("pass");
    expect(report.results.find((result) => result.id === "work.submission-has-execution-receipt")?.status).toBe("pass");
  });

  it("fails action.policy.required for missing policy decision", async () => {
    const trace = validTrace();
    trace.snapshots.policyDecisions = [];

    const report = await new DefaultInvariantRunner().run(trace, { include: ["action.policy.required"] });

    expect(report.ok).toBe(false);
    expect(report.results[0]?.status).toBe("fail");
  });

  it("fails knowledge.commit.requires-decision for missing decision", async () => {
    const trace = validTrace();
    trace.snapshots.decisionRecords = [];

    const report = await new DefaultInvariantRunner().run(trace, { include: ["knowledge.commit.requires-decision"] });

    expect(report.ok).toBe(false);
    expect(report.results[0]?.status).toBe("fail");
  });
});

function validTrace(): ProtocolTrace {
  return {
    traceId: "trace_invariants",
    schemaVersion: { value: "0.1.0" },
    startedAt: { iso: "2026-01-01T00:00:00.000Z" },
    finishedAt: { iso: "2026-01-01T00:00:01.000Z" },
    environment: { runtime: "test", store: "memory", deterministic: true },
    initialState: { actors: [], goals: [], policies: [] },
    events: [],
    snapshots: {
      contextBundles: [{ id: "ctx_1", knowledgeHash: { algorithm: "sha256", value: "kh" } }],
      contextReceipts: [{ contextBundleId: "ctx_1", knowledgeHash: { algorithm: "sha256", value: "kh" } }],
      actions: [{ id: "action_1", riskLevel: "low" }],
      policyDecisions: [{ id: "pd_1", actionId: "action_1", result: "requires_delegate_vote" }],
      negotiations: [],
      decisionRecords: [{ id: "decision_1", actionId: "action_1", result: "approved" }],
      workOrders: [{ id: "work_1", actionId: "action_1", status: "accepted" }],
      claims: [{ id: "claim_1", workOrderId: "work_1" }],
      submissions: [
        {
          id: "submission_1",
          workOrderId: "work_1",
          submittedBy: "actor_1",
          contextReceipt: {
            contextBundleId: "ctx_1",
            knowledgeHash: { algorithm: "sha256", value: "kh" },
            protocolVersion: { value: "1.0.0" },
            actionPolicyVersion: { value: "1.0.0" },
          },
          executionReceipt: { status: "success" },
        },
      ],
      reviews: [{ id: "review_1", reviewerId: "reviewer_1", target: { kind: "submission", submissionId: "submission_1" } }],
      knowledgeCandidates: [{ id: "candidate_1", targetLayer: "formal" }],
      knowledgeCommits: [{ id: "commit_1", candidateIds: ["candidate_1"], decisionRecordId: "decision_1" }],
      knowledgeVersions: [{ id: "kv_1", hash: { algorithm: "sha256", value: "hash" }, commitIds: ["commit_1"] }],
      stateViews: [],
    },
    finalState: {},
  };
}
