import type { ProtocolInvariant } from "../types.js";
import { asRecord } from "../invariant-runner.js";

export const knowledgeInvariants: ProtocolInvariant[] = [
  {
    id: "knowledge.candidate-before-commit",
    name: "Candidates exist before commit",
    description: "KnowledgeCommit must only reference existing KnowledgeCandidate objects.",
    severity: "error",
    check: ({ trace, indexes }) => ({
      status: trace.snapshots.knowledgeCommits.every((commit) =>
        asArray(asRecord(commit).candidateIds).every((candidateId) => indexes.knowledgeCandidatesById.has(String(candidateId))),
      )
        ? "pass"
        : "fail",
      message: "KnowledgeCommit references missing KnowledgeCandidate.",
    }),
  },
  {
    id: "knowledge.commit.requires-decision",
    name: "Commit requires decision",
    description: "KnowledgeCommit must reference a valid DecisionRecord.",
    severity: "error",
    check: ({ trace, indexes }) => ({
      status: trace.snapshots.knowledgeCommits.every((commit) => indexes.decisionRecordsById.has(String(asRecord(commit).decisionRecordId)))
        ? "pass"
        : "fail",
      message: "KnowledgeCommit references missing DecisionRecord.",
    }),
  },
  {
    id: "knowledge.version.has-hash",
    name: "Knowledge versions have hashes",
    description: "Every KnowledgeVersion must have a hash.",
    severity: "error",
    check: ({ trace }) => ({
      status: trace.snapshots.knowledgeVersions.every((version) => Boolean(asRecord(asRecord(version).hash).value)) ? "pass" : "fail",
      message: "KnowledgeVersion is missing hash.",
    }),
  },
  {
    id: "knowledge.version-parent-valid",
    name: "Knowledge parent valid",
    description: "Every non-genesis KnowledgeVersion must reference an existing parent.",
    severity: "error",
    check: ({ trace, indexes }) => ({
      status: trace.snapshots.knowledgeVersions.every((version) => {
        const parentId = asRecord(version).parentId;
        return typeof parentId !== "string" || indexes.knowledgeVersionsById.has(parentId);
      })
        ? "pass"
        : "fail",
      message: "KnowledgeVersion references missing parent.",
    }),
  },
  {
    id: "knowledge.no-direct-formal-write",
    name: "No direct formal knowledge write",
    description: "Formal knowledge must come through candidate and commit.",
    severity: "error",
    check: ({ trace }) => ({
      status: trace.snapshots.knowledgeVersions.every((version) => asArray(asRecord(version).commitIds).length > 0 || !asRecord(version).parentId)
        ? "pass"
        : "fail",
      message: "Formal knowledge version was created without commit path.",
    }),
  },
];

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
