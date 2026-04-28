import type { ProtocolInvariant } from "../types.js";
import { asRecord } from "../invariant-runner.js";

function hasNoProjects(snapshots: { projects?: unknown[] }): boolean {
  return !snapshots.projects || snapshots.projects.length === 0;
}

/** Detect cycles in an objective parent tree. Returns true if a cycle is found. */
function hasCycle(objectiveId: string, parentMap: Map<string, string>, visited = new Set<string>()): boolean {
  if (visited.has(objectiveId)) return true;
  const parent = parentMap.get(objectiveId);
  if (!parent) return false;
  visited.add(objectiveId);
  return hasCycle(parent, parentMap, visited);
}

export const objectiveInvariants: ProtocolInvariant[] = [
  {
    id: "objective.O001.belongs-to-project",
    name: "Objective must reference an existing project",
    description: "Every objective's projectId must correspond to a known project.",
    severity: "error",
    check: ({ trace, indexes }) => {
      if (hasNoProjects(trace.snapshots)) return { status: "skipped" };
      for (const raw of trace.snapshots.objectives ?? []) {
        const obj = asRecord(raw);
        const projectId = String(obj.projectId ?? "");
        if (projectId && !indexes.projectsById.has(projectId)) {
          return { status: "fail", message: `Objective references missing project: ${String(obj.id)} → ${projectId}` };
        }
      }
      return { status: "pass" };
    },
  },
  {
    id: "objective.O002.primary-must-be-active",
    name: "Project primary objective must be active",
    description: "If a project declares a primaryObjectiveId, that objective must have status 'active'.",
    severity: "error",
    check: ({ trace, indexes }) => {
      if (hasNoProjects(trace.snapshots)) return { status: "skipped" };
      const objectivesById = new Map<string, Record<string, unknown>>();
      for (const raw of trace.snapshots.objectives ?? []) {
        const obj = asRecord(raw);
        objectivesById.set(String(obj.id), obj);
      }
      for (const raw of trace.snapshots.projects ?? []) {
        const project = asRecord(raw);
        const primaryId = String(project.primaryObjectiveId ?? "");
        if (!primaryId) continue;
        const objective = objectivesById.get(primaryId);
        if (!objective || objective.status !== "active") {
          return { status: "fail", message: `Primary objective is not active: project ${String(project.id)}, objective ${primaryId}` };
        }
      }
      return { status: "pass" };
    },
  },
  {
    id: "objective.O003.parent-same-project",
    name: "Objective parent must belong to the same project",
    description: "If an objective has a parentObjectiveId, the parent must share the same projectId.",
    severity: "error",
    check: ({ trace }) => {
      if (hasNoProjects(trace.snapshots)) return { status: "skipped" };
      const objectiveMap = new Map<string, Record<string, unknown>>();
      for (const raw of trace.snapshots.objectives ?? []) {
        const obj = asRecord(raw);
        objectiveMap.set(String(obj.id), obj);
      }
      for (const [, obj] of objectiveMap) {
        const parentId = String(obj.parentObjectiveId ?? "");
        if (!parentId) continue;
        const parent = objectiveMap.get(parentId);
        if (!parent) continue; // caught by O001 if parent's project is missing
        if (String(parent.projectId) !== String(obj.projectId)) {
          return { status: "fail", message: `Objective parent belongs to different project: ${String(obj.id)}` };
        }
      }
      return { status: "pass" };
    },
  },
  {
    id: "objective.O004.no-cycle",
    name: "Objective parent tree must not contain cycles",
    description: "Following parentObjectiveId links from any objective must not return to itself.",
    severity: "error",
    check: ({ trace }) => {
      if (hasNoProjects(trace.snapshots)) return { status: "skipped" };
      const parentMap = new Map<string, string>();
      for (const raw of trace.snapshots.objectives ?? []) {
        const obj = asRecord(raw);
        const parentId = String(obj.parentObjectiveId ?? "");
        if (parentId) parentMap.set(String(obj.id), parentId);
      }
      for (const [id] of parentMap) {
        if (hasCycle(id, parentMap)) {
          return { status: "fail", message: `Objective parent cycle detected starting at: ${id}` };
        }
      }
      return { status: "pass" };
    },
  },
  {
    id: "objective.O005.active-has-required-criterion",
    name: "Active objective must have at least one required success criterion",
    description: "Every objective with status 'active' must have at least one successCriteria entry with required=true.",
    severity: "error",
    check: ({ trace }) => {
      if (hasNoProjects(trace.snapshots)) return { status: "skipped" };
      for (const raw of trace.snapshots.objectives ?? []) {
        const obj = asRecord(raw);
        if (obj.status !== "active") continue;
        const criteria = Array.isArray(obj.successCriteria) ? obj.successCriteria : [];
        const hasRequired = criteria.some((c) => asRecord(c).required === true);
        if (!hasRequired) {
          return { status: "fail", message: `Active objective has no required success criterion: ${String(obj.id)}` };
        }
      }
      return { status: "pass" };
    },
  },
];
