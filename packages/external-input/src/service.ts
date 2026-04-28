import { makeId, nowTimestamp } from "@concord/foundation";
import type {
  ActorId,
  ArtifactRef,
  ExternalInputId,
  ObservationQueueItemId,
  ObjectiveId,
  ProjectId,
} from "@concord/foundation";
import type {
  ExternalInput,
  ExternalInputFilter,
  ExternalInputService,
  ExternalInputSource,
  InputClassification,
  InputDeduplicationResult,
  InputRiskAssessment,
  InputRoutingDecision,
  Observation,
  ObservationOutcome,
  ObservationQueueItem,
  ObservationQueueItemPriority,
  ObservationQueueItemStatus,
} from "./types.js";
import type { InputClassifier, InputDeduper, InputRiskAssessor, InputRouter } from "./ports.js";
import { DefaultInputClassifier } from "./classifier.js";
import { DefaultRiskAssessor } from "./risk.js";
import { DefaultDeduper } from "./deduper.js";
import { DefaultInputRouter } from "./router.js";
import { checkExternalInputInvariants } from "./invariants.js";

export class InMemoryExternalInputService implements ExternalInputService {
  private inputs = new Map<string, ExternalInput>();
  private queueItems = new Map<string, ObservationQueueItem>();
  private observations = new Map<string, Observation>();

  constructor(
    private readonly classifier: InputClassifier = new DefaultInputClassifier(),
    private readonly riskAssessor: InputRiskAssessor = new DefaultRiskAssessor(),
    private readonly deduper: InputDeduper = new DefaultDeduper(),
    private readonly router: InputRouter = new DefaultInputRouter(),
  ) {}

  async submit(
    projectId: ProjectId,
    source: ExternalInputSource,
    opts?: {
      objectiveId?: ObjectiveId;
      submittedBy?: ActorId;
      title?: string;
      body?: string;
      artifacts?: ArtifactRef[];
    },
  ): Promise<ExternalInput> {
    const now = nowTimestamp();
    const input: ExternalInput = {
      id: makeId("ExternalInputId"),
      projectId,
      source,
      artifacts: opts?.artifacts ?? [],
      status: "submitted",
      createdAt: now,
      updatedAt: now,
      ...(opts?.objectiveId !== undefined && { objectiveId: opts.objectiveId }),
      ...(opts?.submittedBy !== undefined && { submittedBy: opts.submittedBy }),
      ...(opts?.title !== undefined && { title: opts.title }),
      ...(opts?.body !== undefined && { body: opts.body }),
    };
    this.inputs.set(input.id, input);
    return input;
  }

  async classify(inputId: ExternalInputId): Promise<InputClassification> {
    const input = this.mustGet(inputId);
    const result = await this.classifier.classify(input);
    const classification: InputClassification = {
      ...result,
      id: makeId("InputClassificationId"),
      createdAt: nowTimestamp(),
    };
    const updated: ExternalInput = {
      ...input,
      classification,
      status: "classified",
      updatedAt: nowTimestamp(),
    };
    this.inputs.set(inputId, updated);
    return classification;
  }

  async assessRisk(inputId: ExternalInputId): Promise<InputRiskAssessment> {
    const input = this.mustGet(inputId);
    const result = await this.riskAssessor.assess(input);
    const assessment: InputRiskAssessment = {
      ...result,
      id: makeId("InputRiskAssessmentId"),
      createdAt: nowTimestamp(),
    };
    const updated: ExternalInput = {
      ...input,
      risk: assessment,
      updatedAt: nowTimestamp(),
    };
    this.inputs.set(inputId, updated);
    return assessment;
  }

  async deduplicate(inputId: ExternalInputId): Promise<InputDeduplicationResult> {
    const input = this.mustGet(inputId);
    const existing = [...this.inputs.values()].filter((e) => e.id !== inputId);
    const result = await this.deduper.deduplicate(input, existing);
    const dedupeResult: InputDeduplicationResult = {
      ...result,
      id: makeId("InputDeduplicationResultId"),
      createdAt: nowTimestamp(),
    };
    const updated: ExternalInput = {
      ...input,
      dedupe: dedupeResult,
      status: "deduplicated",
      updatedAt: nowTimestamp(),
    };
    this.inputs.set(inputId, updated);
    return dedupeResult;
  }

  async route(inputId: ExternalInputId): Promise<InputRoutingDecision> {
    const input = this.mustGet(inputId);
    const result = await this.router.route(input);
    const decision: InputRoutingDecision = {
      inputId,
      routedBy: "rule_engine",
      route: result.route,
      reason: result.reason,
      id: makeId("InputRoutingDecisionId"),
      createdAt: nowTimestamp(),
    };

    let newStatus = input.status;
    if (result.route === "reject") newStatus = "rejected";
    else if (result.route === "archive") newStatus = "archived";
    else newStatus = "routed";

    const updated: ExternalInput = {
      ...input,
      routing: decision,
      status: newStatus,
      updatedAt: nowTimestamp(),
    };
    this.inputs.set(inputId, updated);
    return decision;
  }

  async enqueueForObservation(
    inputId: ExternalInputId,
    opts?: { priority?: ObservationQueueItemPriority; objectiveId?: ObjectiveId },
  ): Promise<ObservationQueueItem> {
    const input = this.mustGet(inputId);
    checkExternalInputInvariants(input, "enqueueForObservation");

    const now = nowTimestamp();
    const item: ObservationQueueItem = {
      id: makeId("ObservationQueueItemId"),
      projectId: input.projectId,
      inputId,
      priority: opts?.priority ?? "normal",
      status: "queued",
      createdAt: now,
      updatedAt: now,
      ...(opts?.objectiveId !== undefined && { objectiveId: opts.objectiveId }),
    };
    this.queueItems.set(item.id, item);

    const updated: ExternalInput = {
      ...input,
      status: "awaiting_observation",
      updatedAt: nowTimestamp(),
    };
    this.inputs.set(inputId, updated);
    return item;
  }

  async assignObserver(
    queueItemId: ObservationQueueItemId,
    observerId: ActorId,
    leaseId?: string,
  ): Promise<ObservationQueueItem> {
    const item = this.queueItems.get(queueItemId);
    if (!item) throw new Error(`ObservationQueueItem not found: ${queueItemId}`);
    const updated: ObservationQueueItem = {
      ...item,
      assignedObserverId: observerId,
      leaseId,
      status: "assigned",
      updatedAt: nowTimestamp(),
    };
    this.queueItems.set(queueItemId, updated);
    return updated;
  }

  async recordObservation(
    queueItemId: ObservationQueueItemId,
    observerId: ActorId,
    outcome: ObservationOutcome,
    summary: string,
    artifacts: ArtifactRef[] = [],
  ): Promise<Observation> {
    const item = this.queueItems.get(queueItemId);
    if (!item) throw new Error(`ObservationQueueItem not found: ${queueItemId}`);

    const observation: Observation = {
      id: makeId("ObservationId"),
      queueItemId,
      inputId: item.inputId,
      observerId,
      projectId: item.projectId,
      outcome,
      summary,
      artifacts,
      createdAt: nowTimestamp(),
      ...(item.objectiveId !== undefined && { objectiveId: item.objectiveId }),
    };
    this.observations.set(observation.id, observation);

    // Update queue item status
    const updatedItem: ObservationQueueItem = { ...item, status: "observed", updatedAt: nowTimestamp() };
    this.queueItems.set(queueItemId, updatedItem);

    // Update input status
    const input = this.inputs.get(item.inputId);
    if (input) {
      const newStatus = outcome === "accepted" ? "accepted" : outcome === "rejected" ? "rejected" : "observed";
      this.inputs.set(item.inputId, { ...input, status: newStatus, updatedAt: nowTimestamp() });
    }

    return observation;
  }

  async getInput(id: ExternalInputId): Promise<ExternalInput | undefined> {
    return this.inputs.get(id);
  }

  async listInputs(filter?: ExternalInputFilter): Promise<ExternalInput[]> {
    let results = [...this.inputs.values()];
    if (filter?.projectId) results = results.filter((i) => i.projectId === filter.projectId);
    if (filter?.objectiveId) results = results.filter((i) => i.objectiveId === filter.objectiveId);
    if (filter?.status) results = results.filter((i) => i.status === filter.status);
    if (filter?.category) results = results.filter((i) => i.classification?.category === filter.category);
    return results;
  }

  async listQueueItems(
    projectId: ProjectId,
    status?: ObservationQueueItemStatus,
  ): Promise<ObservationQueueItem[]> {
    let results = [...this.queueItems.values()].filter((i) => i.projectId === projectId);
    if (status) results = results.filter((i) => i.status === status);
    return results;
  }

  async processInput(
    projectId: ProjectId,
    source: ExternalInputSource,
    opts?: {
      objectiveId?: ObjectiveId;
      submittedBy?: ActorId;
      title?: string;
      body?: string;
      artifacts?: ArtifactRef[];
    },
  ): Promise<{ input: ExternalInput; queueItem?: ObservationQueueItem }> {
    const input = await this.submit(projectId, source, opts);

    await this.classify(input.id);
    await this.assessRisk(input.id);
    await this.deduplicate(input.id);
    const routing = await this.route(input.id);

    const final = await this.getInput(input.id);

    if (routing.route === "observation_queue") {
      const queueItem = await this.enqueueForObservation(input.id, {
        objectiveId: opts?.objectiveId,
      });
      const afterEnqueue = await this.getInput(input.id);
      return { input: afterEnqueue ?? final ?? input, queueItem };
    }

    return { input: final ?? input };
  }

  private mustGet(id: ExternalInputId): ExternalInput {
    const input = this.inputs.get(id);
    if (!input) throw new Error(`ExternalInput not found: ${id}`);
    return input;
  }
}
