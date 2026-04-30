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
} from "@concord/core";
import { createEvent, type ActorId, type WorkOrderId, makeId, nowTimestamp } from "@concord/foundation";
import type { ProjectStore, RuntimeBinding } from "@concord/project";

export class InMemoryWorkService {
  private readonly workOrders = new Map<WorkOrderId, WorkOrder>();
  private readonly claims = new Map<string, WorkClaim>();
  private readonly submissions = new Map<string, Submission>();

  constructor(
    private readonly eventStore?: EventStore,
    private readonly options: { projectStore?: ProjectStore } = {},
  ) {}

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

  async listWorkOrders(): Promise<WorkOrder[]> {
    return [...this.workOrders.values()];
  }

  async getWorkOrder(id: WorkOrderId): Promise<WorkOrder | null> {
    return this.workOrders.get(id) ?? null;
  }

  async claim(input: { actorId: ActorId; workOrderId: WorkOrderId; leaseMs?: number }): Promise<WorkClaim> {
    const workOrder = this.getWorkOrderOrThrow(input.workOrderId);
    if (workOrder.status !== "open") {
      throw new Error(`Work order is not open: ${input.workOrderId}`);
    }
    await this.assertProjectMembership(workOrder, input.actorId);
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
      ...(workOrder.projectId ? { projectId: workOrder.projectId } : {}),
      ...(workOrder.objectiveId ? { objectiveId: workOrder.objectiveId } : {}),
      ...(input.executionReceipt.principalId ? { principalId: input.executionReceipt.principalId } : {}),
      ...(input.executionReceipt.agentId ? { agentId: input.executionReceipt.agentId } : {}),
      ...(input.executionReceipt.runtimeBindingId ? { runtimeBindingId: input.executionReceipt.runtimeBindingId } : {}),
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

  private async assertProjectMembership(workOrder: WorkOrder, actorId: ActorId): Promise<void> {
    if (!workOrder.projectId || !this.options.projectStore) return;
    const agent = await this.options.projectStore.getAgent(actorId as never);
    if (!agent || agent.status !== "active") throw new Error(`Agent is not active project member: ${actorId}`);
    const principal = await this.options.projectStore.getPrincipal(agent.principalId);
    if (!principal || principal.status !== "active") throw new Error(`Principal is not active for agent: ${actorId}`);
    const membership = await this.options.projectStore.findMembership({ projectId: workOrder.projectId, agentId: agent.id });
    if (!membership || membership.status !== "active") throw new Error(`Active project membership not found for agent: ${actorId}`);
  }
}

export class RuntimeService {
  private readonly runtimes = new Map<string, AgentRuntimeAdapter>();

  constructor(
    runtimes: AgentRuntimeAdapter[] = [],
    private readonly options: { projectStore?: ProjectStore } = {},
  ) {
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
    runtimeBindingId?: RuntimeBinding["id"];
  }): Promise<RuntimeExecutionResult> {
    const runtimeBinding = await this.assertRuntimeBinding(input);
    const runtime = input.runtimeId ? this.runtimes.get(input.runtimeId) : this.runtimes.values().next().value;
    if (!runtime) {
      throw new Error("No runtime adapter registered");
    }
    const result = await runtime.execute({ actorId: input.actorId, workOrder: input.workOrder, context: input.context });
    if (!runtimeBinding && !input.context.projectId) return result;
    return {
      ...result,
      executionReceipt: {
        ...result.executionReceipt,
        ...(input.context.projectId ? { projectId: input.context.projectId } : {}),
        ...(input.context.objectiveId ? { objectiveId: input.context.objectiveId } : {}),
        ...(runtimeBinding ? { principalId: runtimeBinding.principalId, agentId: runtimeBinding.agentId, runtimeBindingId: runtimeBinding.id } : {}),
      },
    };
  }

  private async assertRuntimeBinding(input: {
    actorId: ActorId;
    context: ContextBundle;
    runtimeBindingId?: RuntimeBinding["id"];
  }): Promise<RuntimeBinding | null> {
    const runtimeBindingId = input.runtimeBindingId ?? input.context.permissionScope?.runtimeBindingId;
    if (!runtimeBindingId || !this.options.projectStore) return null;
    const binding = await this.options.projectStore.getRuntimeBinding(runtimeBindingId as never);
    if (!binding || binding.status !== "active") throw new Error(`Runtime binding is not active: ${runtimeBindingId}`);
    if (binding.agentId !== (input.actorId as never)) throw new Error(`Runtime binding does not belong to actor: ${input.actorId}`);
    return binding;
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
