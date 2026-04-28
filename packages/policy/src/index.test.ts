import { describe, expect, it } from "vitest";
import { makeId, nowTimestamp, version } from "@concord/foundation";
import type { ActionIntent, ActionPolicy, Actor, ContextBundle, ContextReceipt, DecisionRecord } from "@concord/core";
import { MemoryEventStore } from "@concord/state";
import { InMemoryActionPolicyRegistry } from "./index.js";

describe("policy registry", () => {
  it("rejects unknown action types and records an event", async () => {
    const eventStore = new MemoryEventStore();
    const registry = new InMemoryActionPolicyRegistry(eventStore);
    const decision = await registry.evaluate({ action: action("unknown"), actor: actor(), context: bundle() });

    expect(decision.result).toBe("rejected");
    await expect(eventStore.query({ type: ["ActionPolicyEvaluated"] })).resolves.toHaveLength(1);
  });

  it("routes registered action types to negotiation", async () => {
    const registry = new InMemoryActionPolicyRegistry();
    await registry.registerPolicy({ policy: policy(), decisionRecord: decisionRecord() });
    const decision = await registry.evaluate({ action: action("create_plan"), actor: actor(), context: bundle() });

    expect(decision.result).toBe("requires_negotiation");
  });
});

function actor(): Actor {
  return {
    id: makeId("ActorId", "actor_policy"),
    kind: "agent",
    identities: [{ namespace: "local", subject: "actor-policy" }],
  };
}

function receipt(): ContextReceipt {
  return {
    contextBundleId: makeId("ContextBundleId", "ctx_policy"),
    stateViewId: makeId("StateViewId", "state_policy"),
    stateViewVersion: version("state-1"),
    knowledgeVersionId: makeId("KnowledgeVersionId", "kv_policy"),
    knowledgeHash: { algorithm: "sha256", value: "abc" },
    protocolVersion: version(),
    actionPolicyVersion: version(),
    acceptedAt: nowTimestamp(),
    actorId: makeId("ActorId", "actor_policy"),
  };
}

function bundle(): ContextBundle {
  const contextReceipt = receipt();
  return {
    id: contextReceipt.contextBundleId,
    goalId: makeId("GoalId", "goal_policy"),
    stateViewId: contextReceipt.stateViewId,
    stateViewVersion: contextReceipt.stateViewVersion,
    knowledgeVersionId: contextReceipt.knowledgeVersionId,
    knowledgeHash: contextReceipt.knowledgeHash,
    protocolVersion: contextReceipt.protocolVersion,
    actionPolicyVersion: contextReceipt.actionPolicyVersion,
    artifacts: [],
    createdAt: nowTimestamp(),
  };
}

function action(type: string): ActionIntent {
  return {
    id: makeId("ActionId", `action_${type}`),
    type,
    proposedBy: makeId("ActorId", "actor_policy"),
    goalId: makeId("GoalId", "goal_policy"),
    title: "Create plan",
    description: "Create a plan",
    riskLevel: "medium",
    context: receipt(),
    inputs: [],
    createdAt: nowTimestamp(),
  };
}

function policy(): ActionPolicy {
  return {
    id: makeId("ActionPolicyId", "policy_create_plan"),
    version: version(),
    actionType: "create_plan",
    eligibility: [],
    requiredContext: [],
    decisionFlow: "structured_negotiation",
    negotiationProtocolId: makeId("NegotiationProtocolId", "simple-structured-negotiation"),
    resultBinding: "binding",
    produces: ["work_order", "knowledge_candidate"],
  };
}

function decisionRecord(): DecisionRecord {
  return {
    id: makeId("DecisionRecordId", "decision_policy"),
    source: "manual",
    result: "approved",
    summary: "Seed policy",
    approvals: [],
    rejections: [],
    abstentions: [],
    unresolvedIssues: [],
    outputArtifacts: [],
    createdAt: nowTimestamp(),
  };
}
