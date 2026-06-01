import type { EventEnvelope, FailoverRecordId, LeaseId, RoleAssignmentId, SelectionPolicyId } from "@vibly-ai/concord-foundation";
import type { FailoverRecord, Lease, SelectionPolicy, SelectionRoleAssignment } from "./types.js";

export type SelectionPolicyCreatedEvent = EventEnvelope<
  "SelectionPolicyCreated",
  { policy: SelectionPolicy }
>;

export type LeaseAcquiredEvent = EventEnvelope<
  "LeaseAcquired",
  { lease: Lease }
>;

export type LeaseRenewedEvent = EventEnvelope<
  "LeaseRenewed",
  { leaseId: LeaseId; expiresAt: string }
>;

export type LeaseReleasedEvent = EventEnvelope<
  "LeaseReleased",
  { leaseId: LeaseId }
>;

export type LeaseRevokedEvent = EventEnvelope<
  "LeaseRevoked",
  { leaseId: LeaseId; reason?: string }
>;

export type LeaseExpiredEvent = EventEnvelope<
  "LeaseExpired",
  { leaseId: LeaseId }
>;

export type RoleAssignedEvent = EventEnvelope<
  "RoleAssigned",
  { assignment: SelectionRoleAssignment }
>;

export type RoleRevokedEvent = EventEnvelope<
  "RoleRevoked",
  { assignmentId: RoleAssignmentId; reason: string }
>;

export type FailoverTriggeredEvent = EventEnvelope<
  "FailoverTriggered",
  { record: FailoverRecord }
>;

export type SelectionEvent =
  | SelectionPolicyCreatedEvent
  | LeaseAcquiredEvent
  | LeaseRenewedEvent
  | LeaseReleasedEvent
  | LeaseRevokedEvent
  | LeaseExpiredEvent
  | RoleAssignedEvent
  | RoleRevokedEvent
  | FailoverTriggeredEvent;
