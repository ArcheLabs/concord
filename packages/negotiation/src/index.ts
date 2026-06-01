import type {
  Actor,
  LegacyActionIntent,
  ContextReceipt,
  DecisionRecord,
  EventStore,
  NegotiationInstance,
  NegotiationPosition,
  VotingRule,
} from "@vibly-ai/concord-core";
import { createEvent, makeId, nowTimestamp } from "@vibly-ai/concord-foundation";
import type { ProjectId } from "@vibly-ai/concord-foundation";
import { ConsistencyScorer } from "@concord/reputation";
import type { ReputationEvidenceService } from "@concord/reputation";

export type { Comment, DiscussionOutcome, DiscussionRound, DiscussionThread } from "@vibly-ai/concord-core";

export interface CreateNegotiationInput {
  action: LegacyActionIntent;
  protocolId: "delegate-fast-vote" | "simple-structured-negotiation" | string;
  participants: Actor[];
  context: ContextReceipt;
  /** Maximum revision rounds before escalation (default: 3) */
  maxRounds?: number;
  /** Weighted-average score threshold for convergence, [0,1] (default: 0.7) */
  convergenceThreshold?: number;
}

export interface ForkNegotiationInput {
  parentNegotiationId: NegotiationInstance["id"];
  newInitiator: Actor;
  participants: Actor[];
  forkReason: string;
  context: ContextReceipt;
  maxRounds?: number;
  convergenceThreshold?: number;
}

const DEFAULT_MAX_ROUNDS = 3;
const DEFAULT_CONVERGENCE_THRESHOLD = 0.7;
const scorer = new ConsistencyScorer();

export class InMemoryNegotiationService {
  private readonly instances = new Map<string, NegotiationInstance>();
  private readonly decisions = new Map<string, DecisionRecord>();

  constructor(
    private readonly eventStore?: EventStore,
    private readonly reputationService?: ReputationEvidenceService,
  ) {}

  async create(input: CreateNegotiationInput): Promise<NegotiationInstance> {
    const instance: NegotiationInstance = {
      id: makeId("NegotiationInstanceId"),
      protocolId: makeId("NegotiationProtocolId", input.protocolId),
      actionId: input.action.id,
      topic: input.action.title,
      initiator: input.action.proposedBy,
      participants: input.participants.map((p) => p.id),
      context: input.context,
      status: "collecting_positions",
      rounds: [{ index: 1, positions: [], openedAt: nowTimestamp() }],
      maxRounds: input.maxRounds ?? DEFAULT_MAX_ROUNDS,
      convergenceThreshold: input.convergenceThreshold ?? DEFAULT_CONVERGENCE_THRESHOLD,
      createdAt: nowTimestamp(),
    };
    this.instances.set(instance.id, instance);
    await this.eventStore?.append(
      createEvent({
        type: "NegotiationStarted",
        actorId: input.action.proposedBy,
        correlationId: input.action.id,
        payload: instance,
      }),
    );
    return instance;
  }

  async submitPosition(input: {
    negotiationId: NegotiationInstance["id"];
    position: NegotiationPosition;
  }): Promise<NegotiationInstance> {
    const instance = this.getOrThrow(input.negotiationId);
    const currentRound = instance.rounds.at(-1);
    if (!currentRound) {
      throw new Error(`Negotiation has no open round: ${input.negotiationId}`);
    }
    currentRound.positions = [
      ...currentRound.positions.filter((p) => p.actorId !== input.position.actorId),
      input.position,
    ];
    instance.status = "scoring";
    this.instances.set(instance.id, instance);
    await this.eventStore?.append(
      createEvent({
        type: "NegotiationPositionSubmitted",
        actorId: input.position.actorId,
        correlationId: instance.actionId,
        payload: { negotiationId: instance.id, position: input.position },
      }),
    );
    return instance;
  }

  /**
   * Close the current round.
   *
   * Convergence logic (for structured-negotiation):
   *   1. Compute weighted-average score from positions that carry a numeric score.
   *   2. If avg >= convergenceThreshold → "approved" / status "converged"
   *   3. If needs_revision AND currentRound < maxRounds → open a new round, return "needs_revision"
   *   4. If needs_revision AND currentRound >= maxRounds → "escalated" / status "failed"
   *
   * For delegate-fast-vote: falls back to quorum/threshold vote (original behaviour).
   *
   * After settling, writes ReputationEvidence for each participant when reputationService is set.
   */
  async close(input: {
    negotiationId: NegotiationInstance["id"];
    source?: DecisionRecord["source"];
    votingRule?: VotingRule;
    /** Project context required to write reputation evidence */
    projectId?: string;
  }): Promise<{ decision: DecisionRecord; instance: NegotiationInstance }> {
    const instance = this.getOrThrow(input.negotiationId);
    const currentRound = instance.rounds.at(-1)!;
    const allPositions = instance.rounds.flatMap((r) => r.positions);

    const isDelegateFastVote = String(instance.protocolId).includes("delegate-fast-vote");
    const source: DecisionRecord["source"] =
      input.source ?? (isDelegateFastVote ? "delegate_vote" : "structured_negotiation");

    let result: DecisionRecord["result"];
    let newRoundOpened = false;

    if (isDelegateFastVote) {
      // Original quorum/threshold logic
      const votingRule = input.votingRule ?? { quorum: 1, threshold: 0.5 };
      result = computeVoteResult(allPositions, votingRule);
    } else {
      // Score-based convergence for structured negotiation
      const scoredPositions = currentRound.positions.filter((p) => p.score !== undefined);
      const maxRounds = instance.maxRounds ?? DEFAULT_MAX_ROUNDS;
      const threshold = instance.convergenceThreshold ?? DEFAULT_CONVERGENCE_THRESHOLD;

      if (scoredPositions.length === 0) {
        // No scores: fall back to vote logic
        const votingRule = input.votingRule ?? { quorum: 1, threshold: 0.5 };
        result = computeVoteResult(allPositions, votingRule);
      } else {
        const weightedAvg =
          scoredPositions.reduce((sum, p) => sum + p.score!, 0) / scoredPositions.length;

        if (weightedAvg >= threshold) {
          result = "approved";
        } else if (currentRound.index < maxRounds) {
          result = "needs_revision";
          // Close current round and open next
          currentRound.closedAt = nowTimestamp();
          instance.rounds.push({
            index: currentRound.index + 1,
            positions: [],
            openedAt: nowTimestamp(),
          });
          instance.status = "revising";
          newRoundOpened = true;
        } else {
          result = "escalated";
        }
      }
    }

    // Set final instance status
    if (!newRoundOpened) {
      currentRound.closedAt = nowTimestamp();
      instance.status =
        result === "approved"
          ? "converged"
          : result === "escalated"
            ? "failed"
            : result === "needs_revision"
              ? "revising"
              : "closed";
      instance.closedAt = result !== "needs_revision" ? nowTimestamp() : undefined!;
    }

    const approvals = allPositions.filter((p) => p.stance === "support").map((p) => p.actorId);
    const rejections = allPositions.filter((p) => p.stance === "oppose").map((p) => p.actorId);
    const abstentions = allPositions.filter((p) => p.stance === "abstain").map((p) => p.actorId);
    const revisionRequests = allPositions.filter((p) => p.stance === "revise");

    const decision: DecisionRecord = {
      id: makeId("DecisionRecordId"),
      source,
      actionId: instance.actionId,
      negotiationId: instance.id,
      result,
      summary: summarizeDecision(result, approvals.length, rejections.length, abstentions.length),
      approvals,
      rejections,
      abstentions,
      unresolvedIssues: revisionRequests.map((p) => p.rationale),
      outputArtifacts: allPositions.flatMap((p) => p.evidence),
      createdAt: nowTimestamp(),
    };

    this.instances.set(instance.id, instance);
    this.decisions.set(decision.id, decision);

    await this.eventStore?.append(
      createEvent({
        type: newRoundOpened ? "NegotiationNewRoundOpened" : "NegotiationDecisionRecorded",
        correlationId: instance.actionId,
        payload: { instance, decision },
      }),
    );

    // Write reputation evidence
    if (this.reputationService && input.projectId) {
      await this.writeReputationEvidence(instance, currentRound.positions, result, input.projectId);
    }

    return { decision, instance };
  }

  /**
   * Fork this negotiation: create a new NegotiationInstance branching from the parent.
   * The fork starts fresh in round 1 with a new set of participants.
   */
  async fork(input: ForkNegotiationInput): Promise<NegotiationInstance> {
    const parent = this.getOrThrow(input.parentNegotiationId);
    const fork: NegotiationInstance = {
      id: makeId("NegotiationInstanceId"),
      protocolId: parent.protocolId,
      actionId: parent.actionId,
      topic: parent.topic,
      initiator: input.newInitiator.id,
      participants: input.participants.map((p) => p.id),
      context: input.context,
      status: "collecting_positions",
      rounds: [{ index: 1, positions: [], openedAt: nowTimestamp() }],
      maxRounds: input.maxRounds ?? parent.maxRounds ?? DEFAULT_MAX_ROUNDS,
      convergenceThreshold: input.convergenceThreshold ?? parent.convergenceThreshold ?? DEFAULT_CONVERGENCE_THRESHOLD,
      parentNegotiationId: parent.id,
      createdAt: nowTimestamp(),
    };
    this.instances.set(fork.id, fork);
    await this.eventStore?.append(
      createEvent({
        type: "NegotiationForked",
        actorId: input.newInitiator.id,
        correlationId: parent.actionId,
        payload: { fork, parentNegotiationId: parent.id, forkReason: input.forkReason },
      }),
    );
    return fork;
  }

  async get(id: NegotiationInstance["id"]): Promise<NegotiationInstance | null> {
    return this.instances.get(id) ?? null;
  }

  async list(): Promise<NegotiationInstance[]> {
    return [...this.instances.values()];
  }

  async getDecision(id: DecisionRecord["id"]): Promise<DecisionRecord | null> {
    return this.decisions.get(id) ?? null;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private getOrThrow(id: NegotiationInstance["id"]): NegotiationInstance {
    const instance = this.instances.get(id);
    if (!instance) throw new Error(`Negotiation not found: ${id}`);
    return instance;
  }

  private async writeReputationEvidence(
    instance: NegotiationInstance,
    roundPositions: NegotiationPosition[],
    result: DecisionRecord["result"],
    projectId: string,
  ): Promise<void> {
    if (!this.reputationService) return;

    const scoredPositions = roundPositions
      .filter((p) => p.score !== undefined)
      .map((p) => ({ actorId: p.actorId, score: p.score! }));

    // Peer-prediction consistency scores for this round's reviewers
    const consistency = scorer.score(scoredPositions);

    for (const position of roundPositions) {
      const cs = consistency.get(position.actorId);

      if (result === "approved" || result === "converged" as string) {
        if (position.stance === "support") {
          // Rewarded for supporting a proposal that converged
          await this.reputationService.recordEvidence(
            position.actorId,
            projectId as ProjectId,
            "delegate_participated",
            0.3,
            { rationale: `Supported negotiation ${instance.id} which converged` },
          );
        } else if (position.stance === "revise") {
          // Revision request on a round that eventually converged = valuable feedback
          await this.reputationService.recordEvidence(
            position.actorId,
            projectId as ProjectId,
            "delegate_revision_accepted",
            0.2,
            { rationale: `Revision request contributed to convergence in negotiation ${instance.id}` },
          );
        } else if (position.stance === "oppose" && result === "rejected" as string) {
          // Correct dissent
          await this.reputationService.recordEvidence(
            position.actorId,
            projectId as ProjectId,
            "review_accurate",
            0.2,
            { rationale: `Opposed negotiation ${instance.id} which was rejected` },
          );
        }
      }

      // Consensus deviation penalty: low multiplier → negative evidence
      if (cs && cs.deviation > 0.3) {
        await this.reputationService.recordEvidence(
          position.actorId,
          projectId as ProjectId,
          "review_consensus_deviation",
          -(cs.deviation * 0.5),
          { rationale: `Score deviated from peer consensus by ${cs.deviation.toFixed(2)} in negotiation ${instance.id}` },
        );
      }
    }

    // Non-response: participants who did not submit a position
    for (const participantId of instance.participants) {
      const submitted = roundPositions.some((p) => p.actorId === participantId);
      if (!submitted) {
        await this.reputationService.recordEvidence(
          participantId,
          projectId as ProjectId,
          "delegate_non_response",
          -0.2,
          { rationale: `Did not respond in negotiation ${instance.id}` },
        );
      }
    }
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function computeVoteResult(
  positions: NegotiationPosition[],
  votingRule: VotingRule,
): DecisionRecord["result"] {
  const approvals = positions.filter((p) => p.stance === "support");
  const rejections = positions.filter((p) => p.stance === "oppose");
  const abstentions = positions.filter((p) => p.stance === "abstain");
  const revisionRequests = positions.filter((p) => p.stance === "revise");
  const totalVotes = approvals.length + rejections.length + abstentions.length + revisionRequests.length;
  const approvalRatio = totalVotes === 0 ? 0 : approvals.length / totalVotes;
  const hasQuorum = totalVotes >= votingRule.quorum;

  return !hasQuorum
    ? "escalated"
    : revisionRequests.length > 0
      ? "needs_revision"
      : approvalRatio >= votingRule.threshold
        ? "approved"
        : "rejected";
}

function summarizeDecision(
  result: DecisionRecord["result"],
  approvals: number,
  rejections: number,
  abstentions: number,
): string {
  return `Decision ${result}: ${approvals} approvals, ${rejections} rejections, ${abstentions} abstentions.`;
}
