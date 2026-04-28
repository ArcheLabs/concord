import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryReputationEvidenceService } from "./service.js";
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
