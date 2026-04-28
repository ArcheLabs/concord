import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { ActionIntent, ActionPolicy, Actor, ContextBundle, ContextReceipt, DecisionRecord, KnowledgeCandidate, WorkOrder } from "@concord/core";
import { MemoryEventStore, MemoryKnowledgeStore, MemoryProjectionStore, SQLiteEventStore, SQLiteKnowledgeStore, SQLiteProjectionStore, createStateView } from "@concord/adapters";
import { createConcord } from "@concord/sdk";
import { createEvent, hashCanonical, makeId, nowTimestamp, sha256, version, withDeterministicMode, type ActorId } from "@concord/foundation";
import { DefaultInvariantRunner } from "@concord/invariants";
import { DefaultTraceRecorder, DefaultTraceReplayer, DefaultTraceVerifier, createTracedEventStore, exportTraceJson } from "@concord/trace";
import type { ProtocolTrace } from "@concord/trace";
import { loadScenario } from "./scenario-loader.js";
import type { RunScenarioInput, RunScenarioResult, ScenarioFile, ScenarioLoopStep } from "./types.js";

interface ScenarioState {
  scenarioPath: string;
  scenario: ScenarioFile;
  actors: Map<string, Actor>;
  goalId?: string;
  contextBundle?: ContextBundle;
  contextReceipt?: ContextReceipt;
  action?: ActionIntent;
  decision?: DecisionRecord;
  workOrder?: WorkOrder;
  execution?: Awaited<ReturnType<ReturnType<typeof createConcord>["runtime"]["execute"]>>;
  submission?: Awaited<ReturnType<ReturnType<typeof createConcord>["work"]["submit"]>>;
  review?: Awaited<ReturnType<ReturnType<typeof createConcord>["review"]["submitReview"]>>;
  knowledgeCandidate?: KnowledgeCandidate;
  initialKnowledgeVersion?: unknown;
  latestKnowledgeVersion?: unknown;
}

export class DefaultScenarioRunner {
  async run(input: RunScenarioInput): Promise<RunScenarioResult> {
    const scenario = await loadScenario(input.scenarioPath);
    const run = async () => this.runScenario({ ...input, scenario });
    return scenario.deterministic ? withDeterministicMode({ seed: scenario.id }, run) : run();
  }

  private async runScenario(input: RunScenarioInput & { scenario: ScenarioFile }): Promise<RunScenarioResult> {
    const recorder = new DefaultTraceRecorder();
    await recorder.start({
      traceId: `trace_${input.scenario.id}`,
      scenario: {
        scenarioId: input.scenario.id,
        scenarioName: input.scenario.name,
        scenarioHash: hashCanonical(input.scenario),
        sourcePath: input.scenarioPath,
      },
      environment: {
        runtime: "node",
        store: input.scenario.store?.type ?? "memory",
        coordinator: "memory",
        deterministic: Boolean(input.scenario.deterministic),
      },
    });

    const stores = createStores(input.scenario);
    const eventStore = createTracedEventStore(stores.eventStore, recorder);
    const concord = createConcord({ eventStore, projectionStore: stores.projectionStore, knowledgeStore: stores.knowledgeStore });
    const state: ScenarioState = { scenarioPath: input.scenarioPath, scenario: input.scenario, actors: new Map() };

    for (const actorInput of input.scenario.actors) {
      const actor = await concord.actors.register({
        id: makeId("ActorId", actorInput.id),
        kind: actorInput.kind,
        displayName: actorInput.id,
        identities: [{ namespace: "scenario", subject: actorInput.id }],
        capabilities: [{ id: actorInput.runtime ?? `${actorInput.id}.runtime` }],
      });
      state.actors.set(actorInput.id, actor);
    }
    const createdBy = firstActor(state).id;
    state.initialKnowledgeVersion = await seedKnowledge(stores.knowledgeStore, input.scenario, input.scenarioPath, createdBy);
    for (const policyInput of input.scenario.policies) {
      await concord.policies.registerPolicy({
        policy: scenarioPolicy(policyInput),
        decisionRecord: seedDecisionRecord(`seed-policy-${policyInput.actionType}`),
      });
    }
    const goal = await concord.goals.create({
      ...(input.scenario.goal.id ? { id: makeId("GoalId", input.scenario.goal.id) } : {}),
      title: input.scenario.goal.title,
      description: input.scenario.goal.description,
      createdBy,
    });
    state.goalId = goal.id;

    for (const step of input.scenario.loop) {
      await executeStep(step, concord, state, eventStore);
    }

    const events = await eventStore.query();
    const latestKnowledgeVersion = await stores.knowledgeStore.getLatestVersion();
    const stateView = createStateView({ events, knowledgeVersionId: String((latestKnowledgeVersion as { id?: string } | null)?.id ?? "kv") as never });
    await stores.projectionStore.saveStateView(stateView);
    await eventStore.append(createEvent({ type: "StateViewUpdated", payload: stateView, ...correlation(state.action?.id) }));
    const trace = await recorder.finish({
      snapshots: {
        workOrders: state.workOrder ? [state.workOrder] : [],
        submissions: state.submission ? [state.submission] : [],
        reviews: state.review ? [state.review] : [],
        knowledgeCandidates: state.knowledgeCandidate ? [state.knowledgeCandidate] : [],
        knowledgeVersions: [state.initialKnowledgeVersion, latestKnowledgeVersion].filter(Boolean),
        stateViews: [stateView],
      },
      finalState: {
        latestStateView: stateView,
        ...(latestKnowledgeVersion ? { latestKnowledgeVersion } : {}),
      },
    });

    const verifier = new DefaultTraceVerifier();
    const invariantRunner = new DefaultInvariantRunner();
    const verification =
      input.verify || input.scenario.expectations?.verifyTrace
        ? await verifier.verify(trace, {
            runInvariants: async (verifiedTrace) =>
              (
                await invariantRunner.run(verifiedTrace, {
                  ...(input.scenario.expectations?.invariants?.mustPass
                    ? { include: input.scenario.expectations.invariants.mustPass }
                    : {}),
                })
              ).results.map((result) => ({
                id: result.id,
                name: result.name,
                status: result.status,
                ...(result.message === undefined ? {} : { message: result.message }),
                ...(result.details === undefined ? {} : { details: result.details }),
              })),
          })
        : undefined;
    if (verification) trace.verification = verification;
    const replay = input.replay || input.scenario.expectations?.replayTrace ? await new DefaultTraceReplayer().replay(trace) : undefined;

    if (input.traceOut) {
      await mkdir(dirname(resolve(input.traceOut)), { recursive: true });
      await writeFile(resolve(input.traceOut), exportTraceJson(trace));
    }

    return {
      ok: (!verification || verification.ok) && (!replay || replay.ok),
      trace,
      ...(verification ? { verification } : {}),
      ...(replay ? { replay } : {}),
    };
  }
}

async function executeStep(step: ScenarioLoopStep, concord: ReturnType<typeof createConcord>, state: ScenarioState, eventStore: { append(event: never): Promise<void> }): Promise<void> {
  switch (step.type) {
    case "create_context": {
      const actor = getActor(state, step.actor);
      state.contextBundle = await concord.context.createBundle({ goalId: state.goalId as never, actorId: actor.id });
      state.contextReceipt = await concord.context.acceptBundle({ actorId: actor.id, contextBundleId: state.contextBundle.id });
      return;
    }
    case "observe": {
      await eventStore.append(createEvent({ type: "StateObservationSubmitted", actorId: getActor(state, step.actor).id, payload: { summary: step.summary } }) as never);
      return;
    }
    case "propose_action": {
      const actor = getActor(state, step.actor);
      state.action = await concord.actions.propose({
        type: step.actionType,
        proposedBy: actor.id,
        goalId: state.goalId as never,
        title: step.title,
        description: step.description,
        riskLevel: step.riskLevel ?? "low",
        context: requireValue(state.contextReceipt, "context receipt"),
        inputs: [{ uri: `scenario://${state.scenario.id}/observation` }],
      });
      return;
    }
    case "evaluate_policy": {
      await concord.actions.evaluate({ action: requireValue(state.action, "action"), actor: getActor(state, state.scenario.actors[0]!.id), context: requireValue(state.contextBundle, "context") });
      return;
    }
    case "delegate_vote": {
      const voter = getActor(state, step.voters[0] ?? state.scenario.actors[0]!.id);
      const negotiation = await concord.negotiation.create({
        action: requireValue(state.action, "action"),
        protocolId: "delegate-fast-vote",
        participants: step.voters.map((id) => getActor(state, id)),
        context: requireValue(state.contextReceipt, "context receipt"),
      });
      await concord.negotiation.submitPosition({
        negotiationId: negotiation.id,
        position: {
          actorId: voter.id,
          stance: step.vote === "approve" ? "support" : step.vote === "reject" ? "oppose" : "abstain",
          rationale: step.rationale ?? "Scenario delegate vote.",
          evidence: [],
        },
      });
      state.decision = await concord.negotiation.close({ negotiationId: negotiation.id, votingRule: { quorum: 1, threshold: 0.5 } });
      return;
    }
    case "create_work_order": {
      state.workOrder = await concord.work.createWorkOrder({
        actionId: requireValue(state.action, "action").id,
        goalId: state.goalId as never,
        title: step.title,
        description: step.title,
        requiredCapabilities: [],
        contextBundleId: requireValue(state.contextBundle, "context").id,
      });
      if (step.assignee) await concord.work.claim({ actorId: getActor(state, step.assignee).id, workOrderId: state.workOrder.id });
      return;
    }
    case "claim_work": {
      await concord.work.claim({ actorId: getActor(state, step.actor).id, workOrderId: requireValue(state.workOrder, "work order").id });
      return;
    }
    case "run_runtime": {
      state.execution = await concord.runtime.execute({ actorId: getActor(state, step.actor).id, workOrder: requireValue(state.workOrder, "work order"), context: requireValue(state.contextBundle, "context") });
      return;
    }
    case "submit_work": {
      state.submission = await concord.work.submit({
        workOrderId: requireValue(state.workOrder, "work order").id,
        submittedBy: getActor(state, step.actor).id,
        contextReceipt: requireValue(state.execution, "runtime execution").executionReceipt.inputContext,
        executionReceipt: requireValue(state.execution, "runtime execution").executionReceipt,
        artifacts: requireValue(state.execution, "runtime execution").submissionDraft.artifacts,
        summary: step.summary ?? requireValue(state.execution, "runtime execution").submissionDraft.summary,
      });
      return;
    }
    case "review": {
      state.review = await concord.review.submitReview({
        target: { kind: "submission", submissionId: requireValue(state.submission, "submission").id },
        reviewerId: getActor(state, step.reviewer).id,
        result: step.result,
        ...(step.score === undefined ? {} : { score: step.score }),
        rationale: step.rationale,
        evidence: requireValue(state.submission, "submission").artifacts,
        contextReceipt: requireValue(state.contextReceipt, "context receipt"),
      });
      state.workOrder = step.result === "accept" ? await concord.work.accept(requireValue(state.workOrder, "work order").id) : await concord.work.reject(requireValue(state.workOrder, "work order").id);
      return;
    }
    case "create_knowledge_candidate": {
      const submission = requireValue(state.submission, "submission");
      state.knowledgeCandidate = {
        id: makeId("KnowledgeCandidateId", `candidate_${state.scenario.id}`),
        proposedBy: getActor(state, step.actor).id,
        source: { uri: `scenario://submission/${submission.id}`, hash: sha256(submission) },
        summary: step.summary ?? submission.summary,
        targetLayer: step.layer,
        context: requireValue(state.contextReceipt, "context receipt"),
      };
      await concord.knowledge.saveCandidate(state.knowledgeCandidate);
      await eventStore.append(
        createEvent({
          type: "KnowledgeCandidateCreated",
          actorId: getActor(state, step.actor).id,
          payload: state.knowledgeCandidate,
          ...correlation(state.action?.id),
        }) as never,
      );
      return;
    }
    case "commit_knowledge": {
      const parent = await concord.knowledge.getLatestVersion();
      const version = await concord.knowledge.commit({
        candidateIds: [requireValue(state.knowledgeCandidate, "knowledge candidate").id],
        decisionRecordId: requireValue(state.decision, "decision").id,
        parentVersionId: requireValue(parent, "parent knowledge").id,
        createdBy: getActor(state, step.actor).id,
      });
      await eventStore.append(
        createEvent({
          type: "KnowledgeCommitted",
          actorId: getActor(state, step.actor).id,
          payload: {
            id: requireValue(version.commitIds.at(-1), "knowledge commit id"),
            candidateIds: [state.knowledgeCandidate!.id],
            decisionRecordId: state.decision!.id,
            parentVersionId: parent!.id,
          },
          ...correlation(state.action?.id),
        }) as never,
      );
      await eventStore.append(
        createEvent({
          type: "KnowledgeVersionCreated",
          actorId: getActor(state, step.actor).id,
          payload: version,
          ...correlation(state.action?.id),
        }) as never,
      );
      state.latestKnowledgeVersion = version;
      return;
    }
    default:
      return;
  }
}

function createStores(scenario: ScenarioFile) {
  if (scenario.store?.type === "sqlite") {
    const filename = scenario.store.path ?? ":memory:";
    const eventStore = new SQLiteEventStore(filename);
    return {
      eventStore,
      projectionStore: new SQLiteProjectionStore(filename, eventStore.db),
      knowledgeStore: new SQLiteKnowledgeStore(filename, eventStore.db),
    };
  }
  return { eventStore: new MemoryEventStore(), projectionStore: new MemoryProjectionStore(), knowledgeStore: new MemoryKnowledgeStore() };
}

async function seedKnowledge(knowledgeStore: MemoryKnowledgeStore | SQLiteKnowledgeStore, scenario: ScenarioFile, scenarioPath: string, createdBy: ActorId) {
  const seed = await Promise.all(
    (scenario.initialKnowledge ?? []).map(async (knowledge) => {
      const path = resolve(dirname(resolve(scenarioPath)), knowledge.path);
      return { ...knowledge, content: await readFile(path, "utf8") };
    }),
  );
  return knowledgeStore.seedInitialVersion({ id: makeId("KnowledgeVersionId", `knowledge_${scenario.id}_bootstrap`), createdBy, seed });
}

function scenarioPolicy(policyInput: ScenarioFile["policies"][number]): ActionPolicy {
  return {
    id: makeId("ActionPolicyId", `policy_${policyInput.actionType}`),
    version: version("1.0.0"),
    actionType: policyInput.actionType,
    eligibility: [],
    requiredContext: [],
    decisionFlow: policyInput.decisionFlow,
    ...(policyInput.votingRule ? { votingRule: policyInput.votingRule } : {}),
    produces: policyInput.produces as never,
    resultBinding: policyInput.resultBinding ?? "binding",
  };
}

function seedDecisionRecord(id: string): DecisionRecord {
  return {
    id: makeId("DecisionRecordId", id),
    source: "manual",
    result: "approved",
    summary: "Seed scenario policy.",
    approvals: [],
    rejections: [],
    abstentions: [],
    unresolvedIssues: [],
    outputArtifacts: [],
    createdAt: nowTimestamp(),
  };
}

function getActor(state: ScenarioState, id: string): Actor {
  return requireValue(state.actors.get(id), `actor ${id}`);
}

function firstActor(state: ScenarioState): Actor {
  return requireValue([...state.actors.values()][0], "first actor");
}

function requireValue<T>(value: T | null | undefined, label: string): T {
  if (!value) throw new Error(`Missing ${label}`);
  return value;
}

function correlation(actionId: string | undefined): { correlationId: string } | Record<string, never> {
  return actionId ? { correlationId: actionId } : {};
}
