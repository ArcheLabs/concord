import type {
  AgentRuntimeAdapter,
  ContextBundle,
  ContextReceipt,
  DecisionRecord,
  EventStore,
  ExecutionReceipt,
  ReviewAggregation,
  ReviewRecord,
  ReviewTarget,
  RuntimeExecutionResult,
  Submission,
  WorkClaim,
  WorkOrder,
} from "@ascf/core";
import { createEvent, type ActorId, type WorkOrderId, makeId, nowTimestamp } from "@ascf/foundation";

export class InMemoryWorkService {
  private readonly workOrders = new Map<WorkOrderId, WorkOrder>();
  private readonly claims = new Map<string, WorkClaim>();
  private readonly submissions = new Map<string, Submission>();

  constructor(private readonly eventStore?: EventStore) {}

  async createWorkOrder(input: Omit<WorkOrder, "id" | "status" | "createdAt"> & { id?: WorkOrderId }): Promise<WorkOrder> {
    const workOrder: WorkOrder = {
      ...input,
      id: input.id ?? makeId("WorkOrderId"),
      status: "open",
      createdAt: nowTimestamp(),
    };
    this.workOrders.set(workOrder.id, workOrder);
    await this.eventStore?.append(createEvent({ type: "WorkOrderCreated", correlationId: workOrder.actionId, payload: workOrder }));
    return workOrder;
  }

  async listOpenWorkOrders(): Promise<WorkOrder[]> {
    return [...this.workOrders.values()].filter((workOrder) => workOrder.status === "open");
  }

  async getWorkOrder(id: WorkOrderId): Promise<WorkOrder | null> {
    return this.workOrders.get(id) ?? null;
  }

  async claim(input: { actorId: ActorId; workOrderId: WorkOrderId; leaseMs?: number }): Promise<WorkClaim> {
    const workOrder = this.getWorkOrderOrThrow(input.workOrderId);
    if (workOrder.status !== "open") {
      throw new Error(`Work order is not open: ${input.workOrderId}`);
    }
    const claim: WorkClaim = {
      id: makeId("WorkClaimId"),
      workOrderId: input.workOrderId,
      actorId: input.actorId,
      claimedAt: nowTimestamp(),
      ...(input.leaseMs ? { leaseUntil: { iso: new Date(Date.now() + input.leaseMs).toISOString() } } : {}),
    };
    this.claims.set(claim.id, claim);
    this.workOrders.set(workOrder.id, { ...workOrder, status: "claimed" });
    await this.eventStore?.append(
      createEvent({ type: "WorkOrderClaimed", actorId: input.actorId, correlationId: workOrder.actionId, payload: claim }),
    );
    return claim;
  }

  async submit(input: {
    workOrderId: WorkOrderId;
    submittedBy: ActorId;
    contextReceipt: ContextReceipt;
    executionReceipt: ExecutionReceipt;
    artifacts: Submission["artifacts"];
    summary: string;
  }): Promise<Submission> {
    const workOrder = this.getWorkOrderOrThrow(input.workOrderId);
    if (workOrder.status !== "claimed" && workOrder.status !== "open") {
      throw new Error(`Work order cannot be submitted from status ${workOrder.status}`);
    }
    const submission: Submission = {
      id: makeId("SubmissionId"),
      workOrderId: input.workOrderId,
      submittedBy: input.submittedBy,
      contextReceipt: input.contextReceipt,
      executionReceipt: input.executionReceipt,
      artifacts: input.artifacts,
      summary: input.summary,
      submittedAt: nowTimestamp(),
    };
    this.submissions.set(submission.id, submission);
    this.workOrders.set(workOrder.id, { ...workOrder, status: "submitted" });
    await this.eventStore?.append(
      createEvent({ type: "WorkSubmitted", actorId: input.submittedBy, correlationId: workOrder.actionId, payload: submission }),
    );
    return submission;
  }

  async markUnderReview(workOrderId: WorkOrderId): Promise<WorkOrder> {
    return this.updateStatus(workOrderId, "under_review");
  }

  async accept(workOrderId: WorkOrderId): Promise<WorkOrder> {
    return this.updateStatus(workOrderId, "accepted");
  }

  async reject(workOrderId: WorkOrderId): Promise<WorkOrder> {
    return this.updateStatus(workOrderId, "rejected");
  }

  async expire(input: { workOrderId: WorkOrderId; reason: string }): Promise<void> {
    const workOrder = await this.updateStatus(input.workOrderId, "expired");
    await this.eventStore?.append(
      createEvent({ type: "WorkOrderExpired", correlationId: workOrder.actionId, payload: { workOrder, reason: input.reason } }),
    );
  }

  async getSubmission(id: Submission["id"]): Promise<Submission | null> {
    return this.submissions.get(id) ?? null;
  }

  private async updateStatus(id: WorkOrderId, status: WorkOrder["status"]): Promise<WorkOrder> {
    const workOrder = this.getWorkOrderOrThrow(id);
    const updated = { ...workOrder, status };
    this.workOrders.set(id, updated);
    return updated;
  }

  private getWorkOrderOrThrow(id: WorkOrderId): WorkOrder {
    const workOrder = this.workOrders.get(id);
    if (!workOrder) {
      throw new Error(`Work order not found: ${id}`);
    }
    return workOrder;
  }
}

export class RuntimeService {
  private readonly runtimes = new Map<string, AgentRuntimeAdapter>();

  constructor(runtimes: AgentRuntimeAdapter[] = []) {
    for (const runtime of runtimes) {
      this.runtimes.set(runtime.id, runtime);
    }
  }

  register(runtime: AgentRuntimeAdapter): void {
    this.runtimes.set(runtime.id, runtime);
  }

  async execute(input: {
    runtimeId?: string;
    actorId: ActorId;
    workOrder: WorkOrder;
    context: ContextBundle;
  }): Promise<RuntimeExecutionResult> {
    const runtime = input.runtimeId ? this.runtimes.get(input.runtimeId) : this.runtimes.values().next().value;
    if (!runtime) {
      throw new Error("No runtime adapter registered");
    }
    return runtime.execute({ actorId: input.actorId, workOrder: input.workOrder, context: input.context });
  }
}

export class InMemoryReviewService {
  private readonly records: ReviewRecord[] = [];

  constructor(private readonly eventStore?: EventStore) {}

  async requestReview(input: { target: ReviewTarget; requestedBy: ActorId }): Promise<void> {
    await this.eventStore?.append(createEvent({ type: "WorkReviewRequested", actorId: input.requestedBy, payload: input }));
  }

  async submitReview(input: Omit<ReviewRecord, "id" | "createdAt">): Promise<ReviewRecord> {
    const record: ReviewRecord = {
      ...input,
      id: makeId("ReviewRecordId"),
      createdAt: nowTimestamp(),
    };
    this.records.push(record);
    await this.eventStore?.append(
      createEvent({ type: "WorkReviewSubmitted", actorId: input.reviewerId, payload: record }),
    );
    return record;
  }

  async aggregate(input: { target: ReviewTarget }): Promise<ReviewAggregation> {
    const records = this.records.filter((record) => sameTarget(record.target, input.target));
    if (!records.length) {
      return { target: input.target, result: "pending", records };
    }
    if (records.some((record) => record.result === "escalate")) {
      return { target: input.target, result: "escalated", records };
    }
    if (records.some((record) => record.result === "needs_revision")) {
      return { target: input.target, result: "needs_revision", records };
    }
    const accepts = records.filter((record) => record.result === "accept").length;
    const rejects = records.filter((record) => record.result === "reject").length;
    return { target: input.target, result: accepts >= rejects ? "accepted" : "rejected", records };
  }

  async finalize(input: { target: ReviewTarget; decisionRecord: DecisionRecord }): Promise<void> {
    await this.eventStore?.append(createEvent({ type: "ReviewFinalized", payload: input }));
  }
}

function sameTarget(left: ReviewTarget, right: ReviewTarget): boolean {
  if (left.kind !== right.kind) return false;
  switch (left.kind) {
    case "submission":
      return left.submissionId === (right as { kind: "submission"; submissionId: string }).submissionId;
    case "knowledge_candidate":
      return left.candidateId === (right as { kind: "knowledge_candidate"; candidateId: string }).candidateId;
    case "action":
      return left.actionId === (right as { kind: "action"; actionId: string }).actionId;
  }
}
