import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadScenario } from "./scenario-loader.js";
import { DefaultScenarioRunner } from "./scenario-runner.js";

describe("scenario runner", () => {
  it("loads valid YAML", async () => {
    const scenario = await loadScenario("../../examples/scenarios/simple-loop.yaml");
    expect(scenario.id).toBe("simple-loop");
  });

  it("rejects invalid YAML shape", async () => {
    await expect(loadScenario("../../README.md")).rejects.toThrow();
  });

  it("runs simple-loop and writes a verifiable replayable trace", async () => {
    const dir = await mkdtemp(join(tmpdir(), "concord-scenario-"));
    try {
      const traceOut = join(dir, "simple.trace.json");
      const result = await new DefaultScenarioRunner().run({
        scenarioPath: "../../examples/scenarios/simple-loop.yaml",
        traceOut,
        verify: true,
        replay: true,
      });
      expect(result.ok).toBe(true);
      expect(result.verification?.ok).toBe(true);
      expect(result.replay?.ok).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("runs polkadot adoption scenario", async () => {
    const result = await new DefaultScenarioRunner().run({
      scenarioPath: "../../examples/scenarios/polkadot-adoption.yaml",
      verify: true,
      replay: true,
    });

    expect(result.ok).toBe(true);
    expect(result.trace.scenario?.scenarioId).toBe("polkadot-adoption-research-loop");
  });

  it("keeps deterministic scenario outputs stable", async () => {
    const runner = new DefaultScenarioRunner();
    const first = await runner.run({ scenarioPath: "../../examples/scenarios/simple-loop.yaml", verify: true, replay: true });
    const second = await runner.run({ scenarioPath: "../../examples/scenarios/simple-loop.yaml", verify: true, replay: true });

    expect(first.trace.events.map((event) => event.type)).toEqual(second.trace.events.map((event) => event.type));
    expect(first.trace.finalState.stateHash).toEqual(second.trace.finalState.stateHash);
    expect(first.trace.finalState.latestKnowledgeVersion).toEqual(second.trace.finalState.latestKnowledgeVersion);
    expect(first.verification?.invariantResults.map((result) => [result.id, result.status])).toEqual(
      second.verification?.invariantResults.map((result) => [result.id, result.status]),
    );
  });
});
