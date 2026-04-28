import { describe, expect, it } from "vitest";
import { ActorSchema, ActionIntentSchema } from "./index.js";

describe("core schemas", () => {
  it("validates a minimal actor", () => {
    expect(() =>
      ActorSchema.parse({
        id: "actor_1",
        kind: "agent",
        identities: [{ namespace: "local", subject: "agent-1" }],
      }),
    ).not.toThrow();
  });

  it("rejects action intents without an action type", () => {
    expect(() =>
      ActionIntentSchema.parse({
        id: "action_1",
        type: "",
        proposedBy: "actor_1",
        goalId: "goal_1",
        title: "Create plan",
        description: "Create plan",
        riskLevel: "low",
        inputs: [],
      }),
    ).toThrow();
  });
});
