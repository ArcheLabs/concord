// ─── Governance Event Types ───────────────────────────────────────────────────

export type GovernanceEventType =
  | "GovernanceProposalDiscovered"
  | "GovernanceProposalUpdated"
  | "GovernanceVoteCast"
  | "GovernanceDelegated"
  | "GovernanceUndelegated"
  | "GovernanceExecutionQueued"
  | "GovernanceExecuted"
  | "GovernanceFinalityUpdated";
