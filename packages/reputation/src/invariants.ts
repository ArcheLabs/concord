import type { ReputationEvidence } from "./types.js";

/**
 * M11 Reputation Invariants
 *
 * INV-REP-1: Evidence score must be in range [-1, 1].
 * INV-REP-2: Evidence weight must be positive.
 */
export function checkReputationEvidenceInvariants(ev: ReputationEvidence): void {
  if (ev.score < -1 || ev.score > 1) {
    throw new Error(`INV-REP-1 violated: Evidence ${ev.id} score ${ev.score} must be in [-1, 1]`);
  }
  if (ev.weight <= 0) {
    throw new Error(`INV-REP-2 violated: Evidence ${ev.id} weight ${ev.weight} must be positive`);
  }
}
