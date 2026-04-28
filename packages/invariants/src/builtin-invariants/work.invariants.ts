import type { ProtocolInvariant } from "../types.js";
import { asRecord } from "../invariant-runner.js";

export const workInvariants: ProtocolInvariant[] = [
  {
    id: "work.claim-before-submit",
    name: "Claim before submit",
    description: "Submitted work orders must have a claim.",
    severity: "error",
    check: ({ trace }) => ({
      status: trace.snapshots.submissions.every((submission) =>
        trace.snapshots.claims.some((claim) => asRecord(claim).workOrderId === asRecord(submission).workOrderId),
      )
        ? "pass"
        : "fail",
      message: "Submission exists without prior WorkClaim.",
    }),
  },
  {
    id: "work.submission-has-execution-receipt",
    name: "Submission execution receipt",
    description: "Every Submission must include ExecutionReceipt.",
    severity: "error",
    check: ({ trace }) => ({
      status: trace.snapshots.submissions.every((submission) => Boolean(asRecord(submission).executionReceipt)) ? "pass" : "fail",
      message: "Submission is missing ExecutionReceipt.",
    }),
  },
  {
    id: "work.accepted-requires-review",
    name: "Accepted work requires review",
    description: "Accepted work cannot exist without review.",
    severity: "error",
    check: ({ trace }) => ({
      status: trace.snapshots.workOrders.every((work) => {
        if (asRecord(work).status !== "accepted") return true;
        return hasReviewForWork(trace, String(asRecord(work).id));
      })
        ? "pass"
        : "fail",
      message: "Accepted WorkOrder has no ReviewRecord.",
    }),
  },
  {
    id: "work.rejected-requires-review",
    name: "Rejected work requires review",
    description: "Rejected work cannot exist without review.",
    severity: "error",
    check: ({ trace }) => ({
      status: trace.snapshots.workOrders.every((work) => {
        if (asRecord(work).status !== "rejected") return true;
        return hasReviewForWork(trace, String(asRecord(work).id));
      })
        ? "pass"
        : "fail",
      message: "Rejected WorkOrder has no ReviewRecord.",
    }),
  },
];

function hasReviewForWork(trace: { snapshots: { submissions: unknown[]; reviews: unknown[] } }, workOrderId: string): boolean {
  const submissionIds = new Set(
    trace.snapshots.submissions.filter((submission) => asRecord(submission).workOrderId === workOrderId).map((submission) => asRecord(submission).id),
  );
  return trace.snapshots.reviews.some((review) => {
    const target = asRecord(asRecord(review).target);
    return target.kind === "submission" && submissionIds.has(target.submissionId);
  });
}
