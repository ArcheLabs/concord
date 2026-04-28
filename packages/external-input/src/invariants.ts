import type { ExternalInput } from "./types.js";

/**
 * M10 Invariants
 *
 * INV-M10-1: ExternalInput cannot directly write to KnowledgeVersion; it must go through the
 *            knowledge_candidate_queue and normal review flow.
 *
 * INV-M10-2: ExternalInput cannot modify StateView directly.
 *
 * INV-M10-3: An ExternalInput must be classified before it can be routed.
 *
 * INV-M10-4: A critical-risk input must not be directly accepted; it must go to guardian_review.
 *
 * INV-M10-5: A duplicate input must not be re-enqueued for observation.
 *
 * INV-M10-6: An archived input must not be re-assigned to an observer.
 */
export function checkExternalInputInvariants(
  input: ExternalInput,
  operation: string,
): void {
  // INV-M10-3: must be classified before routing
  if (operation === "route" && !input.classification) {
    throw new Error(
      `INV-M10-3 violated: ExternalInput ${input.id} must be classified before routing`,
    );
  }

  // INV-M10-4: critical risk must not be directly accepted
  if (operation === "accept" && input.risk?.riskLevel === "critical") {
    throw new Error(
      `INV-M10-4 violated: ExternalInput ${input.id} has critical risk and cannot be directly accepted`,
    );
  }

  // INV-M10-5: duplicate must not be re-enqueued
  if (operation === "enqueueForObservation" && input.dedupe?.isDuplicate === true) {
    throw new Error(
      `INV-M10-5 violated: ExternalInput ${input.id} is a duplicate and cannot be enqueued for observation`,
    );
  }

  // INV-M10-6: archived must not be re-assigned
  if (operation === "assignObserver" && input.status === "archived") {
    throw new Error(
      `INV-M10-6 violated: ExternalInput ${input.id} is archived and cannot be re-assigned`,
    );
  }
}
