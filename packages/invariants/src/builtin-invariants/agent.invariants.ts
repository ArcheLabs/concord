import type { ProtocolInvariant } from "../types.js";
import { asRecord } from "../invariant-runner.js";

function hasNoProjects(snapshots: { projects?: unknown[] }): boolean {
  return !snapshots.projects || snapshots.projects.length === 0;
}

export const agentInvariants: ProtocolInvariant[] = [
  {
    id: "agent.A001.belongs-to-principal",
    name: "Agent must reference an existing principal",
    description: "Every agent's principalId must correspond to a known principal.",
    severity: "error",
    check: ({ trace, indexes }) => {
      if (hasNoProjects(trace.snapshots)) return { status: "skipped" };
      for (const raw of trace.snapshots.agents ?? []) {
        const agent = asRecord(raw);
        const principalId = String(agent.principalId ?? "");
        if (principalId && !indexes.principalsById.has(principalId)) {
          return { status: "fail", message: `Agent references missing principal: ${String(agent.id)} → ${principalId}` };
        }
      }
      return { status: "pass" };
    },
  },
  {
    id: "agent.A002.active-agent-needs-active-principal",
    name: "Active agent's principal must not be suspended or revoked",
    description: "An agent with status 'active' must belong to a principal that is also 'active'.",
    severity: "error",
    check: ({ trace, indexes }) => {
      if (hasNoProjects(trace.snapshots)) return { status: "skipped" };
      for (const raw of trace.snapshots.agents ?? []) {
        const agent = asRecord(raw);
        if (agent.status !== "active") continue;
        const principalId = String(agent.principalId ?? "");
        if (!principalId) continue;
        const principal = asRecord(indexes.principalsById.get(principalId) ?? {});
        if (principal.status === "suspended" || principal.status === "revoked") {
          return { status: "fail", message: `Active agent belongs to ${String(principal.status)} principal: agent ${String(agent.id)}` };
        }
      }
      return { status: "pass" };
    },
  },
  {
    id: "agent.A003.runtime-binding-needs-active-agent",
    name: "RuntimeBinding must reference an existing active agent",
    description: "Every runtimeBinding's agentId must correspond to a known agent.",
    severity: "error",
    check: ({ trace, indexes }) => {
      if (hasNoProjects(trace.snapshots)) return { status: "skipped" };
      for (const raw of trace.snapshots.runtimeBindings ?? []) {
        const binding = asRecord(raw);
        const agentId = String(binding.agentId ?? "");
        if (!agentId) continue;
        if (!indexes.agentsById.has(agentId)) {
          return { status: "fail", message: `RuntimeBinding references missing agent: ${String(binding.id)} → ${agentId}` };
        }
      }
      return { status: "pass" };
    },
  },
  {
    id: "agent.A004.revoked-binding-not-in-submission",
    name: "Revoked RuntimeBinding must not be used in submissions",
    description: "A submission must not reference a runtimeBindingId that is revoked.",
    severity: "error",
    check: ({ trace, indexes }) => {
      if (hasNoProjects(trace.snapshots)) return { status: "skipped" };
      const revokedBindingIds = new Set(
        [...indexes.runtimeBindingsById.values()]
          .map(asRecord)
          .filter((b) => b.status === "revoked")
          .map((b) => String(b.id)),
      );
      if (revokedBindingIds.size === 0) return { status: "pass" };
      for (const raw of trace.snapshots.submissions ?? []) {
        const sub = asRecord(raw);
        const bindingId = String(sub.runtimeBindingId ?? "");
        if (bindingId && revokedBindingIds.has(bindingId)) {
          return { status: "fail", message: `Submission uses revoked RuntimeBinding: ${String(sub.id)} → ${bindingId}` };
        }
        // Also check nested executionReceipt
        const receipt = asRecord(sub.executionReceipt ?? {});
        const receiptBindingId = String(receipt.runtimeBindingId ?? "");
        if (receiptBindingId && revokedBindingIds.has(receiptBindingId)) {
          return { status: "fail", message: `ExecutionReceipt uses revoked RuntimeBinding: ${String(sub.id)} → ${receiptBindingId}` };
        }
      }
      return { status: "pass" };
    },
  },
  {
    id: "agent.A005.participant-needs-active-membership",
    name: "Work participant must have active project membership",
    description: "If a submission references a projectId and agentId, that agent must have an active membership in that project.",
    severity: "error",
    check: ({ trace, indexes }) => {
      if (hasNoProjects(trace.snapshots)) return { status: "skipped" };
      for (const raw of trace.snapshots.submissions ?? []) {
        const sub = asRecord(raw);
        const projectId = String(sub.projectId ?? "");
        const agentId = String(sub.agentId ?? "");
        if (!projectId || !agentId) continue;
        const memberships = (indexes.membershipsByProjectId.get(projectId) ?? []).map(asRecord);
        const hasActiveMembership = memberships.some(
          (m) => String(m.agentId) === agentId && m.status === "active",
        );
        if (!hasActiveMembership) {
          return { status: "fail", message: `Submission agent has no active membership: agent ${agentId} in project ${projectId}` };
        }
      }
      return { status: "pass" };
    },
  },
  {
    id: "agent.A006.submission-traces-to-principal",
    name: "Submission must trace to a principal via agent and runtime binding",
    description: "If a submission has a projectId, it must include agentId and principalId that are consistent with each other.",
    severity: "error",
    check: ({ trace, indexes }) => {
      if (hasNoProjects(trace.snapshots)) return { status: "skipped" };
      for (const raw of trace.snapshots.submissions ?? []) {
        const sub = asRecord(raw);
        const projectId = String(sub.projectId ?? "");
        if (!projectId) continue;
        const agentId = String(sub.agentId ?? "");
        const principalId = String(sub.principalId ?? "");
        if (!agentId || !principalId) {
          return { status: "fail", message: `M9 submission missing agentId or principalId: ${String(sub.id)}` };
        }
        const agent = asRecord(indexes.agentsById.get(agentId) ?? {});
        if (String(agent.principalId) !== principalId) {
          return { status: "fail", message: `Submission principalId does not match agent's principal: ${String(sub.id)}` };
        }
      }
      return { status: "pass" };
    },
  },
];
