import { makeId, nowTimestamp, version } from "@concord/foundation";
import type { ActorId, LeaseId, ObjectiveId, ProjectId, RoleAssignmentId, SelectionPolicyId } from "@concord/foundation";
import type { ConcordRole } from "@concord/core";
import type {
  CandidateActor,
  FailoverKind,
  FailoverRecord,
  FailoverService,
  Lease,
  LeaseKind,
  LeaseManager,
  RoleAssignmentSource,
  SelectionPolicy,
  SelectionRoleAssignment,
  SelectionService,
  RandomSource,
} from "./types.js";

// ─── Default Random Source ────────────────────────────────────────────────────

export class DefaultRandomSource implements RandomSource {
  nextFloat(): number {
    return Math.random();
  }
  nextInt(maxExclusive: number): number {
    return Math.floor(Math.random() * maxExclusive);
  }
}

// ─── Lease Manager ────────────────────────────────────────────────────────────

export class InMemoryLeaseManager implements LeaseManager {
  private leases = new Map<string, Lease>();

  async acquire(
    projectId: ProjectId,
    kind: LeaseKind,
    resourceId: string,
    holderId: ActorId,
    durationMs: number,
    opts?: { objectiveId?: ObjectiveId; metadata?: Record<string, unknown> },
  ): Promise<Lease> {
    const now = Date.now();
    const startsAt = { iso: new Date(now).toISOString() };
    const expiresAt = { iso: new Date(now + durationMs).toISOString() };
    const lease: Lease = {
      id: makeId("LeaseId"),
      projectId,
      kind,
      resourceId,
      holderId,
      status: "active",
      startsAt,
      expiresAt,
      ...(opts?.objectiveId !== undefined && { objectiveId: opts.objectiveId }),
      ...(opts?.metadata !== undefined && { metadata: opts.metadata }),
    };
    this.leases.set(lease.id, lease);
    return lease;
  }

  async getLease(id: LeaseId): Promise<Lease | undefined> {
    return this.leases.get(id);
  }

  async listLeases(projectId: ProjectId, kind?: LeaseKind): Promise<Lease[]> {
    let results = [...this.leases.values()].filter((l) => l.projectId === projectId);
    if (kind) results = results.filter((l) => l.kind === kind);
    return results;
  }

  async renewLease(id: LeaseId, durationMs: number): Promise<Lease> {
    const lease = this.mustGet(id);
    const now = Date.now();
    const expiresAt = { iso: new Date(now + durationMs).toISOString() };
    const updated: Lease = {
      ...lease,
      expiresAt,
      renewedAt: nowTimestamp(),
      status: "renewed",
    };
    this.leases.set(id, updated);
    return updated;
  }

  async releaseLease(id: LeaseId): Promise<Lease> {
    const lease = this.mustGet(id);
    const updated: Lease = { ...lease, status: "released", releasedAt: nowTimestamp() };
    this.leases.set(id, updated);
    return updated;
  }

  async revokeLease(id: LeaseId, _reason?: string): Promise<Lease> {
    const lease = this.mustGet(id);
    const updated: Lease = { ...lease, status: "revoked", releasedAt: nowTimestamp() };
    this.leases.set(id, updated);
    return updated;
  }

  async expireLeases(): Promise<number> {
    const now = new Date().toISOString();
    let count = 0;
    for (const [id, lease] of this.leases.entries()) {
      if (lease.status === "active" || lease.status === "renewed") {
        if (lease.expiresAt.iso < now) {
          this.leases.set(id, { ...lease, status: "expired" });
          count++;
        }
      }
    }
    return count;
  }

  async isActive(id: LeaseId): Promise<boolean> {
    const lease = this.leases.get(id);
    if (!lease) return false;
    if (lease.status !== "active" && lease.status !== "renewed") return false;
    return lease.expiresAt.iso > new Date().toISOString();
  }

  private mustGet(id: LeaseId): Lease {
    const l = this.leases.get(id);
    if (!l) throw new Error(`Lease not found: ${id}`);
    return l;
  }
}

// ─── Selection Service ────────────────────────────────────────────────────────

export class InMemorySelectionService implements SelectionService {
  private policies = new Map<string, SelectionPolicy>();
  private assignments = new Map<string, SelectionRoleAssignment>();

  constructor(private readonly random: RandomSource = new DefaultRandomSource()) {}

  async createPolicy(policy: Omit<SelectionPolicy, "id" | "createdAt">): Promise<SelectionPolicy> {
    const p: SelectionPolicy = {
      ...policy,
      id: makeId("SelectionPolicyId"),
      version: policy.version ?? version(),
      createdAt: nowTimestamp(),
    };
    this.policies.set(p.id, p);
    return p;
  }

  async getPolicy(id: SelectionPolicyId): Promise<SelectionPolicy | undefined> {
    return this.policies.get(id);
  }

  async listPolicies(projectId?: ProjectId): Promise<SelectionPolicy[]> {
    let results = [...this.policies.values()];
    if (projectId) results = results.filter((p) => p.projectId === projectId);
    return results;
  }

  async select(
    candidates: CandidateActor[],
    policy: SelectionPolicy,
    opts?: { exclude?: ActorId[] },
  ): Promise<ActorId | undefined> {
    let pool = candidates.filter(
      (c) => !opts?.exclude?.includes(c.actorId),
    );

    // Apply capability filters
    for (const filter of policy.filters) {
      if (filter.kind === "capability" && filter.capability) {
        pool = pool.filter((c) => c.capabilities?.includes(filter.capability!));
      }
      if (filter.kind === "min_reputation" && filter.minReputationScore !== undefined) {
        pool = pool.filter((c) => (c.reputationScore ?? 0) >= filter.minReputationScore!);
      }
      if (filter.kind === "max_reputation" && filter.maxReputationScore !== undefined) {
        pool = pool.filter((c) => (c.reputationScore ?? 0) <= filter.maxReputationScore!);
      }
    }

    if (pool.length === 0) return undefined;

    switch (policy.strategy) {
      case "first_available":
        return pool[0].actorId;

      case "random":
        return pool[this.random.nextInt(pool.length)].actorId;

      case "round_robin": {
        // Simple: pick lowest-index after stable sort by actorId
        const sorted = [...pool].sort((a, b) => a.actorId.localeCompare(b.actorId));
        return sorted[0].actorId;
      }

      case "reputation_weighted": {
        const sorted = [...pool].sort(
          (a, b) => (b.reputationScore ?? 0) - (a.reputationScore ?? 0),
        );
        return sorted[0].actorId;
      }

      case "stake_weighted": {
        const sorted = [...pool].sort(
          (a, b) => (b.stakeAmount ?? 0) - (a.stakeAmount ?? 0),
        );
        return sorted[0].actorId;
      }

      default:
        return pool[0].actorId;
    }
  }

  async assign(
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
  ): Promise<SelectionRoleAssignment> {
    const now = nowTimestamp();
    const assignment: SelectionRoleAssignment = {
      id: makeId("RoleAssignmentId"),
      actorId,
      projectId,
      role,
      scope: opts?.scope ?? {},
      source: opts?.source ?? "coordinator",
      status: "active",
      createdAt: now,
      updatedAt: now,
      ...(opts?.objectiveId !== undefined && { objectiveId: opts.objectiveId }),
      ...(opts?.selectionPolicyId !== undefined && { selectionPolicyId: opts.selectionPolicyId }),
      ...(opts?.leaseId !== undefined && { leaseId: opts.leaseId }),
    };
    this.assignments.set(assignment.id, assignment);
    return assignment;
  }

  async getAssignment(id: RoleAssignmentId): Promise<SelectionRoleAssignment | undefined> {
    return this.assignments.get(id);
  }

  async listAssignments(projectId: ProjectId, role?: ConcordRole): Promise<SelectionRoleAssignment[]> {
    let results = [...this.assignments.values()].filter((a) => a.projectId === projectId);
    if (role) results = results.filter((a) => a.role === role);
    return results;
  }

  async revokeAssignment(id: RoleAssignmentId, reason: string): Promise<SelectionRoleAssignment> {
    const a = this.assignments.get(id);
    if (!a) throw new Error(`RoleAssignment not found: ${id}`);
    const updated: SelectionRoleAssignment = { ...a, status: "revoked", updatedAt: nowTimestamp() };
    this.assignments.set(id, updated);
    return updated;
  }
}

// ─── Failover Service ─────────────────────────────────────────────────────────

export class InMemoryFailoverService implements FailoverService {
  private records = new Map<string, FailoverRecord>();

  async recordFailover(
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
  ): Promise<FailoverRecord> {
    const record: FailoverRecord = {
      id: makeId("FailoverRecordId"),
      projectId,
      kind,
      failedActorId,
      originalLeaseId,
      reason,
      evidenceIds: opts?.evidenceIds ?? [],
      createdAt: nowTimestamp(),
      ...(opts?.objectiveId !== undefined && { objectiveId: opts.objectiveId }),
      ...(opts?.replacementActorId !== undefined && { replacementActorId: opts.replacementActorId }),
      ...(opts?.replacementLeaseId !== undefined && { replacementLeaseId: opts.replacementLeaseId }),
    };
    this.records.set(record.id, record);
    return record;
  }

  async listFailovers(projectId: ProjectId, kind?: FailoverKind): Promise<FailoverRecord[]> {
    let results = [...this.records.values()].filter((r) => r.projectId === projectId);
    if (kind) results = results.filter((r) => r.kind === kind);
    return results;
  }
}
