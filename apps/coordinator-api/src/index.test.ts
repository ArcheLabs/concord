import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createEvent } from "@concord/foundation";
import { createConcord } from "@concord/sdk";
import { DefaultTraceRecorder, exportTraceJson } from "@concord/trace";
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

  it("serves trace list verify and replay routes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "concord-traces-"));
    try {
      const recorder = new DefaultTraceRecorder();
      await recorder.start({ traceId: "trace_api" });
      await recorder.recordEvent(createEvent({ type: "GoalCreated", payload: { id: "goal_1" } }));
      const trace = await recorder.finish();
      await writeFile(join(dir, "trace_api.json"), exportTraceJson(trace));
      const server = buildServer(createConcord(), { traceDir: dir });

      const list = await server.inject({ method: "GET", url: "/traces" });
      const verify = await server.inject({ method: "POST", url: "/traces/trace_api/verify" });
      const replay = await server.inject({ method: "POST", url: "/traces/trace_api/replay" });

      expect(JSON.parse(list.body)).toHaveLength(1);
      expect(JSON.parse(verify.body)).toMatchObject({ ok: true });
      expect(JSON.parse(replay.body)).toMatchObject({ ok: true });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
