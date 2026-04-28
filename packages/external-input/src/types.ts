import type {
  ActorId,
  ArtifactRef,
  ExternalInputId,
  InputClassificationId,
  InputDeduplicationResultId,
  InputRiskAssessmentId,
  InputRoutingDecisionId,
  ObservationId,
  ObservationQueueItemId,
  ProjectId,
  ObjectiveId,
  Timestamp,
} from "@concord/foundation";

// ─── Source ─────────────────────────────────────────────────────────────────

export type ExternalInputSourceKind =
  | "human"
  | "agent"
  | "a2a_agent"
  | "forum"
  | "github_issue"
  | "github_pr"
  | "chain_event"
  | "web_page"
  | "file"
  | "manual_import"
  | "other";

export interface ExternalInputSource {
  kind: ExternalInputSourceKind;
  namespace?: string;
  externalId?: string;
  uri?: string;
  author?: string;
  observedAt?: Timestamp;
  metadata?: Record<string, unknown>;
}

// ─── Status ──────────────────────────────────────────────────────────────────

export type ExternalInputStatus =
  | "submitted"
  | "classified"
  | "deduplicated"
  | "routed"
  | "awaiting_observation"
  | "observed"
  | "accepted"
  | "rejected"
  | "archived";

// ─── Main entity ─────────────────────────────────────────────────────────────

export interface ExternalInput {
  id: ExternalInputId;
  projectId: ProjectId;
  objectiveId?: ObjectiveId;
  source: ExternalInputSource;
  submittedBy?: ActorId;
  title?: string;
  body?: string;
  artifacts: ArtifactRef[];
  status: ExternalInputStatus;
  classification?: InputClassification;
  risk?: InputRiskAssessment;
  routing?: InputRoutingDecision;
  dedupe?: InputDeduplicationResult;
  context?: Record<string, unknown>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Classification ───────────────────────────────────────────────────────────

export type InputCategory =
  | "idea"
  | "bug"
  | "risk"
  | "proposal"
  | "task_suggestion"
  | "knowledge_candidate"
  | "spam"
  | "question"
  | "status_update"
  | "unknown";

export interface InputClassification {
  id: InputClassificationId;
  inputId: ExternalInputId;
  classifiedBy: "rule_engine" | "llm" | "human" | ActorId;
  category: InputCategory;
  confidence?: number;
  labels: string[];
  rationale?: string;
  createdAt: Timestamp;
}

// ─── Risk Assessment ──────────────────────────────────────────────────────────

export type InputRiskLevel = "low" | "medium" | "high" | "critical";

export type InputRiskFlag =
  | "prompt_injection"
  | "financial_impact"
  | "governance_impact"
  | "malicious_link"
  | "spam"
  | "pii"
  | "off_topic";

export interface InputRiskAssessment {
  id: InputRiskAssessmentId;
  inputId: ExternalInputId;
  assessedBy: "rule_engine" | "llm" | "human" | ActorId;
  riskLevel: InputRiskLevel;
  flags: InputRiskFlag[];
  rationale?: string;
  createdAt: Timestamp;
}

// ─── Routing ──────────────────────────────────────────────────────────────────

export type InputRoute =
  | "observation_queue"
  | "knowledge_candidate_queue"
  | "action_suggestion_queue"
  | "guardian_review"
  | "archive"
  | "reject";

export interface InputRoutingDecision {
  id: InputRoutingDecisionId;
  inputId: ExternalInputId;
  routedBy: "rule_engine" | "llm" | "human" | ActorId;
  route: InputRoute;
  target?: ObjectiveId;
  reason: string;
  createdAt: Timestamp;
}

// ─── Deduplication ────────────────────────────────────────────────────────────

export type DedupeMatchMethod = "hash" | "source_external_id" | "uri" | "semantic" | "manual";

export interface InputDeduplicationResult {
  id: InputDeduplicationResultId;
  inputId: ExternalInputId;
  isDuplicate: boolean;
  duplicateOf?: ExternalInputId;
  similarityScore?: number;
  matchedBy: DedupeMatchMethod;
  createdAt: Timestamp;
}

// ─── Observation Queue ────────────────────────────────────────────────────────

export type ObservationQueueItemPriority = "low" | "normal" | "high" | "urgent";
export type ObservationQueueItemStatus =
  | "queued"
  | "assigned"
  | "observed"
  | "expired"
  | "archived";

export interface ObservationQueueItem {
  id: ObservationQueueItemId;
  projectId: ProjectId;
  objectiveId?: ObjectiveId;
  inputId: ExternalInputId;
  priority: ObservationQueueItemPriority;
  status: ObservationQueueItemStatus;
  assignedObserverId?: ActorId;
  candidateObserverId?: ActorId;
  leaseId?: string; // LeaseId from selection package
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Observation ──────────────────────────────────────────────────────────────

export type ObservationOutcome = "accepted" | "rejected" | "knowledge_candidate" | "deferred";

export interface Observation {
  id: ObservationId;
  queueItemId: ObservationQueueItemId;
  inputId: ExternalInputId;
  observerId: ActorId;
  projectId: ProjectId;
  objectiveId?: ObjectiveId;
  outcome: ObservationOutcome;
  summary: string;
  artifacts: ArtifactRef[];
  createdAt: Timestamp;
}

// ─── Service Interface ────────────────────────────────────────────────────────

export interface ExternalInputFilter {
  projectId?: ProjectId;
  objectiveId?: ObjectiveId;
  status?: ExternalInputStatus;
  category?: InputCategory;
}

export interface ExternalInputService {
  submit(
    projectId: ProjectId,
    source: ExternalInputSource,
    opts?: {
      objectiveId?: ObjectiveId;
      submittedBy?: ActorId;
      title?: string;
      body?: string;
      artifacts?: ArtifactRef[];
    },
  ): Promise<ExternalInput>;

  classify(inputId: ExternalInputId): Promise<InputClassification>;
  assessRisk(inputId: ExternalInputId): Promise<InputRiskAssessment>;
  deduplicate(inputId: ExternalInputId): Promise<InputDeduplicationResult>;
  route(inputId: ExternalInputId): Promise<InputRoutingDecision>;

  enqueueForObservation(
    inputId: ExternalInputId,
    opts?: { priority?: ObservationQueueItemPriority; objectiveId?: ObjectiveId },
  ): Promise<ObservationQueueItem>;

  assignObserver(
    queueItemId: ObservationQueueItemId,
    observerId: ActorId,
    leaseId?: string,
  ): Promise<ObservationQueueItem>;

  recordObservation(
    queueItemId: ObservationQueueItemId,
    observerId: ActorId,
    outcome: ObservationOutcome,
    summary: string,
    artifacts?: ArtifactRef[],
  ): Promise<Observation>;

  getInput(id: ExternalInputId): Promise<ExternalInput | undefined>;
  listInputs(filter?: ExternalInputFilter): Promise<ExternalInput[]>;
  listQueueItems(projectId: ProjectId, status?: ObservationQueueItemStatus): Promise<ObservationQueueItem[]>;

  /** Run full pipeline: submit → classify → risk → dedupe → route → maybe enqueue */
  processInput(
    projectId: ProjectId,
    source: ExternalInputSource,
    opts?: {
      objectiveId?: ObjectiveId;
      submittedBy?: ActorId;
      title?: string;
      body?: string;
      artifacts?: ArtifactRef[];
    },
  ): Promise<{ input: ExternalInput; queueItem?: ObservationQueueItem }>;
}
