import { describe, expect, it } from "vitest";
import { createEvent, makeId } from "@vibly-ai/concord-foundation";
import { createStateView, MemoryEventStore, MemoryProjectionStore, SQLiteEventStore, SQLiteProjectionStore } from "./index.js";

describe("state stores", () => {
  it("keeps memory and sqlite event query behavior aligned", async () => {
    const memory = new MemoryEventStore();
    const sqlite = new SQLiteEventStore();
    const event = createEvent({ type: "GoalCreated", payload: { title: "Adoption" } });

    await memory.append(event);
    await sqlite.append(event);

    expect(await memory.query({ type: ["GoalCreated"] })).toEqual(await sqlite.query({ type: ["GoalCreated"] }));
  });

  it("stores latest state views in memory and sqlite projections", async () => {
    const event = createEvent({ type: "KnowledgeVersionCreated", payload: { id: "kv_1" } });
    const view = createStateView({
      events: [event],
      knowledgeVersionId: makeId("KnowledgeVersionId", "kv_1"),
    });

    const memory = new MemoryProjectionStore();
    const sqlite = new SQLiteProjectionStore();
    await memory.saveStateView(view);
    await sqlite.saveStateView(view);

    expect(await memory.getLatestStateView()).toEqual(await sqlite.getLatestStateView());
  });
});
