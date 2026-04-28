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

  it.each([
    ["action.no-work-without-policy", (trace: ProtocolTrace) => { trace.snapshots.policyDecisions = []; trace.snapshots.decisionRecords = []; }],
    ["action.high-risk-no-direct", (trace: ProtocolTrace) => { trace.snapshots.actions[0] = { id: "action_1", riskLevel: "high" }; trace.snapshots.policyDecisions[0] = { id: "pd_1", actionId: "action_1", result: "approved_directly" }; }],
    ["context.submission.requires-receipt", (trace: ProtocolTrace) => { delete (trace.snapshots.submissions[0] as Record<string, unknown>).contextReceipt; }],
    ["knowledge.version.has-hash", (trace: ProtocolTrace) => { trace.snapshots.knowledgeVersions[0] = { id: "kv_1", commitIds: ["commit_1"] }; }],
    ["work.submission-has-execution-receipt", (trace: ProtocolTrace) => { delete (trace.snapshots.submissions[0] as Record<string, unknown>).executionReceipt; }],
    ["work.accepted-requires-review", (trace: ProtocolTrace) => { trace.snapshots.reviews = []; }],
    ["review.target-exists", (trace: ProtocolTrace) => { trace.snapshots.reviews[0] = { id: "review_1", reviewerId: "reviewer_1", target: { kind: "submission", submissionId: "missing" } }; }],
    ["coordinator.no-policy-bypass", (trace: ProtocolTrace) => { trace.snapshots.policyDecisions = []; }],
  ])("fails %s for invalid trace", async (id, mutate) => {
    const trace = validTrace();
    mutate(trace);

    const report = await new DefaultInvariantRunner().run(trace, { include: [id] });

    expect(report.ok).toBe(false);
    expect(report.results[0]?.status).toBe("fail");
  });
});

describe("M9 invariant runner", () => {
  it("skips M9 invariants when trace has no projects", async () => {
    const trace = validTrace(); // pure M8 trace, no projects

    const m9Ids = [
      "project.P001.active-has-objective",
      "project.P002.active-has-boundary",
      "objective.O001.belongs-to-project",
      "boundary.B001.active-project-has-active-boundary",
      "agent.A001.belongs-to-principal",
    ];

    for (const id of m9Ids) {
      const report = await new DefaultInvariantRunner().run(trace, { include: [id] });
      expect(report.results[0]?.status, `${id} should be skipped`).toBe("skipped");
    }
  });

  it("passes all M9 invariants for a coherent M9 trace", async () => {
    const report = await new DefaultInvariantRunner().run(validTraceM9());
    const m9Results = report.results.filter((r) => r.id.startsWith("project.") || r.id.startsWith("objective.") || r.id.startsWith("boundary.") || r.id.startsWith("agent."));
    const failed = m9Results.filter((r) => r.status === "fail");
    expect(failed, `Failed: ${failed.map((r) => r.id).join(", ")}`).toHaveLength(0);
  });

  it.each([
    [
      "project.P001.active-has-objective",
      (trace: ProtocolTrace) => {
        // Remove objectives so active project has none
        trace.snapshots.objectives = [];
      },
    ],
    [
      "project.P002.active-has-boundary",
      (trace: ProtocolTrace) => {
        // Remove boundaries
        trace.snapshots.boundaries = [];
      },
    ],
    [
      "project.P003.slug-unique",
      (trace: ProtocolTrace) => {
        // Add duplicate slug
        trace.snapshots.projects = [
          { id: "proj_1", slug: "my-project", status: "active", sponsorPrincipalId: "principal_1", boundaryId: "boundary_1", primaryObjectiveId: "obj_1", protocol: { version: { value: "1.0.0" }, traceRequired: true }, createdAt: { iso: "2026-01-01T00:00:00.000Z" }, updatedAt: { iso: "2026-01-01T00:00:00.000Z" } },
          { id: "proj_2", slug: "my-project", status: "draft", sponsorPrincipalId: "principal_1", boundaryId: "boundary_1", protocol: { version: { value: "1.0.0" }, traceRequired: true }, createdAt: { iso: "2026-01-01T00:00:00.000Z" }, updatedAt: { iso: "2026-01-01T00:00:00.000Z" } },
        ];
      },
    ],
    [
      "objective.O001.belongs-to-project",
      (trace: ProtocolTrace) => {
        // Point objective to non-existent project
        trace.snapshots.objectives = [{ id: "obj_1", projectId: "missing_project", status: "active", kind: "long_term", title: "Goal", description: "Desc", successCriteria: [{ id: "sc1", description: "crit", verificationMethod: "manual", required: true }], createdBy: "principal_1", createdAt: { iso: "2026-01-01T00:00:00.000Z" }, updatedAt: { iso: "2026-01-01T00:00:00.000Z" } }];
      },
    ],
    [
      "objective.O004.no-cycle",
      (trace: ProtocolTrace) => {
        // Create circular parent reference
        trace.snapshots.objectives = [
          { id: "obj_1", projectId: "proj_1", parentObjectiveId: "obj_2", status: "active", kind: "long_term", title: "A", description: "d", successCriteria: [{ id: "sc1", description: "c", verificationMethod: "manual", required: true }], createdBy: "principal_1", createdAt: { iso: "2026-01-01T00:00:00.000Z" }, updatedAt: { iso: "2026-01-01T00:00:00.000Z" } },
          { id: "obj_2", projectId: "proj_1", parentObjectiveId: "obj_1", status: "active", kind: "long_term", title: "B", description: "d", successCriteria: [{ id: "sc2", description: "c", verificationMethod: "manual", required: true }], createdBy: "principal_1", createdAt: { iso: "2026-01-01T00:00:00.000Z" }, updatedAt: { iso: "2026-01-01T00:00:00.000Z" } },
        ];
      },
    ],
    [
      "agent.A001.belongs-to-principal",
      (trace: ProtocolTrace) => {
        // Agent points to non-existent principal
        trace.snapshots.agents = [{ id: "agent_1", principalId: "missing_principal", status: "active", displayName: "Alice", eligibleRoles: [], capabilities: [], createdAt: { iso: "2026-01-01T00:00:00.000Z" }, updatedAt: { iso: "2026-01-01T00:00:00.000Z" } }];
      },
    ],
    [
      "agent.A002.active-agent-needs-active-principal",
      (trace: ProtocolTrace) => {
        // Principal is suspended
        trace.snapshots.principals = [{ id: "principal_1", kind: "human", displayName: "Sponsor", status: "suspended", identityBindings: [], addressBindings: [], createdAt: { iso: "2026-01-01T00:00:00.000Z" }, updatedAt: { iso: "2026-01-01T00:00:00.000Z" } }];
      },
    ],
    [
      "agent.A004.revoked-binding-not-in-submission",
      (trace: ProtocolTrace) => {
        // Mark the runtime binding as revoked and add a submission referencing it
        trace.snapshots.runtimeBindings = [{ id: "rtb_1", agentId: "agent_1", principalId: "principal_1", runtimeKind: "mock", runtimeAdapterId: "mock", status: "revoked", capabilities: [], permissionScope: {}, createdAt: { iso: "2026-01-01T00:00:00.000Z" }, updatedAt: { iso: "2026-01-01T00:00:00.000Z" } }];
        (trace.snapshots.submissions[0] as Record<string, unknown>).runtimeBindingId = "rtb_1";
        (trace.snapshots.submissions[0] as Record<string, unknown>).projectId = "proj_1";
        (trace.snapshots.submissions[0] as Record<string, unknown>).agentId = "agent_1";
        (trace.snapshots.submissions[0] as Record<string, unknown>).principalId = "principal_1";
      },
    ],
  ])("M9 fails %s for invalid trace", async (id, mutate) => {
    const trace = validTraceM9();
    mutate(trace);

    const report = await new DefaultInvariantRunner().run(trace, { include: [id] });

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

function validTraceM9(): ProtocolTrace {
  const base = validTrace();
  return {
    ...base,
    snapshots: {
      ...base.snapshots,
      projects: [
        {
          id: "proj_1",
          slug: "my-project",
          name: "My Project",
          status: "active",
          sponsorPrincipalId: "principal_1",
          boundaryId: "boundary_1",
          primaryObjectiveId: "obj_1",
          protocol: { version: { value: "1.0.0" }, traceRequired: true },
          createdAt: { iso: "2026-01-01T00:00:00.000Z" },
          updatedAt: { iso: "2026-01-01T00:00:00.000Z" },
        },
      ],
      objectives: [
        {
          id: "obj_1",
          projectId: "proj_1",
          kind: "long_term",
          status: "active",
          title: "Improve adoption",
          description: "Continuously improve.",
          successCriteria: [{ id: "sc_1", description: "Reviewed knowledge committed.", verificationMethod: "knowledge_commit", required: true }],
          createdBy: "principal_1",
          createdAt: { iso: "2026-01-01T00:00:00.000Z" },
          updatedAt: { iso: "2026-01-01T00:00:00.000Z" },
        },
      ],
      boundaries: [
        {
          id: "boundary_1",
          projectId: "proj_1",
          version: { value: "1.0.0" },
          status: "active",
          prohibitedActions: [],
          riskRules: [],
          escalationRules: [],
          permissionRules: [],
          defaultRiskLevel: "medium",
          createdBy: "principal_1",
          createdAt: { iso: "2026-01-01T00:00:00.000Z" },
          updatedAt: { iso: "2026-01-01T00:00:00.000Z" },
        },
      ],
      principals: [
        {
          id: "principal_1",
          kind: "human",
          displayName: "Sponsor",
          status: "active",
          identityBindings: [{ namespace: "local", subject: "sponsor" }],
          addressBindings: [],
          createdAt: { iso: "2026-01-01T00:00:00.000Z" },
          updatedAt: { iso: "2026-01-01T00:00:00.000Z" },
        },
      ],
      agents: [
        {
          id: "agent_1",
          principalId: "principal_1",
          displayName: "Alice Agent",
          status: "active",
          eligibleRoles: ["observer", "member"],
          capabilities: [],
          createdAt: { iso: "2026-01-01T00:00:00.000Z" },
          updatedAt: { iso: "2026-01-01T00:00:00.000Z" },
        },
      ],
      runtimeBindings: [
        {
          id: "rtb_1",
          agentId: "agent_1",
          principalId: "principal_1",
          runtimeKind: "mock",
          runtimeAdapterId: "mock",
          status: "active",
          capabilities: [],
          permissionScope: {},
          createdAt: { iso: "2026-01-01T00:00:00.000Z" },
          updatedAt: { iso: "2026-01-01T00:00:00.000Z" },
        },
      ],
      memberships: [
        {
          id: "member_1",
          projectId: "proj_1",
          principalId: "principal_1",
          agentId: "agent_1",
          status: "active",
          roles: ["observer", "member"],
          joinedAt: { iso: "2026-01-01T00:00:00.000Z" },
          updatedAt: { iso: "2026-01-01T00:00:00.000Z" },
          source: "sponsor",
        },
      ],
    },
  };
}

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

  it.each([
    ["action.no-work-without-policy", (trace: ProtocolTrace) => { trace.snapshots.policyDecisions = []; trace.snapshots.decisionRecords = []; }],
    ["action.high-risk-no-direct", (trace: ProtocolTrace) => { trace.snapshots.actions[0] = { id: "action_1", riskLevel: "high" }; trace.snapshots.policyDecisions[0] = { id: "pd_1", actionId: "action_1", result: "approved_directly" }; }],
    ["context.submission.requires-receipt", (trace: ProtocolTrace) => { delete (trace.snapshots.submissions[0] as Record<string, unknown>).contextReceipt; }],
    ["knowledge.version.has-hash", (trace: ProtocolTrace) => { trace.snapshots.knowledgeVersions[0] = { id: "kv_1", commitIds: ["commit_1"] }; }],
    ["work.submission-has-execution-receipt", (trace: ProtocolTrace) => { delete (trace.snapshots.submissions[0] as Record<string, unknown>).executionReceipt; }],
    ["work.accepted-requires-review", (trace: ProtocolTrace) => { trace.snapshots.reviews = []; }],
    ["review.target-exists", (trace: ProtocolTrace) => { trace.snapshots.reviews[0] = { id: "review_1", reviewerId: "reviewer_1", target: { kind: "submission", submissionId: "missing" } }; }],
    ["coordinator.no-policy-bypass", (trace: ProtocolTrace) => { trace.snapshots.policyDecisions = []; }],
  ])("fails %s for invalid trace", async (id, mutate) => {
    const trace = validTrace();
    mutate(trace);

    const report = await new DefaultInvariantRunner().run(trace, { include: [id] });

    expect(report.ok).toBe(false);
    expect(report.results[0]?.status).toBe("fail");
  });
});

