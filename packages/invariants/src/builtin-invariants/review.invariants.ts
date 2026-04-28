import type { ProtocolInvariant } from "../types.js";
import { asRecord } from "../invariant-runner.js";

export const reviewInvariants: ProtocolInvariant[] = [
  {
    id: "review.target-exists",
    name: "Review target exists",
    description: "Every ReviewRecord must reference an existing target.",
    severity: "error",
    check: ({ trace, indexes }) => ({
      status: trace.snapshots.reviews.every((review) => {
        const target = asRecord(asRecord(review).target);
        if (target.kind === "submission") return indexes.submissionsById.has(String(target.submissionId));
        if (target.kind === "knowledge_candidate") return indexes.knowledgeCandidatesById.has(String(target.candidateId));
        if (target.kind === "action") return indexes.actionsById.has(String(target.actionId));
        return false;
      })
        ? "pass"
        : "fail",
      message: "ReviewRecord references missing target.",
    }),
  },
  {
    id: "review.reviewer-not-submitter",
    name: "Reviewer is not sole submitter",
    description: "Submitter cannot be the only reviewer of their own submission by default.",
    severity: "error",
    check: ({ trace, indexes }) => ({
      status: trace.snapshots.reviews.every((review) => {
        const target = asRecord(asRecord(review).target);
        if (target.kind !== "submission") return true;
        const submission = asRecord(indexes.submissionsById.get(String(target.submissionId)));
        return submission.submittedBy !== asRecord(review).reviewerId;
      })
        ? "pass"
        : "fail",
      message: "Submission was reviewed by its submitter.",
    }),
  },
  {
    id: "review.final-decision-recorded",
    name: "Review final decision recorded",
    description: "Accepted or rejected review aggregation should produce a DecisionRecord.",
    severity: "warning",
    check: () => ({
      status: "warn",
      message: "Current MVP records review events but does not create a separate final review DecisionRecord.",
    }),
  },
];
