import { describe, expect, it } from "vitest";
import { makeId } from "@concord/foundation";
import { DeterministicRandomSource, randomFromQualified, rotatingObserver, weightedRandomByReputation } from "./deterministic.js";
import type { CandidateActor } from "./types.js";

const candidates: CandidateActor[] = [
  { actorId: makeId("ActorId", "actor_a"), reputationScore: 1 },
  { actorId: makeId("ActorId", "actor_b"), reputationScore: 10 },
  { actorId: makeId("ActorId", "actor_c"), reputationScore: 3 },
];

describe("deterministic selection helpers", () => {
  it("selects the same random actors for the same seed", () => {
    const left = randomFromQualified(candidates, 2, new DeterministicRandomSource("seed"));
    const right = randomFromQualified(candidates, 2, new DeterministicRandomSource("seed"));

    expect(left).toEqual(right);
    expect(new Set(left)).toHaveProperty("size", 2);
  });

  it("selects reputation-weighted actors deterministically", () => {
    const selected = weightedRandomByReputation(candidates, 2, new DeterministicRandomSource("weighted"));

    expect(selected).toEqual(weightedRandomByReputation(candidates, 2, new DeterministicRandomSource("weighted")));
  });

  it("rotates observers with a stable cursor", () => {
    const first = rotatingObserver(candidates, 2, 0);
    const second = rotatingObserver(candidates, 2, first.nextCursor);

    expect(first.selected).toEqual([makeId("ActorId", "actor_a"), makeId("ActorId", "actor_b")]);
    expect(second.selected).toEqual([makeId("ActorId", "actor_c"), makeId("ActorId", "actor_a")]);
  });
});
