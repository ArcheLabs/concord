import { describe, expect, it } from "vitest";
import { CoordinationMechanismSchema } from "./mechanism.js";

describe("mechanism DSL", () => {
  it("round-trips a valid v0.2 mechanism", () => {
    const mechanism = {
      id: "mechanism_1",
      organizationId: "org_1",
      name: "Observation to task",
      version: { value: "0.2.0" },
      status: "enabled",
      rules: {
        eligibility: [{ type: "role_in", roles: ["observer"] }],
        assignment: [{ type: "random_from_qualified", count: 1 }],
        participation: [{ type: "min_participants", count: 3 }],
        voting: [{ type: "majority_threshold", percent: 0.5 }],
        timeout: [{ type: "assignment_response_deadline", seconds: 3600 }],
        reward: [{ type: "fixed_reward", asset: "VIB", amount: "10" }],
        reputation: [{ type: "onAccepted", delta: 1 }],
      },
      createdAt: { iso: "2026-01-01T00:00:00.000Z" },
      updatedAt: { iso: "2026-01-01T00:00:00.000Z" },
    };

    expect(CoordinationMechanismSchema.parse(mechanism)).toEqual(mechanism);
  });

  it("rejects unknown primitives", () => {
    expect(() =>
      CoordinationMechanismSchema.parse({
        id: "mechanism_1",
        organizationId: "org_1",
        name: "Bad mechanism",
        version: { value: "0.2.0" },
        status: "draft",
        rules: { assignment: [{ type: "run_script", code: "return true" }] },
        createdAt: { iso: "2026-01-01T00:00:00.000Z" },
        updatedAt: { iso: "2026-01-01T00:00:00.000Z" },
      }),
    ).toThrow();
  });

  it("rejects custom code fields on typed primitives", () => {
    expect(() =>
      CoordinationMechanismSchema.parse({
        id: "mechanism_1",
        organizationId: "org_1",
        name: "Bad mechanism",
        version: { value: "0.2.0" },
        status: "draft",
        rules: { timeout: [{ type: "submit_deadline", seconds: 120, js: "Date.now()" }] },
        createdAt: { iso: "2026-01-01T00:00:00.000Z" },
        updatedAt: { iso: "2026-01-01T00:00:00.000Z" },
      }),
    ).toThrow();
  });
});
