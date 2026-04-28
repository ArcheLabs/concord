import type { ProtocolInvariant } from "../types.js";
import { asRecord } from "../invariant-runner.js";

/** Return true if M9 project snapshots are absent — used to skip all M9 rules on pure M8 traces. */
function hasNoProjects(snapshots: { projects?: unknown[] }): boolean {
  return !snapshots.projects || snapshots.projects.length === 0;
}

export const projectInvariants: ProtocolInvariant[] = [
  {
    id: "project.P001.active-has-objective",
    name: "Active project must have at least one active objective",
    description: "Every project with status 'active' must have at least one objective with status 'active'.",
    severity: "error",
    check: ({ trace, indexes }) => {
      if (hasNoProjects(trace.snapshots)) return { status: "skipped" };
      const activeProjects = [...indexes.projectsById.values()]
        .map(asRecord)
        .filter((p) => p.status === "active");
      for (const project of activeProjects) {
        const projectId = String(project.id);
        const objectives = (indexes.objectivesByProjectId.get(projectId) ?? []).map(asRecord);
        if (!objectives.some((o) => o.status === "active")) {
          return { status: "fail", message: `Active project has no active objective: ${projectId}` };
        }
      }
      return { status: "pass" };
    },
  },
  {
    id: "project.P002.active-has-boundary",
    name: "Active project must have exactly one active boundary",
    description: "Every project with status 'active' must have exactly one boundary with status 'active'.",
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
        if (activeBoundaries.length !== 1) {
          return { status: "fail", message: `Active project must have exactly one active boundary: ${projectId} (found ${activeBoundaries.length})` };
        }
      }
      return { status: "pass" };
    },
  },
  {
    id: "project.P003.slug-unique",
    name: "Project slugs must be unique",
    description: "No two projects may share the same slug.",
    severity: "error",
    check: ({ trace }) => {
      if (hasNoProjects(trace.snapshots)) return { status: "skipped" };
      const slugs = new Set<string>();
      for (const raw of trace.snapshots.projects ?? []) {
        const project = asRecord(raw);
        const slug = String(project.slug ?? "");
        if (slugs.has(slug)) return { status: "fail", message: `Duplicate project slug: ${slug}` };
        slugs.add(slug);
      }
      return { status: "pass" };
    },
  },
  {
    id: "project.P004.archived-no-new-work",
    name: "Archived project must not have work orders created after archival",
    description: "WorkOrders referencing a project archived before the work order was recorded are invalid.",
    severity: "warning",
    check: ({ trace }) => {
      if (hasNoProjects(trace.snapshots)) return { status: "skipped" };
      const archivedProjects = new Map<string, string>();
      for (const raw of trace.snapshots.projects ?? []) {
        const project = asRecord(raw);
        if (project.status === "archived" && typeof project.archivedAt === "object") {
          const at = asRecord(project.archivedAt);
          if (typeof at.iso === "string") archivedProjects.set(String(project.id), at.iso);
        }
      }
      if (archivedProjects.size === 0) return { status: "pass" };
      for (const raw of trace.snapshots.workOrders ?? []) {
        const work = asRecord(raw);
        const projectId = String(work.projectId ?? "");
        const archivedAt = archivedProjects.get(projectId);
        if (!archivedAt) continue;
        const createdAt = asRecord(work.createdAt ?? {});
        if (typeof createdAt.iso === "string" && createdAt.iso > archivedAt) {
          return { status: "warn", message: `WorkOrder created after project was archived: project ${projectId}` };
        }
      }
      return { status: "pass" };
    },
  },
  {
    id: "project.P005.paused-no-new-work",
    name: "Paused project should not have new work orders",
    description: "WorkOrders referencing a paused project are suspicious.",
    severity: "warning",
    check: ({ trace, indexes }) => {
      if (hasNoProjects(trace.snapshots)) return { status: "skipped" };
      const pausedProjectIds = new Set(
        [...indexes.projectsById.values()]
          .map(asRecord)
          .filter((p) => p.status === "paused")
          .map((p) => String(p.id)),
      );
      if (pausedProjectIds.size === 0) return { status: "pass" };
      const hasWork = (trace.snapshots.workOrders ?? []).some((raw) => {
        const work = asRecord(raw);
        return typeof work.projectId === "string" && pausedProjectIds.has(work.projectId);
      });
      return hasWork
        ? { status: "warn", message: "WorkOrders exist for paused project(s)" }
        : { status: "pass" };
    },
  },
];
