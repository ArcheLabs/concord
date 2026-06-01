/**
 * EVM proposal state enum, matching the integer values returned by
 * OpenZeppelin Governor's `state(proposalId)` function.
 */
export enum EvmProposalState {
  Pending = 0,
  Active = 1,
  Canceled = 2,
  Defeated = 3,
  Succeeded = 4,
  Queued = 5,
  Expired = 6,
  Executed = 7,
}

import type { GovernanceVoteStance } from "@vibly-ai/concord-governance";

/**
 * Map an EVM Governor proposal state integer to a Concord governance status string.
 */
export function mapEvmStateToStatus(state: number): string {
  switch (state) {
    case EvmProposalState.Pending:
      return "Submitted";
    case EvmProposalState.Active:
      return "Deciding";
    case EvmProposalState.Canceled:
      return "Cancelled";
    case EvmProposalState.Defeated:
      return "Rejected";
    case EvmProposalState.Succeeded:
      return "Confirming";
    case EvmProposalState.Queued:
      return "ExecutionQueued";
    case EvmProposalState.Expired:
      return "TimedOut";
    case EvmProposalState.Executed:
      return "Executed";
    default:
      return "Unknown";
  }
}

/**
 * Map an EVM Governor support value (0=Against, 1=For, 2=Abstain)
 * to a Concord GovernanceVoteStance.
 */
export function mapSupportToStance(support: 0 | 1 | 2): GovernanceVoteStance {
  switch (support) {
    case 0:
      return "oppose";
    case 1:
      return "support";
    case 2:
      return "abstain";
  }
}

/**
 * Map a Concord GovernanceVoteStance to an EVM Governor support value.
 * Defaults to abstain (2) for unrecognized stances.
 */
export function mapStanceToSupport(stance: GovernanceVoteStance): 0 | 1 | 2 {
  switch (stance) {
    case "support":
    case "aye":
      return 1;
    case "oppose":
    case "nay":
      return 0;
    case "abstain":
    case "split":
    default:
      return 2;
  }
}
