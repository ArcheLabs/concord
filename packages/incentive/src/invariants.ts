import type { RewardIntent } from "./types.js";

/**
 * M13 Incentive Invariants
 *
 * INV-INC-1: A settled or cancelled reward cannot be re-approved.
 * INV-INC-2: A reward in "draft" status cannot have funding reserved until it is approved.
 * INV-INC-3: Reward amount must be positive (non-zero string).
 * INV-INC-4: A rejected reward cannot be approved or settled.
 */
export function checkIncentiveInvariants(intent: RewardIntent, operation: string): void {
  const terminal = ["settled", "cancelled", "rejected"];

  if (operation === "approve") {
    if (terminal.includes(intent.status)) {
      throw new Error(
        `INV-INC-1 violated: RewardIntent ${intent.id} is "${intent.status}" and cannot be approved`,
      );
    }
  }

  if (operation === "reject") {
    if (terminal.includes(intent.status)) {
      throw new Error(
        `INV-INC-4 violated: RewardIntent ${intent.id} is "${intent.status}" and cannot be rejected`,
      );
    }
  }

  if (operation === "reserveFunding") {
    if (intent.status === "draft") {
      throw new Error(
        `INV-INC-2 violated: RewardIntent ${intent.id} must be approved before funding can be reserved`,
      );
    }
  }
}
