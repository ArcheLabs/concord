import { describe, expect, it } from "vitest";
import { makeId, nowTimestamp, version } from "@ascf/foundation";
import type { ActionIntent, Actor, ContextReceipt } from "@ascf/core";
import { InMemoryNegotiationService } from "./index.js";

describe("negotiation service", () => {
  it("approves delegate fast vote with enough support", async () => {
    const service = new InMemoryNegotiationService();
    const delegate = actor("delegate_1");
    const instance = await service.create({
      action: action(),
      protocolId: "delegate-fast-vote",
      participants: [delegate],
      context: receipt(delegate.id),
    });
    await service.submitPosition({
      negotiationId: instance.id,
      position: { actorId: delegate.id, stance: "support", rationale: "Looks good", evidence: [] },
    });

    const decision = await service.close({ negotiationId: instance.id, votingRule: { quorum: 1, threshold: 0.5 } });

    expect(decision.source).toBe("delegate_vote");
    expect(decision.result).toBe("approved");
  });

  it("marks simple negotiation as needing revision when a participant asks for changes", async () => {
    const service = new InMemoryNegotiationService();
    const reviewer = actor("reviewer_1");
    const instance = await service.create({
      action: action(),
      protocolId: "simple-structured-negotiation",
      participants: [reviewer],
      context: receipt(reviewer.id),
    });
    await service.submitPosition({
      negotiationId: instance.id,
      position: { actorId: reviewer.id, stance: "revise", rationale: "Need clearer evidence", evidence: [] },
    });

    const decision = await service.close({ negotiationId: instance.id });

    expect(decision.result).toBe("needs_revision");
    expect(decision.unresolvedIssues).toEqual(["Need clearer evidence"]);
  });
});

function actor(id: string): Actor {
  return {
    id: makeId("ActorId", id),
    kind: "agent",
    identities: [{ namespace: "local", subject: id }],
  };
}

function receipt(actorId = makeId("ActorId", "observer_1")): ContextReceipt {
  return {
    contextBundleId: makeId("ContextBundleId", "ctx_negotiation"),
    stateViewId: makeId("StateViewId", "state_negotiation"),
    stateViewVersion: version("state-1"),
    knowledgeVersionId: makeId("KnowledgeVersionId", "kv_negotiation"),
    knowledgeHash: { algorithm: "sha256", value: "abc" },
    protocolVersion: version(),
    actionPolicyVersion: version(),
    acceptedAt: nowTimestamp(),
    actorId,
  };
}

function action(): ActionIntent {
  const actorId = makeId("ActorId", "observer_1");
  return {
    id: makeId("ActionId", "action_negotiation"),
    type: "create_plan",
    proposedBy: actorId,
    goalId: makeId("GoalId", "goal_negotiation"),
    title: "Create plan",
    description: "Create a plan",
    riskLevel: "medium",
    context: receipt(actorId),
    inputs: [],
    createdAt: nowTimestamp(),
  };
}
