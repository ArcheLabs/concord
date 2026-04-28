import { describe, expect, it } from "vitest";
import { canonicalJson, createEvent, hashEvent, makeId, sha256 } from "./index.js";

describe("foundation primitives", () => {
  it("serializes objects with stable key order", () => {
    expect(canonicalJson({ b: 2, a: { d: 4, c: 3 } })).toBe('{"a":{"c":3,"d":4},"b":2}');
  });

  it("hashes equivalent object shapes identically", () => {
    expect(sha256({ b: 2, a: 1 })).toEqual(sha256({ a: 1, b: 2 }));
  });

  it("creates audit event envelopes with verifiable hashes", () => {
    const event = createEvent({
      type: "ActorRegistered",
      actorId: makeId("ActorId", "actor_test"),
      payload: { id: "actor_test" },
    });

    expect(event.hash).toEqual(hashEvent(event));
  });
});
