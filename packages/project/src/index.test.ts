import { describe, expect, it } from "vitest";
import {
  AgentService,
  BoundaryService,
  MemoryProjectStore,
  ObjectiveService,
  PrincipalService,
  ProjectService,
} from "./index.js";

function makeStore() {
  return new MemoryProjectStore();
}

function makePrincipalService(store = makeStore()) {
  return { service: new PrincipalService(store), store };
}

function makeAgentService(store = makeStore()) {
  return { service: new AgentService(store), store };
}

async function setupPrincipal(store = makeStore()) {
  const ps = new PrincipalService(store);
  const principal = await ps.registerPrincipal({
    kind: "human",
    displayName: "Sponsor",
    identityBindings: [{ namespace: "local", subject: "sponsor" }],
  });
  return { principal, store, ps };
}

// ---------------------------------------------------------------------------
// PrincipalService
// ---------------------------------------------------------------------------

describe("PrincipalService", () => {
  it("registers a principal and retrieves it", async () => {
    const { service, store } = makePrincipalService();
    const principal = await service.registerPrincipal({
      kind: "human",
      displayName: "Alice",
      identityBindings: [{ namespace: "local", subject: "alice" }],
    });

    expect(principal.id).toBeTruthy();
    expect(principal.status).toBe("active");
    expect(principal.displayName).toBe("Alice");

    const fetched = await store.getPrincipal(principal.id);
    expect(fetched?.id).toBe(principal.id);
  });

  it("rejects registration with empty displayName", async () => {
    const { service } = makePrincipalService();
    await expect(
      service.registerPrincipal({ kind: "human", displayName: "  " as string, identityBindings: [] }),
    ).rejects.toThrow();
  });

  it("changes principal status to suspended", async () => {
    const { service } = makePrincipalService();
    const principal = await service.registerPrincipal({
      kind: "human",
      displayName: "Bob",
      identityBindings: [{ namespace: "local", subject: "bob" }],
    });

    const updated = await service.changePrincipalStatus({
      principalId: principal.id,
      nextStatus: "suspended",
      reason: "misbehaviour",
    });

    expect(updated.status).toBe("suspended");
  });
});

// ---------------------------------------------------------------------------
// AgentService
// ---------------------------------------------------------------------------

describe("AgentService", () => {
  it("registers an agent under an active principal", async () => {
    const { principal, store } = await setupPrincipal();
    const as = new AgentService(store);

    const agent = await as.registerAgent({
      principalId: principal.id,
      displayName: "Alice Agent",
      eligibleRoles: ["observer", "member"],
    });

    expect(agent.id).toBeTruthy();
    expect(agent.principalId).toBe(principal.id);
    expect(agent.status).toBe("active");
  });

  it("rejects agent registration under a suspended principal", async () => {
    const { principal, store } = await setupPrincipal();
    const ps = new PrincipalService(store);
    await ps.changePrincipalStatus({ principalId: principal.id, nextStatus: "suspended", reason: "test" });
    const as = new AgentService(store);

    await expect(
      as.registerAgent({ principalId: principal.id, displayName: "Agent" }),
    ).rejects.toThrow();
  });

  it("creates and revokes a runtime binding", async () => {
    const { principal, store } = await setupPrincipal();
    const as = new AgentService(store);
    const agent = await as.registerAgent({ principalId: principal.id, displayName: "Agent" });

    const binding = await as.createRuntimeBinding({
      agentId: agent.id,
      runtimeKind: "mock",
      runtimeAdapterId: "mock-adapter",
    });

    expect(binding.status).toBe("active");
    expect(binding.agentId).toBe(agent.id);
    expect(binding.principalId).toBe(principal.id);

    const revoked = await as.revokeRuntimeBinding({ runtimeBindingId: binding.id, reason: "no longer needed" });
    expect(revoked.status).toBe("revoked");
    expect(revoked.revokedAt).toBeTruthy();
  });

  it("adds project member and finds membership", async () => {
    const { principal, store } = await setupPrincipal();
    const as = new AgentService(store);
    const ps = new ProjectService(store);
    const agent = await as.registerAgent({ principalId: principal.id, displayName: "Agent" });

    const project = await ps.createProject({
      slug: "test-project",
      name: "Test Project",
      sponsorPrincipalId: principal.id,
      boundary: { createdBy: principal.id, defaultRiskLevel: "medium" },
    });

    const membership = await as.addProjectMember({
      projectId: project.id,
      principalId: principal.id,
      agentId: agent.id,
      roles: ["observer", "member"],
      source: "sponsor",
    });

    expect(membership.status).toBe("active");
    expect(membership.agentId).toBe(agent.id);

    const found = await store.findMembership({ projectId: project.id, agentId: agent.id });
    expect(found?.id).toBe(membership.id);
  });

  it("rejects membership where agent belongs to a different principal", async () => {
    const { principal: p1, store } = await setupPrincipal();
    const p2 = await new PrincipalService(store).registerPrincipal({
      kind: "human",
      displayName: "Bob",
      identityBindings: [{ namespace: "local", subject: "bob" }],
    });
    const ps = new ProjectService(store);
    const as = new AgentService(store);

    const project = await ps.createProject({
      slug: "proj",
      name: "Proj",
      sponsorPrincipalId: p1.id,
      boundary: { createdBy: p1.id },
    });
    // agent belongs to p1, but membership says principalId = p2
    const agent = await as.registerAgent({ principalId: p1.id, displayName: "A" });

    await expect(
      as.addProjectMember({ projectId: project.id, principalId: p2.id, agentId: agent.id, roles: ["observer"], source: "sponsor" }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// ProjectService
// ---------------------------------------------------------------------------

describe("ProjectService", () => {
  it("creates a project with inline boundary", async () => {
    const { principal, store } = await setupPrincipal();
    const ps = new ProjectService(store);

    const project = await ps.createProject({
      slug: "my-project",
      name: "My Project",
      sponsorPrincipalId: principal.id,
      boundary: {
        createdBy: principal.id,
        defaultRiskLevel: "medium",
        prohibitedActions: [{ id: "r1", actionType: "transfer_funds", effect: "deny", reason: "No direct transfers." }],
      },
    });

    expect(project.id).toBeTruthy();
    expect(project.slug).toBe("my-project");
    expect(project.status).toBe("draft");
    expect(project.boundaryId).toBeTruthy();

    const boundary = await store.getBoundary(project.boundaryId);
    expect(boundary?.status).toBe("active");
    expect(boundary?.prohibitedActions).toHaveLength(1);
  });

  it("rejects duplicate project slug", async () => {
    const { principal, store } = await setupPrincipal();
    const ps = new ProjectService(store);

    await ps.createProject({
      slug: "dup-slug",
      name: "First",
      sponsorPrincipalId: principal.id,
      boundary: { createdBy: principal.id },
    });

    await expect(
      ps.createProject({
        slug: "dup-slug",
        name: "Second",
        sponsorPrincipalId: principal.id,
        boundary: { createdBy: principal.id },
      }),
    ).rejects.toThrow();
  });

  it("activates project after setting primary objective", async () => {
    const { principal, store } = await setupPrincipal();
    const ps = new ProjectService(store);
    const os = new ObjectiveService(store);

    const project = await ps.createProject({
      slug: "activation-test",
      name: "Activation Test",
      sponsorPrincipalId: principal.id,
      boundary: { createdBy: principal.id },
    });

    const objective = await os.createObjective({
      projectId: project.id,
      title: "Main goal",
      description: "Improve things.",
      kind: "long_term",
      successCriteria: [{ id: "sc1", description: "Knowledge committed.", verificationMethod: "knowledge_commit", required: true }],
      createdBy: principal.id,
    });
    await os.activateObjective({ objectiveId: objective.id, actorId: principal.id });
    await os.setPrimaryObjective({ projectId: project.id, objectiveId: objective.id, actorId: principal.id });

    const activated = await ps.activateProject({ projectId: project.id, actorId: principal.id });
    expect(activated.status).toBe("active");
  });

  it("rejects project activation without active primary objective", async () => {
    const { principal, store } = await setupPrincipal();
    const ps = new ProjectService(store);

    const project = await ps.createProject({
      slug: "no-obj",
      name: "No Objective",
      sponsorPrincipalId: principal.id,
      boundary: { createdBy: principal.id },
    });

    await expect(ps.activateProject({ projectId: project.id, actorId: principal.id })).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// ObjectiveService
// ---------------------------------------------------------------------------

describe("ObjectiveService", () => {
  it("creates an objective and activates it", async () => {
    const { principal, store } = await setupPrincipal();
    const ps = new ProjectService(store);
    const os = new ObjectiveService(store);

    const project = await ps.createProject({
      slug: "obj-test",
      name: "Obj Test",
      sponsorPrincipalId: principal.id,
      boundary: { createdBy: principal.id },
    });

    const objective = await os.createObjective({
      projectId: project.id,
      title: "Grow adoption",
      description: "Coordinate efforts.",
      kind: "long_term",
      successCriteria: [{ id: "sc1", description: "Review complete.", verificationMethod: "human_review", required: true }],
      createdBy: principal.id,
    });

    expect(objective.status).toBe("draft");

    const activated = await os.activateObjective({ objectiveId: objective.id, actorId: principal.id });
    expect(activated.status).toBe("active");
  });

  it("rejects closed objective re-activation", async () => {
    const { principal, store } = await setupPrincipal();
    const ps = new ProjectService(store);
    const os = new ObjectiveService(store);

    const project = await ps.createProject({
      slug: "closed-obj",
      name: "Closed Obj",
      sponsorPrincipalId: principal.id,
      boundary: { createdBy: principal.id },
    });

    const objective = await os.createObjective({
      projectId: project.id,
      title: "Closed",
      description: "Will be closed.",
      kind: "milestone",
      successCriteria: [{ id: "sc1", description: "Done.", verificationMethod: "manual", required: true }],
      createdBy: principal.id,
    });

    await os.activateObjective({ objectiveId: objective.id, actorId: principal.id });
    await os.closeObjective({ objectiveId: objective.id, actorId: principal.id, status: "succeeded", reason: "done" });

    await expect(os.activateObjective({ objectiveId: objective.id, actorId: principal.id })).rejects.toThrow();
  });

  it("rejects parent objective from another project", async () => {
    const { principal, store } = await setupPrincipal();
    const ps = new ProjectService(store);
    const os = new ObjectiveService(store);

    const p1 = await ps.createProject({ slug: "project-one", name: "P1", sponsorPrincipalId: principal.id, boundary: { createdBy: principal.id } });
    const p2 = await ps.createProject({ slug: "project-two", name: "P2", sponsorPrincipalId: principal.id, boundary: { createdBy: principal.id } });

    const parentObj = await os.createObjective({
      projectId: p1.id,
      title: "Parent",
      description: "In P1.",
      kind: "long_term",
      successCriteria: [{ id: "sc1", description: "c", verificationMethod: "manual", required: true }],
      createdBy: principal.id,
    });

    await expect(
      os.createObjective({
        projectId: p2.id,
        parentObjectiveId: parentObj.id,
        title: "Child",
        description: "Wrong project parent.",
        kind: "milestone",
        successCriteria: [{ id: "sc2", description: "c", verificationMethod: "manual", required: true }],
        createdBy: principal.id,
      }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// BoundaryService
// ---------------------------------------------------------------------------

describe("BoundaryService", () => {
  it("evaluates a deny rule", async () => {
    const { principal, store } = await setupPrincipal();
    const ps = new ProjectService(store);
    const bs = new BoundaryService(store);

    const project = await ps.createProject({
      slug: "boundary-test",
      name: "Boundary Test",
      sponsorPrincipalId: principal.id,
      boundary: {
        createdBy: principal.id,
        defaultRiskLevel: "low",
        prohibitedActions: [{ id: "deny-funds", actionType: "transfer_funds", effect: "deny", reason: "No direct transfers." }],
      },
    });

    const result = await bs.evaluateAction({ projectId: project.id, actionType: "transfer_funds" });
    expect(result.allowed).toBe(false);
    expect(result.matchedRules).toContain("deny-funds");
  });

  it("returns elevated riskLevel from risk rules", async () => {
    const { principal, store } = await setupPrincipal();
    const ps = new ProjectService(store);
    const bs = new BoundaryService(store);

    const project = await ps.createProject({
      slug: "risk-test",
      name: "Risk Test",
      sponsorPrincipalId: principal.id,
      boundary: {
        createdBy: principal.id,
        defaultRiskLevel: "low",
        riskRules: [{ id: "rr1", actionType: "request_budget", riskLevel: "critical", reason: "High value." }],
      },
    });

    const result = await bs.evaluateAction({ projectId: project.id, actionType: "request_budget" });
    expect(result.riskLevel).toBe("critical");
    expect(result.allowed).toBe(true);
  });

  it("returns requiredFlow from escalation rules", async () => {
    const { principal, store } = await setupPrincipal();
    const ps = new ProjectService(store);
    const bs = new BoundaryService(store);

    const project = await ps.createProject({
      slug: "escl-test",
      name: "Escalation Test",
      sponsorPrincipalId: principal.id,
      boundary: {
        createdBy: principal.id,
        escalationRules: [{ id: "er1", actionType: "modify_formal_knowledge", requiredFlow: "structured_negotiation", reason: "Needs consensus." }],
      },
    });

    const result = await bs.evaluateAction({ projectId: project.id, actionType: "modify_formal_knowledge" });
    expect(result.requiredFlow).toBe("structured_negotiation");
  });
});
