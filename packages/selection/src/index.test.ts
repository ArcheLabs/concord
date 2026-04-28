import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryLeaseManager, InMemorySelectionService, InMemoryFailoverService } from "./service.js";
import { checkLeaseRenewalInvariant, checkLeaseDurationInvariant } from "./invariants.js";
import { makeId, nowTimestamp, version } from "@concord/foundation";
import type { SelectionPolicy, CandidateActor } from "./types.js";

const PROJECT_ID = makeId("ProjectId", "proj_sel");
const ACTOR_A = makeId("ActorId", "actor_a");
const ACTOR_B = makeId("ActorId", "actor_b");
const ACTOR_C = makeId("ActorId", "actor_c");

function makePolicy(strategy: SelectionPolicy["strategy"], overrides?: Partial<SelectionPolicy>): Omit<SelectionPolicy, "id" | "createdAt"> {
  return {
    role: "observer",
    strategy,
    filters: [],
    version: version(),
    ...overrides,
  };
}

describe("InMemoryLeaseManager", () => {
  let lm: InMemoryLeaseManager;
  beforeEach(() => { lm = new InMemoryLeaseManager(); });

  it("acquires a lease", async () => {
    const lease = await lm.acquire(PROJECT_ID, "observer_round", "res1", ACTOR_A, 60000);
    expect(lease.status).toBe("active");
    expect(lease.holderId).toBe(ACTOR_A);
  });

  it("releases a lease", async () => {
    const lease = await lm.acquire(PROJECT_ID, "work_claim", "res2", ACTOR_A, 60000);
    const released = await lm.releaseLease(lease.id);
    expect(released.status).toBe("released");
    const active = await lm.isActive(lease.id);
    expect(active).toBe(false);
  });

  it("revokes a lease", async () => {
    const lease = await lm.acquire(PROJECT_ID, "delegate_vote", "res3", ACTOR_A, 60000);
    const revoked = await lm.revokeLease(lease.id, "test");
    expect(revoked.status).toBe("revoked");
  });

  it("renews a lease", async () => {
    const lease = await lm.acquire(PROJECT_ID, "review_assignment", "res4", ACTOR_A, 60000);
    const renewed = await lm.renewLease(lease.id, 120000);
    expect(renewed.status).toBe("renewed");
    expect(renewed.expiresAt.iso > lease.expiresAt.iso).toBe(true);
  });

  it("expires old leases", async () => {
    const lease = await lm.acquire(PROJECT_ID, "candidate_observer", "res5", ACTOR_A, -1000); // already expired
    const count = await lm.expireLeases();
    expect(count).toBeGreaterThan(0);
    const updated = await lm.getLease(lease.id);
    expect(updated?.status).toBe("expired");
  });
});

describe("InMemorySelectionService", () => {
  let svc: InMemorySelectionService;
  beforeEach(() => { svc = new InMemorySelectionService(); });

  const candidates: CandidateActor[] = [
    { actorId: ACTOR_A, reputationScore: 0.8, stakeAmount: 100 },
    { actorId: ACTOR_B, reputationScore: 0.5, stakeAmount: 200 },
    { actorId: ACTOR_C, reputationScore: 0.2, stakeAmount: 50 },
  ];

  it("first_available selects first candidate", async () => {
    const policy = await svc.createPolicy(makePolicy("first_available"));
    const selected = await svc.select(candidates, policy);
    expect(selected).toBe(ACTOR_A);
  });

  it("reputation_weighted selects highest reputation", async () => {
    const policy = await svc.createPolicy(makePolicy("reputation_weighted"));
    const selected = await svc.select(candidates, policy);
    expect(selected).toBe(ACTOR_A);
  });

  it("stake_weighted selects highest stake", async () => {
    const policy = await svc.createPolicy(makePolicy("stake_weighted"));
    const selected = await svc.select(candidates, policy);
    expect(selected).toBe(ACTOR_B);
  });

  it("excludes specified actors", async () => {
    const policy = await svc.createPolicy(makePolicy("first_available"));
    const selected = await svc.select(candidates, policy, { exclude: [ACTOR_A] });
    expect(selected).toBe(ACTOR_B);
  });

  it("returns undefined if all candidates excluded", async () => {
    const policy = await svc.createPolicy(makePolicy("first_available"));
    const selected = await svc.select(candidates, policy, { exclude: [ACTOR_A, ACTOR_B, ACTOR_C] });
    expect(selected).toBeUndefined();
  });

  it("filters by min_reputation", async () => {
    const policy = await svc.createPolicy(makePolicy("reputation_weighted", {
      filters: [{ kind: "min_reputation", minReputationScore: 0.6 }],
    }));
    const selected = await svc.select(candidates, policy);
    expect(selected).toBe(ACTOR_A);
  });

  it("assigns and lists role assignments", async () => {
    const a = await svc.assign(ACTOR_A, PROJECT_ID, "observer");
    expect(a.status).toBe("active");
    const list = await svc.listAssignments(PROJECT_ID, "observer");
    expect(list).toHaveLength(1);
  });

  it("revokes an assignment", async () => {
    const a = await svc.assign(ACTOR_A, PROJECT_ID, "reviewer");
    const revoked = await svc.revokeAssignment(a.id, "test reason");
    expect(revoked.status).toBe("revoked");
  });
});

describe("InMemoryFailoverService", () => {
  it("records and lists failover", async () => {
    const svc = new InMemoryFailoverService();
    const leaseId = makeId("LeaseId", "lease_fail");
    const record = await svc.recordFailover(
      PROJECT_ID,
      "observer_failover",
      ACTOR_A,
      leaseId,
      "Observer timed out",
      { replacementActorId: ACTOR_B },
    );
    expect(record.kind).toBe("observer_failover");
    expect(record.replacementActorId).toBe(ACTOR_B);

    const list = await svc.listFailovers(PROJECT_ID, "observer_failover");
    expect(list).toHaveLength(1);
  });
});

describe("Selection Invariants", () => {
  it("INV-SEL-1: cannot renew expired lease", () => {
    const now = nowTimestamp();
    expect(() =>
      checkLeaseRenewalInvariant({
        id: makeId("LeaseId"),
        projectId: PROJECT_ID,
        kind: "work_claim",
        resourceId: "r1",
        holderId: ACTOR_A,
        status: "expired",
        startsAt: now,
        expiresAt: now,
      }),
    ).toThrow("INV-SEL-1");
  });

  it("INV-SEL-3: zero duration throws", () => {
    expect(() => checkLeaseDurationInvariant(0)).toThrow("INV-SEL-3");
    expect(() => checkLeaseDurationInvariant(-1000)).toThrow("INV-SEL-3");
  });

  it("positive duration passes", () => {
    expect(() => checkLeaseDurationInvariant(60000)).not.toThrow();
  });
});
