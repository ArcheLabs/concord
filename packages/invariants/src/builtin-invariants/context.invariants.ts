import type { ProtocolInvariant } from "../types.js";
import { asRecord } from "../invariant-runner.js";

export const contextInvariants: ProtocolInvariant[] = [
  {
    id: "context.submission.requires-receipt",
    name: "Submission requires context receipt",
    description: "Every Submission must include a ContextReceipt.",
    severity: "error",
    check: ({ trace }) => ({
      status: trace.snapshots.submissions.every((submission) => Boolean(asRecord(submission).contextReceipt)) ? "pass" : "fail",
      message: "Submission is missing ContextReceipt.",
    }),
  },
  {
    id: "context.receipt.matches-bundle",
    name: "Receipt references bundle",
    description: "ContextReceipt must reference an existing ContextBundle.",
    severity: "error",
    check: ({ trace, indexes }) => ({
      status: trace.snapshots.contextReceipts.every((receipt) => indexes.contextBundlesById.has(String(asRecord(receipt).contextBundleId)))
        ? "pass"
        : "fail",
      message: "ContextReceipt references missing ContextBundle.",
    }),
  },
  {
    id: "context.knowledge-hash.matches",
    name: "Submission knowledge hash matches bundle",
    description: "Submission context must match declared bundle knowledge hash.",
    severity: "error",
    check: ({ trace, indexes }) => ({
      status: trace.snapshots.submissions.every((submission) => {
        const receipt = asRecord(asRecord(submission).contextReceipt);
        const bundle = asRecord(indexes.contextBundlesById.get(String(receipt.contextBundleId)));
        return !bundle.knowledgeHash || JSON.stringify(bundle.knowledgeHash) === JSON.stringify(receipt.knowledgeHash);
      })
        ? "pass"
        : "fail",
      message: "Submission ContextReceipt knowledge hash does not match bundle.",
    }),
  },
  {
    id: "context.protocol-version.present",
    name: "Protocol version present",
    description: "Submission context must include protocol and policy versions.",
    severity: "error",
    check: ({ trace }) => ({
      status: trace.snapshots.submissions.every((submission) => {
        const receipt = asRecord(asRecord(submission).contextReceipt);
        return Boolean(asRecord(receipt.protocolVersion).value && asRecord(receipt.actionPolicyVersion).value);
      })
        ? "pass"
        : "fail",
      message: "Submission context is missing protocol or action policy version.",
    }),
  },
];
