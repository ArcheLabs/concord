import type { ProtocolInvariant } from "../types.js";
import { asRecord } from "../invariant-runner.js";

export const coordinatorInvariants: ProtocolInvariant[] = [
  {
    id: "coordinator.no-knowledge-authority",
    name: "Coordinator cannot create knowledge authority",
    description: "Coordinator events cannot directly create KnowledgeVersion.",
    severity: "error",
    check: ({ trace }) => ({
      status: trace.events.every((event) => event.type !== "CoordinatorKnowledgeVersionCreated") ? "pass" : "fail",
      message: "Coordinator directly created KnowledgeVersion.",
    }),
  },
  {
    id: "coordinator.no-reward-authority",
    name: "Coordinator cannot settle rewards",
    description: "Coordinator cannot directly settle rewards.",
    severity: "error",
    check: ({ trace }) => ({
      status: trace.events.every((event) => event.type !== "CoordinatorRewardSettled") ? "pass" : "fail",
      message: "Coordinator directly settled rewards.",
    }),
  },
  {
    id: "coordinator.no-policy-bypass",
    name: "Coordinator cannot bypass policy",
    description: "Coordinator cannot create work from action without PolicyDecision.",
    severity: "error",
    check: ({ trace, indexes }) => ({
      status: trace.snapshots.workOrders.every((work) => {
        const actionId = asRecord(work).actionId;
        return typeof actionId === "string" && indexes.policyDecisionsByActionId.has(actionId);
      })
        ? "pass"
        : "fail",
      message: "WorkOrder exists without PolicyDecision.",
    }),
  },
];
