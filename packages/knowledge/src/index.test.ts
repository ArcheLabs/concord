import { describe, expect, it } from "vitest";
import { makeId, nowTimestamp, version } from "@ascf/foundation";
import { MemoryKnowledgeStore, SQLiteKnowledgeStore } from "./index.js";
import type { ContextReceipt, KnowledgeCandidate, KnowledgeStore } from "@ascf/core";

describe("knowledge stores", () => {
  it("commits candidate knowledge into a new memory version", async () => {
    await expectCommitFlow(new MemoryKnowledgeStore());
  });

  it("commits candidate knowledge into a new sqlite version", async () => {
    await expectCommitFlow(new SQLiteKnowledgeStore());
  });
});

async function expectCommitFlow(store: KnowledgeStore & { seedInitialVersion(input: { createdBy: ReturnType<typeof makeId<"ActorId">> }): Promise<unknown> }) {
  const actorId = makeId("ActorId", "actor_knowledge");
  await store.seedInitialVersion({ createdBy: actorId });
  const parent = await store.getLatestVersion();
  if (!parent) throw new Error("missing parent");

  const context: ContextReceipt = {
    contextBundleId: makeId("ContextBundleId", "ctx_1"),
    stateViewId: makeId("StateViewId", "state_1"),
    stateViewVersion: version("state-1"),
    knowledgeVersionId: parent.id,
    knowledgeHash: parent.hash,
    protocolVersion: version(),
    actionPolicyVersion: version(),
    acceptedAt: nowTimestamp(),
    actorId,
  };
  const candidate: KnowledgeCandidate = {
    id: makeId("KnowledgeCandidateId", "kc_1"),
    proposedBy: actorId,
    source: { uri: "memory://candidate" },
    targetLayer: "formal",
    context,
  };
  await store.saveCandidate(candidate);
  const next = await store.commit({
    candidateIds: [candidate.id],
    decisionRecordId: makeId("DecisionRecordId", "decision_1"),
    parentVersionId: parent.id,
    createdBy: actorId,
  });

  expect(next.parentId).toBe(parent.id);
  expect(next.hash.value).not.toBe(parent.hash.value);
  await expect(store.materialize({ versionId: next.id })).resolves.toMatchObject({ candidates: [candidate] });
}
