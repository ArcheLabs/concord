import type { ActorId } from "@concord/foundation";
import type { CandidateActor, RandomSource } from "./types.js";

export class DeterministicRandomSource implements RandomSource {
  private state: number;

  constructor(seed = "concord-selection") {
    this.state = seedToUint32(seed);
  }

  nextFloat(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  nextInt(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new Error(`maxExclusive must be a positive integer: ${maxExclusive}`);
    }
    return Math.floor(this.nextFloat() * maxExclusive);
  }
}

export function randomFromQualified(candidates: CandidateActor[], count: number, random: RandomSource): ActorId[] {
  return drawDistinct(candidates, count, random, () => 1);
}

export function weightedRandomByReputation(candidates: CandidateActor[], count: number, random: RandomSource): ActorId[] {
  return drawDistinct(candidates, count, random, (candidate) => Math.max(0, candidate.reputationScore ?? 0));
}

export function rotatingObserver(candidates: CandidateActor[], count: number, cursor: number): { selected: ActorId[]; nextCursor: number } {
  if (count <= 0 || candidates.length === 0) return { selected: [], nextCursor: cursor };
  const selected: ActorId[] = [];
  for (let i = 0; i < Math.min(count, candidates.length); i += 1) {
    selected.push(candidates[(cursor + i) % candidates.length]!.actorId);
  }
  return { selected, nextCursor: (cursor + selected.length) % candidates.length };
}

function drawDistinct(
  candidates: CandidateActor[],
  count: number,
  random: RandomSource,
  weightOf: (candidate: CandidateActor) => number,
): ActorId[] {
  const pool = [...candidates];
  const selected: ActorId[] = [];
  while (selected.length < count && pool.length > 0) {
    const totalWeight = pool.reduce((sum, candidate) => sum + weightOf(candidate), 0);
    const index = totalWeight > 0 ? weightedIndex(pool, totalWeight, random, weightOf) : random.nextInt(pool.length);
    const [candidate] = pool.splice(index, 1);
    if (candidate) selected.push(candidate.actorId);
  }
  return selected;
}

function weightedIndex(
  candidates: CandidateActor[],
  totalWeight: number,
  random: RandomSource,
  weightOf: (candidate: CandidateActor) => number,
): number {
  let threshold = random.nextFloat() * totalWeight;
  for (let i = 0; i < candidates.length; i += 1) {
    threshold -= weightOf(candidates[i]!);
    if (threshold <= 0) return i;
  }
  return candidates.length - 1;
}

function seedToUint32(seed: string): number {
  let value = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    value ^= seed.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0 || 1;
}
