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
  | "delegate_revision_accepted"
  | "review_consensus_deviation"
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

// ─── Consistency Score ────────────────────────────────────────────────────────

/**
 * Per-actor result from ConsistencyScorer.
 * multiplier ∈ [0,1]: 1 = perfect peer consensus, 0 = maximum deviation.
 */
export interface ConsistencyScore {
  actorId: ActorId;
  /** Raw reported score */
  reportedScore: number;
  /** Mean of all other reporters (excluding this actor) */
  peerMean: number;
  /** Absolute deviation from peer mean, normalised to [0,1] */
  deviation: number;
  /** Reward multiplier: 1 - deviation */
  multiplier: number;
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

  /**
   * Exponential Moving Average score over time-ordered evidence.
   * decayFactor ∈ (0,1]: smaller = longer memory. Default: 0.1
   */
  getEmaScore(actorId: ActorId, projectId: ProjectId, decayFactor?: number): Promise<ReputationScore>;

  listEvidence(filter?: ReputationEvidenceFilter): Promise<ReputationEvidence[]>;
}
