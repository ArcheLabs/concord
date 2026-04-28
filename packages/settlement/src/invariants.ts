import type { SettlementIntent } from "./types.js";

/**
 * M13 Settlement Invariants
 *
 * INV-SET-1: A completed or failed settlement cannot be re-processed.
 * INV-SET-2: A completed settlement cannot be cancelled.
 */
export function checkSettlementInvariants(intent: SettlementIntent, operation: string): void {
  if (operation === "process") {
    if (intent.status === "completed" || intent.status === "failed") {
      throw new Error(
        `INV-SET-1 violated: SettlementIntent ${intent.id} is "${intent.status}" and cannot be re-processed`,
      );
    }
  }

  if (operation === "cancel") {
    if (intent.status === "completed") {
      throw new Error(
        `INV-SET-2 violated: SettlementIntent ${intent.id} is completed and cannot be cancelled`,
      );
    }
  }
}
