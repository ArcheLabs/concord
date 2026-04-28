import { describe, expect, it } from "vitest";
import { createConcord, createSQLiteConcord } from "./index.js";

describe("Concord facade", () => {
  it("runs the MVP loop with memory adapters", async () => {
    const concord = createConcord();
    const result = await concord.loop.runOnce();

    expect(result.reviewAggregation.result).toBe("accepted");
    expect(result.eventCount).toBeGreaterThan(0);
    expect(result.knowledgeHash).toHaveLength(64);
  });

  it("runs the MVP loop with sqlite adapters", async () => {
    const concord = createSQLiteConcord(":memory:");
    const result = await concord.loop.runOnce();

    expect(result.workOrder.status).toBe("accepted");
    expect(await concord.state.projections.getLatestStateView()).toMatchObject({ id: result.stateView.id });
  });
});
