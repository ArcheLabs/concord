import type { ProtocolInvariant } from "../types.js";

export const governanceInvariants: ProtocolInvariant[] = [
  {
    id: "governance.intent-before-receipt",
    name: "Governance intent before receipt",
    description: "GovernanceReceipt should reference GovernanceIntent.",
    severity: "warning",
    check: () => ({ status: "skipped", message: "Governance is mocked in M8." }),
  },
  {
    id: "incentive.intent-before-receipt",
    name: "Incentive intent before receipt",
    description: "FundingReceipt should reference IncentiveIntent.",
    severity: "warning",
    check: () => ({ status: "skipped", message: "Funding is mocked in M8." }),
  },
  {
    id: "slash.requires-high-confidence-evidence",
    name: "Slash requires high confidence evidence",
    description: "Slash request must reference evidence and high-threshold decision.",
    severity: "warning",
    check: () => ({ status: "skipped", message: "Slash is not implemented in M8." }),
  },
];
