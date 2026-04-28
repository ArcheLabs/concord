import { makeId, nowTimestamp } from "@concord/foundation";
import type { ActorId, ArtifactRef, ObjectiveId, ProjectId, ReviewRecordId, SubmissionId, WorkOrderId } from "@concord/foundation";
import type {
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

  async listEvidence(filter?: ReputationEvidenceFilter): Promise<ReputationEvidence[]> {
    let results = [...this.evidence.values()];
    if (filter?.actorId) results = results.filter((e) => e.actorId === filter.actorId);
    if (filter?.projectId) results = results.filter((e) => e.projectId === filter.projectId);
    if (filter?.kind) results = results.filter((e) => e.kind === filter.kind);
    return results;
  }
}
