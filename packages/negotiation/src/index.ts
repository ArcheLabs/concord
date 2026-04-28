import type {
  Actor,
  ActionIntent,
  ContextReceipt,
  DecisionRecord,
  EventStore,
  NegotiationInstance,
  NegotiationPosition,
  VotingRule,
} from "@ascf/core";
import { createEvent, makeId, nowTimestamp } from "@ascf/foundation";

export interface CreateNegotiationInput {
  action: ActionIntent;
  protocolId: "delegate-fast-vote" | "simple-structured-negotiation" | string;
  participants: Actor[];
  context: ContextReceipt;
}

export class InMemoryNegotiationService {
  private readonly instances = new Map<string, NegotiationInstance>();
  private readonly decisions = new Map<string, DecisionRecord>();

  constructor(private readonly eventStore?: EventStore) {}

  async create(input: CreateNegotiationInput): Promise<NegotiationInstance> {
    const instance: NegotiationInstance = {
      id: makeId("NegotiationInstanceId"),
      protocolId: makeId("NegotiationProtocolId", input.protocolId),
      actionId: input.action.id,
      topic: input.action.title,
      initiator: input.action.proposedBy,
      participants: input.participants.map((participant) => participant.id),
      context: input.context,
      status: "collecting_positions",
      rounds: [{ index: 1, positions: [], openedAt: nowTimestamp() }],
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
      ...currentRound.positions.filter((position) => position.actorId !== input.position.actorId),
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

  async close(input: {
    negotiationId: NegotiationInstance["id"];
    source?: DecisionRecord["source"];
    votingRule?: VotingRule;
  }): Promise<DecisionRecord> {
    const instance = this.getOrThrow(input.negotiationId);
    const positions = instance.rounds.flatMap((round) => round.positions);
    const approvals = positions.filter((position) => position.stance === "support").map((position) => position.actorId);
    const rejections = positions.filter((position) => position.stance === "oppose").map((position) => position.actorId);
    const abstentions = positions.filter((position) => position.stance === "abstain").map((position) => position.actorId);
    const revisionRequests = positions.filter((position) => position.stance === "revise");
    const votingRule = input.votingRule ?? { quorum: 1, threshold: 0.5 };
    const totalVotes = approvals.length + rejections.length + abstentions.length + revisionRequests.length;
    const approvalRatio = totalVotes === 0 ? 0 : approvals.length / totalVotes;
    const hasQuorum = totalVotes >= votingRule.quorum;

    const result: DecisionRecord["result"] = !hasQuorum
      ? "escalated"
      : revisionRequests.length > 0
        ? "needs_revision"
        : approvalRatio >= votingRule.threshold
          ? "approved"
          : "rejected";

    instance.status = result === "approved" ? "converged" : result === "escalated" ? "escalated" : "closed";
    instance.closedAt = nowTimestamp();

    const decision: DecisionRecord = {
      id: makeId("DecisionRecordId"),
      source: input.source ?? (String(instance.protocolId) === "delegate-fast-vote" ? "delegate_vote" : "structured_negotiation"),
      actionId: instance.actionId,
      negotiationId: instance.id,
      result,
      summary: summarizeDecision(result, approvals.length, rejections.length, abstentions.length),
      approvals,
      rejections,
      abstentions,
      unresolvedIssues: revisionRequests.map((position) => position.rationale),
      outputArtifacts: positions.flatMap((position) => position.evidence),
      createdAt: nowTimestamp(),
    };

    this.instances.set(instance.id, instance);
    this.decisions.set(decision.id, decision);
    await this.eventStore?.append(
      createEvent({
        type: "NegotiationDecisionRecorded",
        correlationId: instance.actionId,
        payload: { instance, decision },
      }),
    );
    return decision;
  }

  async get(id: NegotiationInstance["id"]): Promise<NegotiationInstance | null> {
    return this.instances.get(id) ?? null;
  }

  async list(): Promise<NegotiationInstance[]> {
    return [...this.instances.values()];
  }

  private getOrThrow(id: NegotiationInstance["id"]): NegotiationInstance {
    const instance = this.instances.get(id);
    if (!instance) {
      throw new Error(`Negotiation not found: ${id}`);
    }
    return instance;
  }
}

function summarizeDecision(result: DecisionRecord["result"], approvals: number, rejections: number, abstentions: number): string {
  return `Decision ${result}: ${approvals} approvals, ${rejections} rejections, ${abstentions} abstentions.`;
}
