import type {
  ActorId,
  ArtifactRef,
  FailoverRecordId,
  LeaseId,
  ObjectiveId,
  ProjectId,
  RoleAssignmentId,
  SelectionPolicyId,
  Timestamp,
  Version,
  WorkClaimId,
  WorkOrderId,
} from "@concord/foundation";
import type { ConcordRole } from "@concord/core";

// ─── Selection Strategy ───────────────────────────────────────────────────────

export type SelectionStrategy =
  | "manual"
  | "first_available"
  | "round_robin"
  | "random"
  | "capability_weighted"
  | "reputation_weighted"
  | "stake_weighted"
  | "hybrid";

// ─── Selection Filter ─────────────────────────────────────────────────────────

export interface SelectionFilter {
  kind: "capability" | "min_reputation" | "max_reputation" | "role" | "custom";
  capability?: string;
  minReputationScore?: number;
  maxReputationScore?: number;
  role?: ConcordRole;
  custom?: Record<string, unknown>;
}

// ─── Selection Policy ─────────────────────────────────────────────────────────

export interface SelectionPolicy {
  id: SelectionPolicyId;
  projectId?: ProjectId;
  role: ConcordRole;
  strategy: SelectionStrategy;
  filters: SelectionFilter[];
  weights?: {
    reputation?: number;
    stake?: number;
    capability?: number;
  };
  constraints?: {
    maxAssignmentsPerActor?: number;
    leaseDurationMs?: number;
    requireStake?: boolean;
  };
  version: Version;
  createdAt: Timestamp;
}

// ─── Lease ────────────────────────────────────────────────────────────────────

export type LeaseKind =
  | "observer_round"
  | "candidate_observer"
  | "delegate_vote"
  | "work_claim"
  | "review_assignment"
  | "negotiation_participation";

export type LeaseStatus = "active" | "renewed" | "expired" | "released" | "revoked";

export interface Lease {
  id: LeaseId;
  projectId: ProjectId;
  objectiveId?: ObjectiveId;
  kind: LeaseKind;
  resourceId: string;
  holderId: ActorId;
  status: LeaseStatus;
  startsAt: Timestamp;
  expiresAt: Timestamp;
  renewedAt?: Timestamp;
  releasedAt?: Timestamp;
  metadata?: Record<string, unknown>;
}

// ─── Role Assignment ──────────────────────────────────────────────────────────

export type RoleAssignmentSource = "manual" | "selection_policy" | "coordinator" | "governance";
export type RoleAssignmentStatus = "active" | "expired" | "released" | "revoked" | "completed";

export interface SelectionRoleAssignment {
  id: RoleAssignmentId;
  actorId: ActorId;
  projectId: ProjectId;
  objectiveId?: ObjectiveId;
  role: ConcordRole;
  scope: Record<string, unknown>;
  source: RoleAssignmentSource;
  selectionPolicyId?: SelectionPolicyId;
  leaseId?: LeaseId;
  status: RoleAssignmentStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── Failover Record ──────────────────────────────────────────────────────────

export type FailoverKind =
  | "observer_failover"
  | "work_claim_expired"
  | "reviewer_non_response"
  | "delegate_non_response";

export interface FailoverRecord {
  id: FailoverRecordId;
  projectId: ProjectId;
  objectiveId?: ObjectiveId;
  kind: FailoverKind;
  failedActorId: ActorId;
  replacementActorId?: ActorId;
  originalLeaseId: LeaseId;
  replacementLeaseId?: LeaseId;
  reason: string;
  evidenceIds: string[];
  createdAt: Timestamp;
}

// ─── Random Source ────────────────────────────────────────────────────────────

export interface RandomSource {
  nextFloat(): number;
  nextInt(maxExclusive: number): number;
}

// ─── Candidate Actor ─────────────────────────────────────────────────────────

export interface CandidateActor {
  actorId: ActorId;
  reputationScore?: number;
  stakeAmount?: number;
  capabilities?: string[];
}

// ─── Service Interfaces ───────────────────────────────────────────────────────

export interface SelectionService {
  createPolicy(policy: Omit<SelectionPolicy, "id" | "createdAt">): Promise<SelectionPolicy>;
  getPolicy(id: SelectionPolicyId): Promise<SelectionPolicy | undefined>;
  listPolicies(projectId?: ProjectId): Promise<SelectionPolicy[]>;

  select(
    candidates: CandidateActor[],
    policy: SelectionPolicy,
    opts?: { exclude?: ActorId[] },
  ): Promise<ActorId | undefined>;

  assign(
    actorId: ActorId,
    projectId: ProjectId,
    role: ConcordRole,
    opts?: {
      objectiveId?: ObjectiveId;
      selectionPolicyId?: SelectionPolicyId;
      leaseId?: LeaseId;
      scope?: Record<string, unknown>;
      source?: RoleAssignmentSource;
    },
  ): Promise<SelectionRoleAssignment>;

  getAssignment(id: RoleAssignmentId): Promise<SelectionRoleAssignment | undefined>;
  listAssignments(projectId: ProjectId, role?: ConcordRole): Promise<SelectionRoleAssignment[]>;
  revokeAssignment(id: RoleAssignmentId, reason: string): Promise<SelectionRoleAssignment>;
}

export interface LeaseManager {
  acquire(
    projectId: ProjectId,
    kind: LeaseKind,
    resourceId: string,
    holderId: ActorId,
    durationMs: number,
    opts?: { objectiveId?: ObjectiveId; metadata?: Record<string, unknown> },
  ): Promise<Lease>;

  getLease(id: LeaseId): Promise<Lease | undefined>;
  listLeases(projectId: ProjectId, kind?: LeaseKind): Promise<Lease[]>;
  renewLease(id: LeaseId, durationMs: number): Promise<Lease>;
  releaseLease(id: LeaseId): Promise<Lease>;
  revokeLease(id: LeaseId, reason?: string): Promise<Lease>;
  expireLeases(): Promise<number>;
  isActive(id: LeaseId): Promise<boolean>;
}

export interface FailoverService {
  recordFailover(
    projectId: ProjectId,
    kind: FailoverKind,
    failedActorId: ActorId,
    originalLeaseId: LeaseId,
    reason: string,
    opts?: {
      objectiveId?: ObjectiveId;
      replacementActorId?: ActorId;
      replacementLeaseId?: LeaseId;
      evidenceIds?: string[];
    },
  ): Promise<FailoverRecord>;

  listFailovers(projectId: ProjectId, kind?: FailoverKind): Promise<FailoverRecord[]>;
}
