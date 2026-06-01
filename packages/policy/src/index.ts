import type { LegacyActionIntent, ActionPolicy, ActionPolicyRegistry, Actor, ContextBundle, DecisionRecord, EventStore, PolicyDecision } from "@vibly-ai/concord-core";
import { createEvent, makeId, nowTimestamp } from "@vibly-ai/concord-foundation";
export * from "./mechanism.js";

export class InMemoryActionPolicyRegistry implements ActionPolicyRegistry {
  private readonly policies = new Map<string, ActionPolicy>();

  constructor(private readonly eventStore?: EventStore) {}

  async getPolicy(actionType: string): Promise<ActionPolicy | null> {
    return this.policies.get(actionType) ?? null;
  }

  async evaluate(input: { action: LegacyActionIntent; actor: Actor; context: ContextBundle }): Promise<PolicyDecision> {
    const policy = await this.getPolicy(input.action.type);
    const decision = policy
      ? this.evaluateKnownPolicy(policy, input.action)
      : {
          id: makeId("PolicyDecisionId"),
          actionId: input.action.id,
          result: "rejected" as const,
          reason: `No action policy registered for type: ${input.action.type}`,
          createdAt: nowTimestamp(),
        };

    await this.eventStore?.append(
      createEvent({
        type: "ActionPolicyEvaluated",
        actorId: input.actor.id,
        correlationId: input.action.id,
        payload: { action: input.action, decision },
      }),
    );
    return decision;
  }

  async registerPolicy(input: { policy: ActionPolicy; decisionRecord: DecisionRecord }): Promise<void> {
    this.policies.set(input.policy.actionType, input.policy);
    await this.eventStore?.append(
      createEvent({
        type: "ActionPolicyRegistered",
        correlationId: input.decisionRecord.id,
        payload: { policy: input.policy, decisionRecord: input.decisionRecord },
      }),
    );
  }

  private evaluateKnownPolicy(policy: ActionPolicy, action: LegacyActionIntent): PolicyDecision {
    const base = {
      id: makeId("PolicyDecisionId"),
      actionId: action.id,
      policyId: policy.id,
      createdAt: nowTimestamp(),
    };

    switch (policy.decisionFlow) {
      case "direct":
        return {
          ...base,
          result: "approved_directly",
          reason: `Action ${action.type} approved directly by policy ${policy.id}`,
          requiredNextStep: { kind: "work_order", reason: "Direct approval can produce work" },
        };
      case "delegate_vote":
        return {
          ...base,
          result: "requires_delegate_vote",
          reason: `Action ${action.type} requires delegate vote`,
          requiredNextStep: { kind: "delegate_vote", reason: "Policy requires delegate decision" },
        };
      case "structured_negotiation":
        return {
          ...base,
          result: "requires_negotiation",
          reason: `Action ${action.type} requires structured negotiation`,
          requiredNextStep: { kind: "structured_negotiation", reason: "Policy requires structured negotiation" },
        };
      case "review_protocol":
        return {
          ...base,
          result: "requires_review",
          reason: `Action ${action.type} requires review protocol`,
          requiredNextStep: { kind: "review_protocol", reason: "Policy requires review" },
        };
      case "governance_request":
        return {
          ...base,
          result: "requires_governance",
          reason: `Action ${action.type} requires governance`,
          requiredNextStep: { kind: "governance_request", reason: "Policy requires governance" },
        };
      case "guardian_review":
        return {
          ...base,
          result: "requires_guardian",
          reason: `Action ${action.type} requires guardian review`,
          requiredNextStep: { kind: "guardian_review", reason: "Policy requires guardian review" },
        };
      case "reject":
        return {
          ...base,
          result: "rejected",
          reason: `Action ${action.type} rejected by policy ${policy.id}`,
        };
    }
  }
}
