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

  describe("M9 scenario — project, objective, boundary, principal, agent", () => {
    it("runs polkadot-adoption-m9 and produces project snapshots", async () => {
      const result = await new DefaultScenarioRunner().run({
        scenarioPath: "../../examples/scenarios/polkadot-adoption-m9.yaml",
        verify: true,
      });

      expect(result.ok).toBe(true);
      expect(result.trace.scenario?.scenarioId).toBe("polkadot-adoption-m9");

      // Project snapshot present
      const projects = (result.trace.snapshots as unknown as Record<string, unknown>)?.projects as Array<{ slug: string; status: string }> | undefined;
      expect(projects).toBeDefined();
      expect(projects!.length).toBeGreaterThan(0);
      expect(projects![0]!.slug).toBe("polkadot-adoption");
      expect(projects![0]!.status).toBe("active");
    });

    it("passes M9 invariants P001, P002, P003, B001, A001", async () => {
      const result = await new DefaultScenarioRunner().run({
        scenarioPath: "../../examples/scenarios/polkadot-adoption-m9.yaml",
        verify: true,
      });

      expect(result.verification?.ok).toBe(true);
      const invariants = result.verification?.invariantResults ?? [];
      const byId = Object.fromEntries(invariants.map((r) => [r.id, r.status]));

      expect(byId["project.P001.active-has-objective"]).toBe("pass");
      expect(byId["project.P002.active-has-boundary"]).toBe("pass");
      expect(byId["project.P003.slug-unique"]).toBe("pass");
      expect(byId["boundary.B001.active-project-has-active-boundary"]).toBe("pass");
      expect(byId["agent.A001.belongs-to-principal"]).toBe("pass");
    });

    it("produces principal and agent snapshots", async () => {
      const result = await new DefaultScenarioRunner().run({
        scenarioPath: "../../examples/scenarios/polkadot-adoption-m9.yaml",
      });

      const snapshots = result.trace.snapshots as unknown as Record<string, unknown>;
      const principals = snapshots?.principals as Array<{ displayName: string }> | undefined;
      const agents = snapshots?.agents as Array<{ displayName: string }> | undefined;

      expect(principals).toBeDefined();
      expect(principals!.length).toBe(3); // sponsor, alice-principal, bob-principal
      expect(agents).toBeDefined();
      expect(agents!.length).toBe(2); // alice-agent, bob-agent
    });
  });

  describe("Phase F scenario — test agent collaboration loop", () => {
    it("runs the Phase F collaboration loop with all agent role snapshots", async () => {
      const result = await new DefaultScenarioRunner().run({
        scenarioPath: "../../examples/scenarios/phase-f-agent-collaboration.yaml",
        verify: true,
        replay: true,
      });

      expect(result.ok).toBe(true);
      expect(result.trace.scenario?.scenarioId).toBe("phase-f-agent-collaboration");

      const snapshots = result.trace.snapshots as unknown as Record<string, unknown>;
      const agents = snapshots.agents as Array<{ displayName: string; eligibleRoles?: string[] }> | undefined;
      const workOrders = snapshots.workOrders as Array<{ status: string }> | undefined;
      const reviews = snapshots.reviews as Array<{ result: string }> | undefined;
      const decisions = snapshots.decisionRecords as Array<{ result: string; source: string }> | undefined;
      const actions = snapshots.actions as Array<{ riskLevel: string }> | undefined;

      expect(agents?.map((agent) => agent.displayName)).toEqual([
        "Observer Agent",
        "Delegate Agent",
        "Worker Agent",
        "Reviewer Agent",
        "Guardian Agent",
      ]);
      expect(actions?.[0]?.riskLevel).toBe("high");
      expect(decisions?.some((decision) => decision.result === "approved" && decision.source === "structured_negotiation")).toBe(true);
      expect(workOrders?.at(-1)?.status).toBe("accepted");
      expect(reviews?.at(-1)?.result).toBe("accept");
      expect(result.verification?.ok).toBe(true);
      expect(result.replay?.ok).toBe(true);
    });
  });
});
