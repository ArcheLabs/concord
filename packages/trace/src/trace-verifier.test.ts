import { describe, expect, it } from "vitest";
import { createEvent } from "@concord/foundation";
import { DefaultTraceRecorder, DefaultTraceReplayer, DefaultTraceVerifier } from "./index.js";

describe("trace verifier and replayer", () => {
  it("verifies a valid trace", async () => {
    const trace = await validTrace();
    const report = await new DefaultTraceVerifier().verify(trace);

    expect(report.ok).toBe(true);
  });

  it("fails a trace with missing policy decision", async () => {
    const recorder = new DefaultTraceRecorder();
    await recorder.start({ traceId: "trace_missing_policy" });
    await recorder.recordEvent(createEvent({ type: "ActionProposed", payload: { id: "action_1", riskLevel: "low" } }));
    const trace = await recorder.finish();

    const report = await new DefaultTraceVerifier().verify(trace);

    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.code === "action.policy.required")).toBe(true);
  });

  it("fails a trace with knowledge commit but no decision record", async () => {
    const recorder = new DefaultTraceRecorder();
    await recorder.start({ traceId: "trace_missing_decision" });
    await recorder.recordEvent(createEvent({ type: "KnowledgeCommitted", payload: { id: "commit_1", decisionRecordId: "decision_missing" } }));
    const trace = await recorder.finish();

    const report = await new DefaultTraceVerifier().verify(trace);

    expect(report.ok).toBe(false);
    expect(report.errors.some((error) => error.code === "knowledge.commit.requires-decision")).toBe(true);
  });

  it("replays a valid trace to the same final state and supports stopAfterEventCount", async () => {
    const trace = await validTrace();
    const replayer = new DefaultTraceReplayer();
    const full = await replayer.replay(trace);
    const partial = await replayer.replay(trace, { stopAfterEventCount: 2 });

    expect(full.ok).toBe(true);
    expect(full.eventRoot).toEqual(trace.finalState.eventRoot);
    expect(partial.replayedEventCount).toBe(2);
  });
});

async function validTrace() {
  const recorder = new DefaultTraceRecorder();
  await recorder.start({ traceId: "trace_valid" });
  await recorder.recordEvent(createEvent({ type: "ActionProposed", correlationId: "action_1", payload: { id: "action_1", riskLevel: "low" } }));
  await recorder.recordEvent(
    createEvent({
      type: "ActionPolicyEvaluated",
      correlationId: "action_1",
      payload: { decision: { id: "policy_decision_1", actionId: "action_1", result: "requires_delegate_vote" } },
    }),
  );
  await recorder.recordEvent(
    createEvent({
      type: "NegotiationDecisionRecorded",
      correlationId: "action_1",
      payload: { decision: { id: "decision_1", actionId: "action_1", result: "approved" } },
    }),
  );
  await recorder.recordEvent(createEvent({ type: "WorkOrderCreated", correlationId: "action_1", payload: { id: "work_1", actionId: "action_1" } }));
  await recorder.recordEvent(
    createEvent({
      type: "KnowledgeCommitted",
      correlationId: "action_1",
      payload: { id: "commit_1", decisionRecordId: "decision_1" },
    }),
  );
  await recorder.recordEvent(
    createEvent({
      type: "KnowledgeVersionCreated",
      correlationId: "action_1",
      payload: { id: "knowledge_1", hash: { algorithm: "sha256", value: "abc" }, commitIds: ["commit_1"] },
    }),
  );
  return recorder.finish();
}
