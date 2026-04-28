import { describe, expect, it } from "vitest";
import { makeId, nowTimestamp, version } from "@concord/foundation";
import type { ContextBundle, ContextReceipt, ExecutionReceipt, WorkOrder } from "@concord/core";
import { InMemoryReviewService, InMemoryWorkService, RuntimeService } from "./index.js";

describe("workflow services", () => {
  it("claims and submits work orders", async () => {
    const work = new InMemoryWorkService();
    const workOrder = await work.createWorkOrder(workOrderInput());
    const actorId = makeId("ActorId", "worker_1");
    const claim = await work.claim({ actorId, workOrderId: workOrder.id });
    const submission = await work.submit({
      workOrderId: workOrder.id,
      submittedBy: actorId,
      contextReceipt: receipt(actorId),
      executionReceipt: executionReceipt(actorId),
      artifacts: [{ uri: "memory://artifact" }],
      summary: "done",
    });

    expect(claim.workOrderId).toBe(workOrder.id);
    expect(submission.summary).toBe("done");
  });

  it("aggregates review decisions", async () => {
    const review = new InMemoryReviewService();
    const target = { kind: "submission" as const, submissionId: makeId("SubmissionId", "submission_1") };
    await review.submitReview({
      target,
      reviewerId: makeId("ActorId", "reviewer_1"),
      result: "accept",
      rationale: "meets criteria",
      evidence: [],
      contextReceipt: receipt(makeId("ActorId", "reviewer_1")),
    });

    await expect(review.aggregate({ target })).resolves.toMatchObject({ result: "accepted" });
  });

  it("executes through a registered runtime", async () => {
    const service = new RuntimeService([
      {
        id: "mock",
        async describeCapabilities() {
          return [];
        },
        async execute(input) {
          return {
            submissionDraft: { summary: input.workOrder.title, artifacts: [] },
            executionReceipt: executionReceipt(input.actorId),
          };
        },
      },
    ]);

    await expect(
      service.execute({ actorId: makeId("ActorId", "worker_1"), workOrder: workOrder(), context: bundle() }),
    ).resolves.toMatchObject({ submissionDraft: { summary: "Create plan" } });
  });
});

function workOrderInput(): Omit<WorkOrder, "id" | "status" | "createdAt"> {
  return {
    actionId: makeId("ActionId", "action_work"),
    goalId: makeId("GoalId", "goal_work"),
    title: "Create plan",
    description: "Create an adoption plan",
    requiredCapabilities: [],
    contextBundleId: makeId("ContextBundleId", "ctx_work"),
  };
}

function workOrder(): WorkOrder {
  return {
    ...workOrderInput(),
    id: makeId("WorkOrderId", "work_1"),
    status: "open",
    createdAt: nowTimestamp(),
  };
}

function receipt(actorId = makeId("ActorId", "worker_1")): ContextReceipt {
  return {
    contextBundleId: makeId("ContextBundleId", "ctx_work"),
    stateViewId: makeId("StateViewId", "state_work"),
    stateViewVersion: version("state-1"),
    knowledgeVersionId: makeId("KnowledgeVersionId", "kv_work"),
    knowledgeHash: { algorithm: "sha256", value: "abc" },
    protocolVersion: version(),
    actionPolicyVersion: version(),
    acceptedAt: nowTimestamp(),
    actorId,
  };
}

function bundle(): ContextBundle {
  const contextReceipt = receipt();
  return {
    id: contextReceipt.contextBundleId,
    goalId: makeId("GoalId", "goal_work"),
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

function executionReceipt(actorId: ReturnType<typeof makeId<"ActorId">>): ExecutionReceipt {
  return {
    runtimeId: "mock",
    actorId,
    startedAt: nowTimestamp(),
    finishedAt: nowTimestamp(),
    inputContext: receipt(actorId),
    status: "success",
  };
}
