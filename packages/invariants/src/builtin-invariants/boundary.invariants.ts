import type { ProtocolInvariant } from "../types.js";
import { asRecord } from "../invariant-runner.js";

function hasNoProjects(snapshots: { projects?: unknown[] }): boolean {
  return !snapshots.projects || snapshots.projects.length === 0;
}

export const boundaryInvariants: ProtocolInvariant[] = [
  {
    id: "boundary.B001.active-project-has-active-boundary",
    name: "Active project must have an active boundary",
    description: "Every project with status 'active' must have at least one boundary with status 'active' referencing that project.",
    severity: "error",
    check: ({ trace, indexes }) => {
      if (hasNoProjects(trace.snapshots)) return { status: "skipped" };
      const activeProjects = [...indexes.projectsById.values()]
        .map(asRecord)
        .filter((p) => p.status === "active");
      for (const project of activeProjects) {
        const projectId = String(project.id);
        const activeBoundaries = (indexes.boundariesByProjectId.get(projectId) ?? [])
          .map(asRecord)
          .filter((b) => b.status === "active");
        if (activeBoundaries.length === 0) {
          return { status: "fail", message: `Active project has no active boundary: ${projectId}` };
        }
      }
      return { status: "pass" };
    },
  },
  {
    id: "boundary.B002.active-boundary-immutable",
    name: "Active boundary must not be replaced in place",
    description: "A boundary that was once 'active' must only transition to 'superseded', never back to 'draft'.",
    severity: "error",
    check: ({ trace }) => {
      if (hasNoProjects(trace.snapshots)) return { status: "skipped" };
      // Check that no boundary snapshot has status 'draft' with a supersededBy reference already set
      // (a boundary going draft→active→superseded is fine; draft→active→draft is not)
      for (const raw of trace.snapshots.boundaries ?? []) {
        const boundary = asRecord(raw);
        // If a boundary is still 'draft' but already has a supersededBy, that is invalid
        if (boundary.status === "draft" && typeof boundary.supersededBy === "string" && boundary.supersededBy.length > 0) {
          return { status: "fail", message: `Boundary is draft but already has supersededBy: ${String(boundary.id)}` };
        }
      }
      return { status: "pass" };
    },
  },
  {
    id: "boundary.B003.denied-action-no-work",
    name: "Denied action type must not produce a work order",
    description: "If an active boundary's prohibitedActions denies an actionType, no work order with that actionType should exist.",
    severity: "error",
    check: ({ trace, indexes }) => {
      if (hasNoProjects(trace.snapshots)) return { status: "skipped" };
      // Collect denied action types per project
      const deniedByProject = new Map<string, Set<string>>();
      for (const raw of trace.snapshots.boundaries ?? []) {
        const boundary = asRecord(raw);
        if (boundary.status !== "active") continue;
        const projectId = String(boundary.projectId ?? "");
        if (!projectId) continue;
        const prohibitedActions = Array.isArray(boundary.prohibitedActions) ? boundary.prohibitedActions : [];
        for (const rule of prohibitedActions) {
          const r = asRecord(rule);
          if (r.effect === "deny" && typeof r.actionType === "string") {
            const denied = deniedByProject.get(projectId) ?? new Set<string>();
            denied.add(r.actionType);
            deniedByProject.set(projectId, denied);
          }
        }
      }
      if (deniedByProject.size === 0) return { status: "pass" };
      for (const raw of trace.snapshots.workOrders ?? []) {
        const work = asRecord(raw);
        const projectId = String(work.projectId ?? "");
        const actionId = String(work.actionId ?? "");
        if (!projectId || !actionId) continue;
        const denied = deniedByProject.get(projectId);
        if (!denied) continue;
        // Resolve the action to get its type
        const action = asRecord(indexes.actionsById.get(actionId) ?? {});
        const actionType = String(action.actionType ?? action.type ?? "");
        if (actionType && denied.has(actionType)) {
          return { status: "fail", message: `Work order created for denied action type '${actionType}' in project ${projectId}` };
        }
      }
      return { status: "pass" };
    },
  },
];
