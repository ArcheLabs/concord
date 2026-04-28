import { describe, expect, it } from "vitest";
import { createEvent } from "@concord/foundation";
import { DefaultTraceRecorder, createTracedEventStore, exportTraceJson, parseTraceJson } from "./index.js";

describe("trace recorder", () => {
  it("records events into a trace", async () => {
    const recorder = new DefaultTraceRecorder();
    await recorder.start({ traceId: "trace_test" });
    await recorder.recordEvent(createEvent({ type: "ActionProposed", payload: { id: "action_1" } }));
    const trace = await recorder.finish();

    expect(trace.traceId).toBe("trace_test");
    expect(trace.events).toHaveLength(1);
    expect(trace.snapshots.actions).toEqual([{ id: "action_1" }]);
  });

  it("exports and loads canonical trace JSON", async () => {
    const recorder = new DefaultTraceRecorder();
    await recorder.start({ traceId: "trace_json" });
    const trace = await recorder.finish();
    const json = exportTraceJson(trace);
    const parsed = parseTraceJson(json);

    expect(parsed.traceId).toBe("trace_json");
    expect(json.endsWith("\n")).toBe(true);
  });

  it("wraps an event store and records appended events", async () => {
    const events: unknown[] = [];
    const store = {
      async append(event: never) {
        events.push(event);
      },
      async appendMany(input: never[]) {
        events.push(...input);
      },
      async get() {
        return null;
      },
      async query() {
        return events as never[];
      },
    };
    const recorder = new DefaultTraceRecorder();
    await recorder.start({ traceId: "trace_store" });
    const traced = createTracedEventStore(store, recorder);
    await traced.append(createEvent({ type: "WorkOrderCreated", payload: { id: "work_1" } }));
    const trace = await recorder.finish();

    expect(trace.events).toHaveLength(1);
    expect(trace.snapshots.workOrders).toEqual([{ id: "work_1" }]);
  });
});
