import { describe, expect, it } from "vitest";
import { makeId, nowTimestamp, version } from "@vibly-ai/concord-foundation";
import type { LegacyActionIntent, Actor, ContextReceipt } from "@vibly-ai/concord-core";
import { InMemoryNegotiationService } from "./index.js";
import { InMemoryReputationEvidenceService } from "@concord/reputation";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function actor(id: string): Actor {
  return { id: makeId("ActorId", id), kind: "agent", identities: [{ namespace: "local", subject: id }] };
}

function receipt(actorId = makeId("ActorId", "observer_1")): ContextReceipt {
  return {
    contextBundleId: makeId("ContextBundleId", "ctx_neg"),
    stateViewId: makeId("StateViewId", "state_neg"),
    stateViewVersion: version("state-1"),
    knowledgeVersionId: makeId("KnowledgeVersionId", "kv_neg"),
    knowledgeHash: { algorithm: "sha256", value: "abc" },
    protocolVersion: version(),
    actionPolicyVersion: version(),
    acceptedAt: nowTimestamp(),
    actorId,
  };
}

function action(proposedBy = makeId("ActorId", "observer_1")): LegacyActionIntent {
  return {
    id: makeId("ActionId", "action_neg"),
    type: "create_plan",
    proposedBy,
    goalId: makeId("GoalId", "goal_neg"),
    title: "Create plan",
    description: "Create a plan",
    riskLevel: "medium",
    context: receipt(proposedBy),
    inputs: [],
    createdAt: nowTimestamp(),
  };
}

// ─── Legacy: delegate fast vote ───────────────────────────────────────────────

describe("delegate fast vote", () => {
  it("approves with enough support", async () => {
    const svc = new InMemoryNegotiationService();
    const delegate = actor("delegate_1");
    const instance = await svc.create({
      action: action(),
      protocolId: "delegate-fast-vote",
      participants: [delegate],
      context: receipt(delegate.id),
    });
    await svc.submitPosition({
      negotiationId: instance.id,
      position: { actorId: delegate.id, stance: "support", rationale: "Looks good", evidence: [] },
    });
    const { decision } = await svc.close({ negotiationId: instance.id, votingRule: { quorum: 1, threshold: 0.5 } });
    expect(decision.source).toBe("delegate_vote");
    expect(decision.result).toBe("approved");
  });

  it("marks simple negotiation as needing revision when a participant asks for changes", async () => {
    const svc = new InMemoryNegotiationService();
    const reviewer = actor("reviewer_1");
    const instance = await svc.create({
      action: action(),
      protocolId: "simple-structured-negotiation",
      participants: [reviewer],
      context: receipt(reviewer.id),
    });
    await svc.submitPosition({
      negotiationId: instance.id,
      position: { actorId: reviewer.id, stance: "revise", rationale: "Need clearer evidence", evidence: [] },
    });
    const { decision } = await svc.close({ negotiationId: instance.id });
    expect(decision.result).toBe("needs_revision");
    expect(decision.unresolvedIssues).toEqual(["Need clearer evidence"]);
  });
});

// ─── Multi-round convergence ──────────────────────────────────────────────────

describe("structured negotiation multi-round convergence", () => {
  it("converges when average score meets threshold", async () => {
    const svc = new InMemoryNegotiationService();
    const [d1, d2] = [actor("d1"), actor("d2")];
    const act = action();
    const instance = await svc.create({
      action: act,
      protocolId: "simple-structured-negotiation",
      participants: [d1, d2],
      context: receipt(d1.id),
      convergenceThreshold: 0.7,
      maxRounds: 3,
    });

    // Round 1: avg score 0.8 >= 0.7 → converges immediately
    await svc.submitPosition({ negotiationId: instance.id, position: { actorId: d1.id, stance: "support", rationale: "ok", score: 0.8, evidence: [] } });
    await svc.submitPosition({ negotiationId: instance.id, position: { actorId: d2.id, stance: "support", rationale: "ok", score: 0.8, evidence: [] } });
    const { decision, instance: updated } = await svc.close({ negotiationId: instance.id });
    expect(decision.result).toBe("approved");
    expect(updated.status).toBe("converged");
    expect(updated.rounds).toHaveLength(1);
  });

  it("opens a new round when score is below threshold and max rounds not reached", async () => {
    const svc = new InMemoryNegotiationService();
    const [d1, d2] = [actor("d1"), actor("d2")];
    const act = action();
    const instance = await svc.create({
      action: act,
      protocolId: "simple-structured-negotiation",
      participants: [d1, d2],
      context: receipt(d1.id),
      convergenceThreshold: 0.7,
      maxRounds: 3,
    });

    // Round 1: avg score 0.4 < 0.7 → needs_revision, opens round 2
    await svc.submitPosition({ negotiationId: instance.id, position: { actorId: d1.id, stance: "revise", rationale: "not good", score: 0.4, evidence: [] } });
    await svc.submitPosition({ negotiationId: instance.id, position: { actorId: d2.id, stance: "revise", rationale: "needs work", score: 0.4, evidence: [] } });
    const { decision: d1result, instance: afterRound1 } = await svc.close({ negotiationId: instance.id });
    expect(d1result.result).toBe("needs_revision");
    expect(afterRound1.status).toBe("revising");
    expect(afterRound1.rounds).toHaveLength(2);
    expect(afterRound1.rounds[1]!.index).toBe(2);

    // Round 2: avg score 0.9 → converges
    await svc.submitPosition({ negotiationId: instance.id, position: { actorId: d1.id, stance: "support", rationale: "improved", score: 0.9, evidence: [] } });
    await svc.submitPosition({ negotiationId: instance.id, position: { actorId: d2.id, stance: "support", rationale: "improved", score: 0.9, evidence: [] } });
    const { decision: d2result, instance: afterRound2 } = await svc.close({ negotiationId: instance.id });
    expect(d2result.result).toBe("approved");
    expect(afterRound2.status).toBe("converged");
  });

  it("escalates after exceeding max rounds", async () => {
    const svc = new InMemoryNegotiationService();
    const d1 = actor("d1");
    const act = action();
    const instance = await svc.create({
      action: act,
      protocolId: "simple-structured-negotiation",
      participants: [d1],
      context: receipt(d1.id),
      convergenceThreshold: 0.9,
      maxRounds: 2,
    });

    // Round 1: score 0.4 < 0.9 → opens round 2
    await svc.submitPosition({ negotiationId: instance.id, position: { actorId: d1.id, stance: "revise", rationale: "no", score: 0.4, evidence: [] } });
    const { decision: r1 } = await svc.close({ negotiationId: instance.id });
    expect(r1.result).toBe("needs_revision");

    // Round 2: score 0.4 again, maxRounds reached → escalated
    await svc.submitPosition({ negotiationId: instance.id, position: { actorId: d1.id, stance: "revise", rationale: "still no", score: 0.4, evidence: [] } });
    const { decision: r2, instance: final } = await svc.close({ negotiationId: instance.id });
    expect(r2.result).toBe("escalated");
    expect(final.status).toBe("failed");
  });
});

// ─── Fork ─────────────────────────────────────────────────────────────────────

describe("fork", () => {
  it("creates a fork with parentNegotiationId set", async () => {
    const svc = new InMemoryNegotiationService();
    const initiator = actor("obs_1");
    const newInit = actor("obs_2");
    const d1 = actor("d1");

    const parent = await svc.create({
      action: action(initiator.id),
      protocolId: "simple-structured-negotiation",
      participants: [d1],
      context: receipt(initiator.id),
    });

    const fork = await svc.fork({
      parentNegotiationId: parent.id,
      newInitiator: newInit,
      participants: [d1],
      forkReason: "Exploring alternative approach",
      context: receipt(newInit.id),
    });

    expect(fork.parentNegotiationId).toBe(parent.id);
    expect(fork.actionId).toBe(parent.actionId);
    expect(fork.initiator).toBe(newInit.id);
    expect(fork.rounds).toHaveLength(1);
    expect(fork.rounds[0]!.index).toBe(1);
  });

  it("fork is independent from parent", async () => {
    const svc = new InMemoryNegotiationService();
    const obs = actor("obs");
    const d1 = actor("d1");
    const parent = await svc.create({ action: action(obs.id), protocolId: "simple-structured-negotiation", participants: [d1], context: receipt(obs.id) });
    const fork = await svc.fork({ parentNegotiationId: parent.id, newInitiator: obs, participants: [d1], forkReason: "alt", context: receipt(obs.id) });

    // Submit on fork
    await svc.submitPosition({ negotiationId: fork.id, position: { actorId: d1.id, stance: "support", rationale: "ok", score: 0.9, evidence: [] } });
    const { decision } = await svc.close({ negotiationId: fork.id, convergenceThreshold: 0.7 } as never);
    expect(decision.result).toBe("approved");

    // Parent is untouched
    const parentState = await svc.get(parent.id);
    expect(parentState?.status).toBe("collecting_positions");
  });
});

// ─── Reputation evidence write-back ──────────────────────────────────────────

describe("reputation evidence write-back", () => {
  it("writes delegate_participated for supporters when converged", async () => {
    const repSvc = new InMemoryReputationEvidenceService();
    const svc = new InMemoryNegotiationService(undefined, repSvc);
    const projectId = makeId("ProjectId", "proj_1") as unknown as string;
    const d1 = actor("d1");

    const instance = await svc.create({
      action: action(),
      protocolId: "simple-structured-negotiation",
      participants: [d1],
      context: receipt(d1.id),
      convergenceThreshold: 0.5,
    });
    await svc.submitPosition({ negotiationId: instance.id, position: { actorId: d1.id, stance: "support", rationale: "ok", score: 0.8, evidence: [] } });
    const { decision } = await svc.close({ negotiationId: instance.id, projectId });
    expect(decision.result).toBe("approved");

    const evidence = await repSvc.listEvidence({ actorId: d1.id });
    const kinds = evidence.map((e) => e.kind);
    expect(kinds).toContain("delegate_participated");
  });

  it("writes delegate_non_response for participants who did not submit", async () => {
    const repSvc = new InMemoryReputationEvidenceService();
    const svc = new InMemoryNegotiationService(undefined, repSvc);
    const projectId = makeId("ProjectId", "proj_2") as unknown as string;
    const d1 = actor("d1");
    const silent = actor("silent");

    const instance = await svc.create({
      action: action(),
      protocolId: "simple-structured-negotiation",
      participants: [d1, silent],
      context: receipt(d1.id),
      convergenceThreshold: 0.5,
    });
    await svc.submitPosition({ negotiationId: instance.id, position: { actorId: d1.id, stance: "support", rationale: "ok", score: 0.9, evidence: [] } });
    await svc.close({ negotiationId: instance.id, projectId });

    const silentEvidence = await repSvc.listEvidence({ actorId: silent.id });
    expect(silentEvidence.some((e) => e.kind === "delegate_non_response")).toBe(true);
  });

  it("writes review_consensus_deviation for outlier scores", async () => {
    const repSvc = new InMemoryReputationEvidenceService();
    const svc = new InMemoryNegotiationService(undefined, repSvc);
    const projectId = makeId("ProjectId", "proj_3") as unknown as string;
    const [d1, d2, d3] = [actor("d1"), actor("d2"), actor("outlier")];

    const instance = await svc.create({
      action: action(),
      protocolId: "simple-structured-negotiation",
      participants: [d1, d2, d3],
      context: receipt(d1.id),
      convergenceThreshold: 0.5,
    });
    // d1 and d2 score 0.9, outlier scores 0.1 → large deviation
    await svc.submitPosition({ negotiationId: instance.id, position: { actorId: d1.id, stance: "support", rationale: "ok", score: 0.9, evidence: [] } });
    await svc.submitPosition({ negotiationId: instance.id, position: { actorId: d2.id, stance: "support", rationale: "ok", score: 0.9, evidence: [] } });
    await svc.submitPosition({ negotiationId: instance.id, position: { actorId: d3.id, stance: "revise", rationale: "disagree", score: 0.1, evidence: [] } });
    await svc.close({ negotiationId: instance.id, projectId });

    const outlierEvidence = await repSvc.listEvidence({ actorId: d3.id });
    expect(outlierEvidence.some((e) => e.kind === "review_consensus_deviation")).toBe(true);
  });
});
