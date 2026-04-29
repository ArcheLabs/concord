import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryReputationEvidenceService, ConsistencyScorer } from "./service.js";
import { checkReputationEvidenceInvariants } from "./invariants.js";
import { makeId, nowTimestamp } from "@concord/foundation";
import type { ReputationEvidence } from "./types.js";

const PROJECT_ID = makeId("ProjectId", "proj_rep");
const ACTOR_A = makeId("ActorId", "actor_a");
const ACTOR_B = makeId("ActorId", "actor_b");

describe("InMemoryReputationEvidenceService", () => {
  let svc: InMemoryReputationEvidenceService;
  beforeEach(() => {
    svc = new InMemoryReputationEvidenceService();
  });

  it("records evidence and lists by actor", async () => {
    await svc.recordEvidence(ACTOR_A, PROJECT_ID, "work_accepted", 1);
    await svc.recordEvidence(ACTOR_A, PROJECT_ID, "work_rejected", -1);
    await svc.recordEvidence(ACTOR_B, PROJECT_ID, "review_accurate", 0.5);

    const list = await svc.listEvidence({ actorId: ACTOR_A, projectId: PROJECT_ID });
    expect(list).toHaveLength(2);
  });

  it("computes normalized score correctly", async () => {
    await svc.recordEvidence(ACTOR_A, PROJECT_ID, "work_accepted", 1, { weight: 2 });
    await svc.recordEvidence(ACTOR_A, PROJECT_ID, "work_rejected", -1, { weight: 1 });

    const score = await svc.getScore(ACTOR_A, PROJECT_ID);
    // weightedSum = 2*1 + 1*(-1) = 1, totalWeight = 3, normalized = 1/3
    expect(score.normalizedScore).toBeCloseTo(1 / 3, 5);
    expect(score.evidenceCount).toBe(2);
  });

  it("returns 0 score for actor with no evidence", async () => {
    const score = await svc.getScore(ACTOR_A, PROJECT_ID);
    expect(score.normalizedScore).toBe(0);
    expect(score.evidenceCount).toBe(0);
  });

  it("filters by kind", async () => {
    await svc.recordEvidence(ACTOR_A, PROJECT_ID, "slash", -1);
    await svc.recordEvidence(ACTOR_A, PROJECT_ID, "work_accepted", 1);
    const slashes = await svc.listEvidence({ kind: "slash" });
    expect(slashes).toHaveLength(1);
    expect(slashes[0]?.kind).toBe("slash");
  });

  it("clamps score to [-1, 1]", async () => {
    await svc.recordEvidence(ACTOR_A, PROJECT_ID, "work_accepted", 1, { weight: 100 });
    const score = await svc.getScore(ACTOR_A, PROJECT_ID);
    expect(score.normalizedScore).toBeLessThanOrEqual(1);
    expect(score.normalizedScore).toBeGreaterThanOrEqual(-1);
  });
});

describe("checkReputationEvidenceInvariants", () => {
  function makeEvidence(score: number, weight: number): ReputationEvidence {
    return {
      id: makeId("ReputationEvidenceId"),
      actorId: ACTOR_A,
      projectId: PROJECT_ID,
      kind: "work_accepted",
      score,
      weight,
      artifacts: [],
      createdAt: nowTimestamp(),
    };
  }

  it("INV-REP-1: score out of range throws", () => {
    expect(() => checkReputationEvidenceInvariants(makeEvidence(1.5, 1))).toThrow("INV-REP-1");
    expect(() => checkReputationEvidenceInvariants(makeEvidence(-2, 1))).toThrow("INV-REP-1");
  });

  it("INV-REP-2: zero or negative weight throws", () => {
    expect(() => checkReputationEvidenceInvariants(makeEvidence(1, 0))).toThrow("INV-REP-2");
    expect(() => checkReputationEvidenceInvariants(makeEvidence(1, -1))).toThrow("INV-REP-2");
  });

  it("valid evidence passes", () => {
    expect(() => checkReputationEvidenceInvariants(makeEvidence(0.5, 1))).not.toThrow();
  });
});

// ─── ConsistencyScorer (Peer Prediction) ────────────────────────────────────

describe("ConsistencyScorer", () => {
  const scorer = new ConsistencyScorer();

  it("returns multiplier=1 for a single reporter", () => {
    const r1 = makeId("ActorId", "r1");
    const result = scorer.score([{ actorId: r1, score: 0.5 }]);
    expect(result.get(r1)?.multiplier).toBe(1);
  });

  it("returns multiplier=1 for all reporters giving identical scores", () => {
    const [r1, r2, r3] = [makeId("ActorId", "r1"), makeId("ActorId", "r2"), makeId("ActorId", "r3")];
    const result = scorer.score([
      { actorId: r1, score: 0.7 },
      { actorId: r2, score: 0.7 },
      { actorId: r3, score: 0.7 },
    ]);
    expect(result.get(r1)?.multiplier).toBeCloseTo(1);
    expect(result.get(r2)?.multiplier).toBeCloseTo(1);
    expect(result.get(r3)?.multiplier).toBeCloseTo(1);
  });

  it("penalizes outlier with lower multiplier", () => {
    const [r1, r2, outlier] = [makeId("ActorId", "r1"), makeId("ActorId", "r2"), makeId("ActorId", "outlier")];
    const result = scorer.score([
      { actorId: r1, score: 0.9 },
      { actorId: r2, score: 0.9 },
      { actorId: outlier, score: 0.1 },
    ]);
    // r1/r2 peer mean: (0.9 + 0.1) / 2 = 0.5; but leave-one-out:
    // r1 peer mean = (0.9 + 0.1) / 2 = 0.5, deviation = |0.9 - 0.5| = 0.4, multiplier = 0.6
    // outlier peer mean = (0.9 + 0.9) / 2 = 0.9, deviation = |0.1 - 0.9| = 0.8, multiplier = 0.2
    const outlierCs = result.get(outlier)!;
    expect(outlierCs.multiplier).toBeLessThan(result.get(r1)!.multiplier);
    expect(outlierCs.multiplier).toBeCloseTo(0.2, 5);
  });

  it("two reporters with scores 0.2 and 0.8 → each deviation 0.3", () => {
    const [r1, r2] = [makeId("ActorId", "r1"), makeId("ActorId", "r2")];
    const result = scorer.score([
      { actorId: r1, score: 0.2 },
      { actorId: r2, score: 0.8 },
    ]);
    // r1 peer mean = 0.8, deviation = |0.2 - 0.8| = 0.6, multiplier = 0.4
    // r2 peer mean = 0.2, deviation = |0.8 - 0.2| = 0.6, multiplier = 0.4
    expect(result.get(r1)?.multiplier).toBeCloseTo(0.4, 5);
    expect(result.get(r2)?.multiplier).toBeCloseTo(0.4, 5);
  });
});

// ─── EMA score ───────────────────────────────────────────────────────────────

describe("getEmaScore", () => {
  it("returns 0 for actor with no evidence", async () => {
    const svc = new InMemoryReputationEvidenceService();
    const actor = makeId("ActorId", "ema_test");
    const proj = makeId("ProjectId", "ema_proj");
    const result = await svc.getEmaScore(actor, proj);
    expect(result.normalizedScore).toBe(0);
  });

  it("EMA with higher decay factor reacts faster to recent evidence", async () => {
    const svc1 = new InMemoryReputationEvidenceService();
    const svc2 = new InMemoryReputationEvidenceService();
    const actor = makeId("ActorId", "ema_actor");
    const proj = makeId("ProjectId", "ema_proj");

    // Both services get: bad, bad, good
    for (const svc of [svc1, svc2]) {
      await svc.recordEvidence(actor, proj, "work_rejected", -1);
      await svc.recordEvidence(actor, proj, "work_rejected", -1);
      await svc.recordEvidence(actor, proj, "work_accepted", 1);
    }

    const slow = await svc1.getEmaScore(actor, proj, 0.1);
    const fast = await svc2.getEmaScore(actor, proj, 0.5);
    // With fast decay (0.5), the recent positive evidence has stronger weight
    expect(fast.normalizedScore).toBeGreaterThan(slow.normalizedScore);
  });
});
