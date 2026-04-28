import { readFile } from "node:fs/promises";
import YAML from "yaml";
import type { ScenarioFile } from "./types.js";

export async function loadScenario(path: string): Promise<ScenarioFile> {
  const parsed = YAML.parse(await readFile(path, "utf8")) as ScenarioFile;
  validateScenario(parsed);
  return parsed;
}

export function validateScenario(scenario: ScenarioFile): void {
  if (!scenario || typeof scenario !== "object") throw new Error("Scenario must be an object");
  if (!scenario.id || !scenario.name) throw new Error("Scenario must include id and name");
  if (!Array.isArray(scenario.actors) || scenario.actors.length === 0) throw new Error("Scenario must include actors");
  if (!scenario.goal?.title) throw new Error("Scenario must include goal title");
  if (!Array.isArray(scenario.policies)) throw new Error("Scenario must include policies");
  if (!Array.isArray(scenario.loop)) throw new Error("Scenario must include loop steps");
}
