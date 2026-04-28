import { describe, expect, it } from "vitest";
import { createConcord } from "@concord/sdk";
import { buildServer } from "./index.js";

describe("coordinator API", () => {
  it("runs the MVP loop through HTTP", async () => {
    const server = buildServer(createConcord());
    const response = await server.inject({ method: "POST", url: "/loop/run-once" });
    const body = JSON.parse(response.body) as { reviewAggregation: { result: string }; eventCount: number };

    expect(response.statusCode).toBe(200);
    expect(body.reviewAggregation.result).toBe("accepted");
    expect(body.eventCount).toBeGreaterThan(0);
  });

  it("exposes latest state and events", async () => {
    const server = buildServer(createConcord());
    await server.inject({ method: "POST", url: "/loop/run-once" });

    const state = await server.inject({ method: "GET", url: "/state/latest" });
    const events = await server.inject({ method: "GET", url: "/events" });

    expect(state.statusCode).toBe(200);
    expect(JSON.parse(state.body)).toHaveProperty("id");
    expect(JSON.parse(events.body).length).toBeGreaterThan(0);
  });
});
