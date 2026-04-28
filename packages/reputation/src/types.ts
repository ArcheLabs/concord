import type {
  ActorId,
  ArtifactRef,
  ProjectId,
  ObjectiveId,
  ReputationEvidenceId,
  ReviewRecordId,
  SubmissionId,
  Timestamp,
  WorkOrderId,
} from "@concord/foundation";

// ─── Evidence Kind ────────────────────────────────────────────────────────────

export type ReputationEvidenceKind =
  | "work_accepted"
  | "work_rejected"
  | "review_accurate"
  | "review_inaccurate"
  | "observation_completed"
  | "delegate_participated"
  | "delegate_non_response"
  | "knowledge_committed"
  | "knowledge_rejected"
  | "failover_triggered"
  | "guardian_escalation"
  | "slash"
  | "tip";

// ─── Evidence ────────────────────────────────────────────────────────────────

export interface ReputationEvidence {
  id: ReputationEvidenceId;
  actorId: ActorId;
  projectId: ProjectId;
  objectiveId?: ObjectiveId;
  kind: ReputationEvidenceKind;
  /** Positive: good signal, Negative: bad signal */
  score: number;
  weight: number;
  workOrderId?: WorkOrderId;
  submissionId?: SubmissionId;
  reviewRecordId?: ReviewRecordId;
  rationale?: string;
  artifacts: ArtifactRef[];
  createdAt: Timestamp;
}

// ─── Score Aggregate ─────────────────────────────────────────────────────────

export interface ReputationScore {
  actorId: ActorId;
  projectId: ProjectId;
  weightedSum: number;
  totalWeight: number;
  normalizedScore: number; // -1.0 to 1.0
  evidenceCount: number;
  computedAt: Timestamp;
}

// ─── Service Interface ────────────────────────────────────────────────────────

export interface ReputationEvidenceFilter {
  actorId?: ActorId;
  projectId?: ProjectId;
  kind?: ReputationEvidenceKind;
}

export interface ReputationEvidenceService {
  recordEvidence(
    actorId: ActorId,
    projectId: ProjectId,
    kind: ReputationEvidenceKind,
    score: number,
    opts?: {
      objectiveId?: ObjectiveId;
      weight?: number;
      workOrderId?: WorkOrderId;
      submissionId?: SubmissionId;
      reviewRecordId?: ReviewRecordId;
      rationale?: string;
      artifacts?: ArtifactRef[];
    },
  ): Promise<ReputationEvidence>;

  getScore(actorId: ActorId, projectId: ProjectId): Promise<ReputationScore>;

  listEvidence(filter?: ReputationEvidenceFilter): Promise<ReputationEvidence[]>;
}
