import type { Lease, SelectionRoleAssignment } from "./types.js";

/**
 * M11 Selection Invariants
 *
 * INV-SEL-1: A Lease cannot be renewed if it is already expired, released, or revoked.
 * INV-SEL-2: A RoleAssignment with status "revoked" cannot be reassigned.
 * INV-SEL-3: Lease duration must be positive.
 */
export function checkLeaseRenewalInvariant(lease: Lease): void {
  if (lease.status === "expired" || lease.status === "released" || lease.status === "revoked") {
    throw new Error(
      `INV-SEL-1 violated: Lease ${lease.id} has status "${lease.status}" and cannot be renewed`,
    );
  }
}

export function checkRoleAssignmentInvariant(assignment: SelectionRoleAssignment): void {
  if (assignment.status === "revoked") {
    throw new Error(
      `INV-SEL-2 violated: RoleAssignment ${assignment.id} is revoked and cannot be reassigned`,
    );
  }
}

export function checkLeaseDurationInvariant(durationMs: number): void {
  if (durationMs <= 0) {
    throw new Error(`INV-SEL-3 violated: Lease duration must be positive, got ${durationMs}`);
  }
}
