import { makeId, nowTimestamp } from "@concord/foundation";
import type { ActorId, ArtifactRef, ObjectiveId, ProjectId, ReviewRecordId, SubmissionId, WorkOrderId } from "@concord/foundation";
import type {
  ConsistencyScore,
  ReputationEvidence,
  ReputationEvidenceFilter,
  ReputationEvidenceKind,
  ReputationEvidenceService,
  ReputationScore,
} from "./types.js";

export class InMemoryReputationEvidenceService implements ReputationEvidenceService {
  private evidence = new Map<string, ReputationEvidence>();

  async recordEvidence(
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
  ): Promise<ReputationEvidence> {
    const ev: ReputationEvidence = {
      id: makeId("ReputationEvidenceId"),
      actorId,
      projectId,
      kind,
      score,
      weight: opts?.weight ?? 1.0,
      artifacts: opts?.artifacts ?? [],
      createdAt: nowTimestamp(),
      ...(opts?.objectiveId !== undefined && { objectiveId: opts.objectiveId }),
      ...(opts?.workOrderId !== undefined && { workOrderId: opts.workOrderId }),
      ...(opts?.submissionId !== undefined && { submissionId: opts.submissionId }),
      ...(opts?.reviewRecordId !== undefined && { reviewRecordId: opts.reviewRecordId }),
      ...(opts?.rationale !== undefined && { rationale: opts.rationale }),
    };
    this.evidence.set(ev.id, ev);
    return ev;
  }

  async getScore(actorId: ActorId, projectId: ProjectId): Promise<ReputationScore> {
    const relevant = [...this.evidence.values()].filter(
      (e) => e.actorId === actorId && e.projectId === projectId,
    );
    let weightedSum = 0;
    let totalWeight = 0;
    for (const e of relevant) {
      weightedSum += e.score * e.weight;
      totalWeight += e.weight;
    }
    const raw = totalWeight > 0 ? weightedSum / totalWeight : 0;
    // Clamp to [-1, 1]
    const normalizedScore = Math.max(-1, Math.min(1, raw));
    return {
      actorId,
      projectId,
      weightedSum,
      totalWeight,
      normalizedScore,
      evidenceCount: relevant.length,
      computedAt: nowTimestamp(),
    };
  }

  /**
   * Exponential Moving Average score over time-ordered evidence.
   * Each new evidence updates: ema = (1 - λ) * ema + λ * score * weight
   * Smaller decayFactor → longer memory (older evidence decays slower).
   * Default λ = 0.1
   */
  async getEmaScore(actorId: ActorId, projectId: ProjectId, decayFactor = 0.1): Promise<ReputationScore> {
    const relevant = [...this.evidence.values()]
      .filter((e) => e.actorId === actorId && e.projectId === projectId)
      .sort((a, b) => a.createdAt.iso.localeCompare(b.createdAt.iso));

    let ema = 0;
    let totalWeight = 0;
    for (const e of relevant) {
      ema = (1 - decayFactor) * ema + decayFactor * e.score * e.weight;
      totalWeight += e.weight;
    }
    const normalizedScore = Math.max(-1, Math.min(1, ema));
    return {
      actorId,
      projectId,
      weightedSum: ema,
      totalWeight,
      normalizedScore,
      evidenceCount: relevant.length,
      computedAt: nowTimestamp(),
    };
  }

  async listEvidence(filter?: ReputationEvidenceFilter): Promise<ReputationEvidence[]> {
    let results = [...this.evidence.values()];
    if (filter?.actorId) results = results.filter((e) => e.actorId === filter.actorId);
    if (filter?.projectId) results = results.filter((e) => e.projectId === filter.projectId);
    if (filter?.kind) results = results.filter((e) => e.kind === filter.kind);
    return results;
  }
}

// ─── Consistency Scorer ───────────────────────────────────────────────────────

/**
 * Peer-prediction consistency scorer.
 *
 * For each reporter i with score s_i:
 *   peerMean_i = mean(s_j for j ≠ i)
 *   deviation_i = |s_i - peerMean_i|  (capped at 1)
 *   multiplier_i = 1 - deviation_i  ∈ [0, 1]
 *
 * Reporters who deviate most from peer consensus receive the lowest multiplier.
 * Use this multiplier to scale review_reward amounts.
 */
export class ConsistencyScorer {
  /**
   * @param positions Array of { actorId, score } where score ∈ [0, 1]
   * @returns Map from actorId to ConsistencyScore
   */
  score(positions: ReadonlyArray<{ actorId: ActorId; score: number }>): Map<ActorId, ConsistencyScore> {
    const results = new Map<ActorId, ConsistencyScore>();
    if (positions.length === 0) return results;

    // Single reporter: perfect consensus by definition
    if (positions.length === 1) {
      const p = positions[0]!;
      results.set(p.actorId, {
        actorId: p.actorId,
        reportedScore: p.score,
        peerMean: p.score,
        deviation: 0,
        multiplier: 1,
      });
      return results;
    }

    const total = positions.reduce((sum, p) => sum + p.score, 0);

    for (const p of positions) {
      const peerSum = total - p.score;
      const peerMean = peerSum / (positions.length - 1);
      const deviation = Math.min(1, Math.abs(p.score - peerMean));
      const multiplier = 1 - deviation;
      results.set(p.actorId, {
        actorId: p.actorId,
        reportedScore: p.score,
        peerMean,
        deviation,
        multiplier,
      });
    }
    return results;
  }
}
