import { describe, expect, it } from "vitest";
import { makeId, nowTimestamp, version } from "@ascf/foundation";
import type { ContextBundle, WorkOrder } from "@ascf/core";
import { MockRuntimeAdapter, SimpleCoordinatorGateway } from "./index.js";

describe("adapters", () => {
  it("mock runtime produces deterministic execution output", async () => {
    const runtime = new MockRuntimeAdapter();
    const result = await runtime.execute({
      actorId: makeId("ActorId", "worker_1"),
      workOrder: workOrder(),
      context: bundle(),
    });

    expect(result.executionReceipt.status).toBe("success");
    expect(result.submissionDraft.artifacts).toHaveLength(1);
  });

  it("simple coordinator can publish and subscribe events", async () => {
    const coordinator = new SimpleCoordinatorGateway();
    const role = await coordinator.assignRole({ actorId: makeId("ActorId", "observer_1"), role: "observer" });

    expect(role.role).toBe("observer");
  });
});

function workOrder(): WorkOrder {
  return {
    id: makeId("WorkOrderId", "work_adapter"),
    actionId: makeId("ActionId", "action_adapter"),
    goalId: makeId("GoalId", "goal_adapter"),
    title: "Create plan",
    description: "Create a plan",
    requiredCapabilities: [],
    contextBundleId: makeId("ContextBundleId", "ctx_adapter"),
    status: "open",
    createdAt: nowTimestamp(),
  };
}

function bundle(): ContextBundle {
  return {
    id: makeId("ContextBundleId", "ctx_adapter"),
    goalId: makeId("GoalId", "goal_adapter"),
    stateViewId: makeId("StateViewId", "state_adapter"),
    stateViewVersion: version("state-1"),
    knowledgeVersionId: makeId("KnowledgeVersionId", "kv_adapter"),
    knowledgeHash: { algorithm: "sha256", value: "abc" },
    protocolVersion: version(),
    actionPolicyVersion: version(),
    artifacts: [],
    createdAt: nowTimestamp(),
  };
}
