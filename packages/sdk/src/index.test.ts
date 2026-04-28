import { describe, expect, it } from "vitest";
import { createASCF, createSQLiteASCF } from "./index.js";

describe("ASCF facade", () => {
  it("runs the MVP loop with memory adapters", async () => {
    const ascf = createASCF();
    const result = await ascf.loop.runOnce();

    expect(result.reviewAggregation.result).toBe("accepted");
    expect(result.eventCount).toBeGreaterThan(0);
    expect(result.knowledgeHash).toHaveLength(64);
  });

  it("runs the MVP loop with sqlite adapters", async () => {
    const ascf = createSQLiteASCF(":memory:");
    const result = await ascf.loop.runOnce();

    expect(result.workOrder.status).toBe("accepted");
    expect(await ascf.state.projections.getLatestStateView()).toMatchObject({ id: result.stateView.id });
  });
});
