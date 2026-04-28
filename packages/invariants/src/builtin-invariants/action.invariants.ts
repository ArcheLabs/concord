import type { ProtocolInvariant } from "../types.js";
import { asRecord } from "../invariant-runner.js";

export const actionInvariants: ProtocolInvariant[] = [
  {
    id: "action.policy.required",
    name: "Every action has a policy decision",
    description: "Every ActionIntent must have a PolicyDecision.",
    severity: "error",
    check: ({ trace, indexes }) => ({
      status: trace.snapshots.actions.every((action) => indexes.policyDecisionsByActionId.has(String(asRecord(action).id))) ? "pass" : "fail",
      message: "Action exists without PolicyDecision.",
    }),
  },
  {
    id: "action.no-work-without-policy",
    name: "No work without policy",
    description: "WorkOrder derived from an action requires policy or decision evidence.",
    severity: "error",
    check: ({ trace, indexes }) => ({
      status: trace.snapshots.workOrders.every((work) => {
        const actionId = asRecord(work).actionId;
        return typeof actionId === "string" && (indexes.policyDecisionsByActionId.has(actionId) || hasDecisionForAction(trace, actionId));
      })
        ? "pass"
        : "fail",
      message: "WorkOrder exists without policy decision or decision record.",
    }),
  },
  {
    id: "action.high-risk-no-direct",
    name: "High-risk actions are not direct",
    description: "High-risk or critical actions must not be directly approved.",
    severity: "error",
    check: ({ trace, indexes }) => ({
      status: trace.snapshots.actions.every((action) => {
        const record = asRecord(action);
        if (record.riskLevel !== "high" && record.riskLevel !== "critical") return true;
        const decision = asRecord(indexes.policyDecisionsByActionId.get(String(record.id)));
        return decision.result !== "approved_directly";
      })
        ? "pass"
        : "fail",
      message: "High-risk or critical action was approved directly.",
    }),
  },
  {
    id: "action.rejected-has-no-work",
    name: "Rejected actions do not create work",
    description: "Rejected actions must not produce work orders.",
    severity: "error",
    check: ({ trace, indexes }) => ({
      status: trace.snapshots.policyDecisions.every((decision) => {
        const record = asRecord(decision);
        if (record.result !== "rejected") return true;
        return !indexes.workOrdersByActionId.has(String(record.actionId));
      })
        ? "pass"
        : "fail",
      message: "Rejected action produced work.",
    }),
  },
];

function hasDecisionForAction(trace: { snapshots: { decisionRecords: unknown[] } }, actionId: string): boolean {
  return trace.snapshots.decisionRecords.some((decision) => asRecord(decision).actionId === actionId);
}
