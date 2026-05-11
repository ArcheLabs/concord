import { readFile } from "node:fs/promises";
import { DefaultInvariantRunner } from "@concord/invariants";
import { DefaultScenarioRunner } from "@concord/scenario";
import {
  ActionIntentSchema,
  CoordinationMechanismSchema,
  DeterministicRandomSource,
  DomainEventSchema,
  createSQLiteConcord,
  randomFromQualified,
} from "@concord/sdk";
import { DefaultTraceReplayer, DefaultTraceVerifier, loadTrace } from "@concord/trace";
import { parse as parseYaml } from "yaml";

const args = process.argv.slice(2);
const command = args[0];
const subcommand = args[1];

try {
  if (command === "scenario" && subcommand === "run") {
    await runScenario(args.slice(2), false);
  } else if (command === "trace" && subcommand === "run") {
    await runScenario(args.slice(2), true);
  } else if (command === "trace" && subcommand === "verify") {
    await verifyTrace(args.slice(2));
  } else if (command === "trace" && subcommand === "replay") {
    await replayTrace(args.slice(2));
  } else if (command === "project") {
    await handleProject(subcommand, args.slice(2));
  } else if (command === "objective") {
    await handleObjective(subcommand, args.slice(2));
  } else if (command === "boundary") {
    await handleBoundary(subcommand, args.slice(2));
  } else if (command === "principal") {
    await handlePrincipal(subcommand, args.slice(2));
  } else if (command === "agent") {
    await handleAgent(subcommand, args.slice(2));
  } else if (command === "v02" && subcommand === "demo") {
    await runV02Demo();
  } else {
    usage(2);
  }
} catch (error) {
  console.error((error as Error).message);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// v0.2 domain-contract demo
// ---------------------------------------------------------------------------

async function runV02Demo(): Promise<void> {
  const createdAt = { iso: "2026-01-01T00:00:00.000Z" };
  const mechanism = CoordinationMechanismSchema.parse({
    id: "mechanism_observation_to_task",
    organizationId: "org_demo",
    projectId: "project_demo",
    name: "Observation to task",
    version: { value: "0.2.0" },
    status: "enabled",
    rules: {
      assignment: [{ type: "random_from_qualified", count: 1 }],
      participation: [{ type: "min_participants", count: 2 }],
      voting: [{ type: "majority_threshold", percent: 0.5 }],
      timeout: [{ type: "assignment_response_deadline", seconds: 3600 }],
      reward: [{ type: "fixed_reward", asset: "VIB", amount: "10" }],
      reputation: [{ type: "onAccepted", delta: 1 }],
    },
    createdAt,
    updatedAt: createdAt,
  });
  const observer = randomFromQualified(
    [
      { actorId: "agent_observer_a" as never, reputationScore: 1 },
      { actorId: "agent_observer_b" as never, reputationScore: 2 },
    ],
    1,
    new DeterministicRandomSource("v02-demo"),
  )[0];
  const intent = ActionIntentSchema.parse({
    id: "intent_create_observation_task",
    type: "CreateObservationTask",
    actorId: "agent_guardian",
    organizationId: "org_demo",
    projectId: "project_demo",
    payload: { title: "Observe project risk", mechanismId: mechanism.id },
    createdAt,
  });
  const events = [
    event("ObservationTaskCreated", "observation_task", "observation_task_demo", intent.id, { mechanismId: mechanism.id }),
    event("AssignmentOffered", "assignment_offer", "assignment_offer_demo", "event_ObservationTaskCreated", { offeredTo: observer }),
    event("ObservationCreated", "observation", "observation_demo", "event_AssignmentOffered", { summary: "No blocker found" }),
    event("DiscussionRoundCreated", "discussion_round", "discussion_round_demo", "event_ObservationCreated", { participants: [observer] }),
    event("DiscussionOutcomeRecorded", "discussion_outcome", "discussion_outcome_demo", "event_DiscussionRoundCreated", { outcome: "proposal_created" }),
    event("ProposalSubmitted", "proposal", "proposal_demo", "event_DiscussionOutcomeRecorded", { title: "Create follow-up task" }),
    event("TaskCreated", "task", "task_demo", "event_ProposalSubmitted", { title: "Implement follow-up" }),
  ];

  console.log(JSON.stringify({ mechanism: mechanism.id, selectedObserver: observer, intent: intent.type, causalChain: events.map((item) => item.type) }, null, 2));
}

function event(type: string, kind: string, id: string, causationId: string, payload: Record<string, unknown>) {
  return DomainEventSchema.parse({
    id: `event_${type}`,
    type,
    aggregateRef: { kind, id },
    objectRefs: [{ kind, id }],
    actorId: "agent_guardian",
    organizationId: "org_demo",
    projectId: "project_demo",
    causationId,
    payload,
    createdAt: { iso: "2026-01-01T00:00:00.000Z" },
    schemaVersion: { value: "0.2.0" },
  });
}

// ---------------------------------------------------------------------------
// Scenario / Trace commands (unchanged)
// ---------------------------------------------------------------------------

async function runScenario(args: string[], traceRun: boolean): Promise<void> {
  const scenarioPath = args[0];
  if (!scenarioPath) usage(2);
  const options = parseOptions(args.slice(1));
  const traceOutOption = options["trace-out"];
  const traceOut = typeof traceOutOption === "string" ? traceOutOption : traceRun ? `traces/${basenameWithoutExt(scenarioPath)}.trace.json` : undefined;
  const result = await new DefaultScenarioRunner().run({
    scenarioPath: userPath(scenarioPath),
    ...(traceOut ? { traceOut: userPath(traceOut) } : {}),
    verify: traceRun || Boolean(options.verify),
    replay: traceRun || Boolean(options.replay),
  });
  console.log(`Scenario: ${result.trace.scenario?.scenarioId ?? result.trace.traceId}`);
  console.log(`Events: ${result.trace.events.length}`);
  if (traceOut) console.log(`Trace: ${traceOut}`);
  if (result.verification) console.log(`Verify: ${result.verification.ok ? "PASS" : "FAIL"}`);
  if (result.replay) console.log(`Replay: ${result.replay.ok ? "PASS" : "FAIL"}`);
  console.log(`Result: ${result.ok ? "PASS" : "FAIL"}`);
  process.exit(result.ok ? 0 : 1);
}

async function verifyTrace(args: string[]): Promise<void> {
  const path = args[0];
  if (!path) usage(2);
  const options = parseOptions(args.slice(1));
  const trace = await loadTrace(userPath(path));
  const invariantRunner = new DefaultInvariantRunner();
  const report = await new DefaultTraceVerifier().verify(trace, {
    strict: Boolean(options.strict),
    skipInvariants: collectOptions(args, "--skip"),
    runInvariants: async (verifiedTrace) =>
      (await invariantRunner.run(verifiedTrace, { exclude: collectOptions(args, "--skip") })).results.map((result) => ({
        id: result.id,
        name: result.name,
        status: result.status,
        ...(result.message === undefined ? {} : { message: result.message }),
        ...(result.details === undefined ? {} : { details: result.details }),
      })),
  });
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const passed = report.invariantResults.filter((result) => result.status === "pass").length;
    const failed = report.invariantResults.filter((result) => result.status === "fail").length;
    const warnings = report.warnings.length + report.invariantResults.filter((result) => result.status === "warn").length;
    console.log(`Trace: ${report.traceId}`);
    console.log(`Events: ${report.eventCount}`);
    console.log(`Invariants: ${passed} passed, ${failed} failed, ${warnings} warnings`);
    console.log(`Result: ${report.ok ? "PASS" : "FAIL"}`);
    for (const error of report.errors) {
      console.log(`[${error.code}] ${error.message}`);
    }
  }
  process.exit(report.ok ? 0 : 1);
}

async function replayTrace(args: string[]): Promise<void> {
  const path = args[0];
  if (!path) usage(2);
  const options = parseOptions(args.slice(1));
  const sqlitePath = typeof options["sqlite-path"] === "string" ? options["sqlite-path"] : undefined;
  const stopAfter = typeof options["stop-after"] === "string" ? Number(options["stop-after"]) : undefined;
  const result = await new DefaultTraceReplayer().replay(await loadTrace(userPath(path)), {
    store: options.store === "sqlite" ? "sqlite" : "memory",
    ...(sqlitePath ? { sqlitePath } : {}),
    ...(stopAfter === undefined ? {} : { stopAfterEventCount: stopAfter }),
  });
  console.log(`Replay: ${result.ok ? "ok" : "failed"}`);
  console.log(`Events replayed: ${result.replayedEventCount}`);
  if (result.latestStateView && typeof result.latestStateView === "object" && "id" in result.latestStateView) {
    console.log(`Latest StateView: ${String(result.latestStateView.id)}`);
  }
  if (result.latestKnowledgeVersion && typeof result.latestKnowledgeVersion === "object" && "id" in result.latestKnowledgeVersion) {
    console.log(`Latest KnowledgeVersion: ${String(result.latestKnowledgeVersion.id)}`);
  }
  console.log(`Event root: sha256:${result.eventRoot?.value ?? ""}`);
  process.exit(result.ok ? 0 : 1);
}

// ---------------------------------------------------------------------------
// M9: project commands
// ---------------------------------------------------------------------------

async function handleProject(sub: string | undefined, args: string[]): Promise<void> {
  const opts = parseOptions(args);
  const db = getDb(opts);
  const sdk = createSQLiteConcord(db);

  if (sub === "create") {
    const filePath = requireOpt(opts, "file", "project create");
    const yaml = parseYaml(await readFile(userPath(filePath), "utf8")) as Record<string, unknown>;
    const project = await sdk.projects.createProject({
      slug: requireField(yaml, "slug"),
      name: requireField(yaml, "name"),
      ...(yaml.description ? { description: String(yaml.description) } : {}),
      sponsorPrincipalId: requireField(yaml, "sponsor") as never,
      boundary: { createdBy: requireField(yaml, "sponsor") as never, ...(yaml.boundary as object ?? {}) },
    });
    printProject(project);

  } else if (sub === "list") {
    const projects = await sdk.projects.listProjects();
    if (projects.length === 0) { console.log("No projects."); return; }
    for (const p of projects) printProject(p);

  } else if (sub === "inspect") {
    const idOrSlug = args[0];
    if (!idOrSlug) usage(2);
    const project = await sdk.projects.getProject(idOrSlug as never) ?? await sdk.projects.getProjectBySlug(idOrSlug);
    if (!project) { console.error(`Project not found: ${idOrSlug}`); process.exit(1); }
    console.log(JSON.stringify(project, null, 2));

  } else if (sub === "activate") {
    const idOrSlug = requirePositional(args, 0, "project activate");
    const project = await resolveProject(sdk, idOrSlug);
    const actor = requireOpt(opts, "actor", "project activate");
    const updated = await sdk.projects.activateProject({ projectId: project.id, actorId: actor as never });
    printProject(updated);

  } else if (sub === "pause") {
    const idOrSlug = requirePositional(args, 0, "project pause");
    const project = await resolveProject(sdk, idOrSlug);
    const actor = requireOpt(opts, "actor", "project pause");
    const reason = requireOpt(opts, "reason", "project pause");
    const updated = await sdk.projects.pauseProject({ projectId: project.id, actorId: actor as never, reason });
    printProject(updated);

  } else if (sub === "archive") {
    const idOrSlug = requirePositional(args, 0, "project archive");
    const project = await resolveProject(sdk, idOrSlug);
    const actor = requireOpt(opts, "actor", "project archive");
    const reason = requireOpt(opts, "reason", "project archive");
    const updated = await sdk.projects.archiveProject({ projectId: project.id, actorId: actor as never, reason });
    printProject(updated);

  } else if (sub === "add-member") {
    const projectIdOrSlug = requireOpt(opts, "project", "project add-member");
    const project = await resolveProject(sdk, projectIdOrSlug);
    const principalId = requireOpt(opts, "principal", "project add-member");
    const agentId = typeof opts.agent === "string" ? opts.agent : undefined;
    const roles = requireOpt(opts, "roles", "project add-member").split(",");
    const membership = await sdk.agents.addProjectMember({
      projectId: project.id,
      principalId: principalId as never,
      ...(agentId ? { agentId: agentId as never } : {}),
      roles: roles as never,
      source: "manual",
    });
    console.log(`Membership: ${membership.id} | principal:${membership.principalId} | roles:${membership.roles.join(",")}`);

  } else {
    usage(2);
  }
}

// ---------------------------------------------------------------------------
// M9: objective commands
// ---------------------------------------------------------------------------

async function handleObjective(sub: string | undefined, args: string[]): Promise<void> {
  const opts = parseOptions(args);
  const db = getDb(opts);
  const sdk = createSQLiteConcord(db);

  if (sub === "create") {
    const projectIdOrSlug = requireOpt(opts, "project", "objective create");
    const project = await resolveProject(sdk, projectIdOrSlug);
    const filePath = requireOpt(opts, "file", "objective create");
    const yaml = parseYaml(await readFile(userPath(filePath), "utf8")) as Record<string, unknown>;
    const actor = typeof opts.actor === "string" ? opts.actor : project.sponsorPrincipalId;
    const objective = await sdk.objectives.createObjective({
      projectId: project.id,
      title: requireField(yaml, "title"),
      description: requireField(yaml, "description"),
      kind: requireField(yaml, "kind") as never,
      successCriteria: (yaml.successCriteria as never[]) ?? [],
      ...(yaml.forbiddenOutcomes ? { forbiddenOutcomes: yaml.forbiddenOutcomes as string[] } : {}),
      ...(yaml.priority !== undefined ? { priority: Number(yaml.priority) } : {}),
      createdBy: actor as never,
    });
    console.log(`Objective: ${objective.id} | ${objective.title} | ${objective.status}`);

  } else if (sub === "list") {
    const projectIdOrSlug = requireOpt(opts, "project", "objective list");
    const project = await resolveProject(sdk, projectIdOrSlug);
    const objectives = await sdk.objectives.listObjectives(project.id);
    if (objectives.length === 0) { console.log("No objectives."); return; }
    for (const o of objectives) console.log(`${o.id} | ${o.kind} | ${o.status} | ${o.title}`);

  } else if (sub === "activate") {
    const objectiveId = requirePositional(args, 0, "objective activate");
    const actor = requireOpt(opts, "actor", "objective activate");
    const updated = await sdk.objectives.activateObjective({ objectiveId: objectiveId as never, actorId: actor as never });
    console.log(`Objective: ${updated.id} | ${updated.status}`);

  } else if (sub === "set-primary") {
    const projectIdOrSlug = requireOpt(opts, "project", "objective set-primary");
    const project = await resolveProject(sdk, projectIdOrSlug);
    const objectiveId = requireOpt(opts, "objective", "objective set-primary");
    const actor = requireOpt(opts, "actor", "objective set-primary");
    const updated = await sdk.objectives.setPrimaryObjective({
      projectId: project.id,
      objectiveId: objectiveId as never,
      actorId: actor as never,
    });
    console.log(`Project: ${updated.id} | primaryObjective: ${updated.primaryObjectiveId ?? "none"}`);

  } else if (sub === "close") {
    const objectiveId = requirePositional(args, 0, "objective close");
    const actor = requireOpt(opts, "actor", "objective close");
    const status = requireOpt(opts, "status", "objective close");
    const reason = requireOpt(opts, "reason", "objective close");
    const updated = await sdk.objectives.closeObjective({
      objectiveId: objectiveId as never,
      actorId: actor as never,
      status: status as never,
      reason,
    });
    console.log(`Objective: ${updated.id} | ${updated.status}`);

  } else {
    usage(2);
  }
}

// ---------------------------------------------------------------------------
// M9: boundary commands
// ---------------------------------------------------------------------------

async function handleBoundary(sub: string | undefined, args: string[]): Promise<void> {
  const opts = parseOptions(args);
  const db = getDb(opts);
  const sdk = createSQLiteConcord(db);

  if (sub === "inspect") {
    const projectIdOrSlug = requireOpt(opts, "project", "boundary inspect");
    const project = await resolveProject(sdk, projectIdOrSlug);
    const boundary = await sdk.boundaries.getActiveBoundary(project.id);
    if (!boundary) { console.log("No active boundary."); return; }
    console.log(JSON.stringify(boundary, null, 2));

  } else if (sub === "evaluate") {
    const projectIdOrSlug = requireOpt(opts, "project", "boundary evaluate");
    const project = await resolveProject(sdk, projectIdOrSlug);
    const actionType = requireOpt(opts, "action-type", "boundary evaluate");
    const actor = typeof opts.actor === "string" ? opts.actor : undefined;
    const result = await sdk.boundaries.evaluateAction({
      projectId: project.id,
      actionType,
      ...(actor ? { actor: actor as never } : {}),
    });
    console.log(`ActionType: ${actionType}`);
    console.log(`Allowed: ${result.allowed}`);
    console.log(`RiskLevel: ${result.riskLevel}`);
    if (result.requiredFlow) console.log(`RequiredFlow: ${result.requiredFlow}`);
    if (result.reasons.length) console.log(`Reasons: ${result.reasons.join("; ")}`);

  } else if (sub === "revise") {
    const projectIdOrSlug = requireOpt(opts, "project", "boundary revise");
    const project = await resolveProject(sdk, projectIdOrSlug);
    const actor = requireOpt(opts, "actor", "boundary revise");
    const reason = requireOpt(opts, "reason", "boundary revise");
    const filePath = requireOpt(opts, "file", "boundary revise");
    const yaml = parseYaml(await readFile(userPath(filePath), "utf8")) as Record<string, unknown>;
    const currentBoundary = await sdk.boundaries.getActiveBoundary(project.id);
    if (!currentBoundary) { console.error("No active boundary to revise."); process.exit(1); }
    const boundary = await sdk.boundaries.reviseBoundary({
      projectId: project.id,
      previousBoundaryId: currentBoundary.id,
      actorId: actor as never,
      reason,
      nextBoundary: {
        defaultRiskLevel: (yaml.defaultRiskLevel as never) ?? currentBoundary.defaultRiskLevel,
        prohibitedActions: (yaml.prohibitedActions as never) ?? currentBoundary.prohibitedActions,
        riskRules: (yaml.riskRules as never) ?? currentBoundary.riskRules,
        escalationRules: (yaml.escalationRules as never) ?? currentBoundary.escalationRules,
      },
    });
    console.log(`Boundary: ${boundary.id} | status: ${boundary.status}`);

  } else {
    usage(2);
  }
}

// ---------------------------------------------------------------------------
// M9: principal commands
// ---------------------------------------------------------------------------

async function handlePrincipal(sub: string | undefined, args: string[]): Promise<void> {
  const opts = parseOptions(args);
  const db = getDb(opts);
  const sdk = createSQLiteConcord(db);

  if (sub === "register") {
    const filePath = requireOpt(opts, "file", "principal register");
    const yaml = parseYaml(await readFile(userPath(filePath), "utf8")) as Record<string, unknown>;
    const principal = await sdk.principals.registerPrincipal({
      kind: requireField(yaml, "kind") as never,
      displayName: requireField(yaml, "displayName"),
      ...(yaml.description ? { description: String(yaml.description) } : {}),
      identityBindings: (yaml.identities as Array<{ namespace: string; subject: string }>)?.map((i) => ({ namespace: i.namespace, subject: i.subject })) ?? [],
    });
    console.log(`Principal: ${principal.id} | ${principal.kind} | ${principal.displayName}`);

  } else if (sub === "list") {
    const principals = await sdk.principals.listPrincipals();
    if (principals.length === 0) { console.log("No principals."); return; }
    for (const p of principals) console.log(`${p.id} | ${p.kind} | ${p.status} | ${p.displayName}`);

  } else if (sub === "inspect") {
    const principalId = requirePositional(args, 0, "principal inspect");
    const principal = await sdk.principals.getPrincipal(principalId as never);
    if (!principal) { console.error(`Principal not found: ${principalId}`); process.exit(1); }
    console.log(JSON.stringify(principal, null, 2));

  } else {
    usage(2);
  }
}

// ---------------------------------------------------------------------------
// M9: agent commands
// ---------------------------------------------------------------------------

async function handleAgent(sub: string | undefined, args: string[]): Promise<void> {
  const opts = parseOptions(args);
  const db = getDb(opts);
  const sdk = createSQLiteConcord(db);

  if (sub === "register") {
    const filePath = requireOpt(opts, "file", "agent register");
    const yaml = parseYaml(await readFile(userPath(filePath), "utf8")) as Record<string, unknown>;
    const agent = await sdk.agents.registerAgent({
      principalId: requireField(yaml, "principal") as never,
      displayName: requireField(yaml, "displayName"),
      ...(yaml.description ? { description: String(yaml.description) } : {}),
      capabilities: (yaml.capabilities as Array<{ name: string; tags?: string[] }>)?.map((c) => ({ name: c.name, ...(c.tags ? { tags: c.tags } : {}) })) ?? [],
      eligibleRoles: (yaml.eligibleRoles as never[]) ?? [],
    });
    console.log(`Agent: ${agent.id} | ${agent.displayName} | principal:${agent.principalId}`);

  } else if (sub === "list") {
    const agents = await sdk.agents.listAgents();
    if (agents.length === 0) { console.log("No agents."); return; }
    for (const a of agents) console.log(`${a.id} | ${a.status} | ${a.displayName} | principal:${a.principalId}`);

  } else if (sub === "inspect") {
    const agentId = requirePositional(args, 0, "agent inspect");
    const agent = await sdk.agents.getAgent(agentId as never);
    if (!agent) { console.error(`Agent not found: ${agentId}`); process.exit(1); }
    console.log(JSON.stringify(agent, null, 2));

  } else if (sub === "bind-runtime") {
    const agentId = requireOpt(opts, "agent", "agent bind-runtime");
    const filePath = requireOpt(opts, "file", "agent bind-runtime");
    const yaml = parseYaml(await readFile(userPath(filePath), "utf8")) as Record<string, unknown>;
    const binding = await sdk.agents.createRuntimeBinding({
      agentId: agentId as never,
      runtimeKind: requireField(yaml, "kind") as never,
      runtimeAdapterId: requireField(yaml, "adapterId"),
      ...(yaml.endpoint ? { endpoint: yaml.endpoint as never } : {}),
    });
    console.log(`RuntimeBinding: ${binding.id} | agent:${binding.agentId} | kind:${binding.runtimeKind}`);

  } else {
    usage(2);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDb(opts: Record<string, string | boolean>): string {
  const dbOpt = opts.db;
  if (typeof dbOpt === "string") return userPath(dbOpt);
  const envDb = process.env["CONCORD_DB"];
  return envDb ? userPath(envDb) : userPath("concord.db");
}

async function resolveProject(sdk: ReturnType<typeof createSQLiteConcord>, idOrSlug: string) {
  const project = await sdk.projects.getProject(idOrSlug as never) ?? await sdk.projects.getProjectBySlug(idOrSlug);
  if (!project) { console.error(`Project not found: ${idOrSlug}`); process.exit(1); }
  return project;
}

function printProject(project: { id: string; slug: string; status: string; name: string; primaryObjectiveId?: string | null }): void {
  console.log(`Project: ${project.id} | ${project.slug} | ${project.status} | ${project.name}`);
  if (project.primaryObjectiveId) console.log(`  primaryObjective: ${project.primaryObjectiveId}`);
}

function requirePositional(args: string[], index: number, cmd: string): string {
  const val = args[index];
  if (!val || val.startsWith("--")) { console.error(`${cmd}: missing positional argument`); usage(2); }
  return val;
}

function requireOpt(opts: Record<string, string | boolean>, key: string, cmd: string): string {
  const val = opts[key];
  if (typeof val !== "string") { console.error(`${cmd}: --${key} is required`); usage(2); }
  return val;
}

function requireField(yaml: Record<string, unknown>, key: string): string {
  const val = yaml[key];
  if (!val) throw new Error(`YAML field '${key}' is required`);
  return String(val);
}

function parseOptions(args: string[]): Record<string, string | boolean> {
  const options: Record<string, string | boolean> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
    } else {
      options[key] = next;
      index += 1;
    }
  }
  return options;
}

function collectOptions(args: string[], flag: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag && args[index + 1]) values.push(args[index + 1]!);
  }
  return values;
}

function basenameWithoutExt(path: string): string {
  return path.split("/").at(-1)?.replace(/\.[^.]+$/, "") ?? "trace";
}

function userPath(path: string): string {
  if (path.startsWith("/")) return path;
  return `${process.env.INIT_CWD ?? process.cwd()}/${path}`;
}

function usage(code: number): never {
  console.error("Usage:");
  console.error("  concord scenario run <scenario.yaml> [--trace-out path] [--verify] [--replay]");
  console.error("  concord trace verify <trace.json> [--strict] [--json] [--skip id]");
  console.error("  concord trace replay <trace.json> [--store memory|sqlite] [--sqlite-path path] [--stop-after n]");
  console.error("  concord trace run <scenario.yaml>");
  console.error("  concord v02 demo");
  console.error("");
  console.error("  concord project create --file project.yaml [--db path]");
  console.error("  concord project list [--db path]");
  console.error("  concord project inspect <projectIdOrSlug> [--db path]");
  console.error("  concord project activate <projectIdOrSlug> --actor <principalId> [--db path]");
  console.error("  concord project pause <projectIdOrSlug> --actor <principalId> --reason '...' [--db path]");
  console.error("  concord project archive <projectIdOrSlug> --actor <principalId> --reason '...' [--db path]");
  console.error("  concord project add-member --project <id> --principal <id> [--agent <id>] --roles role1,role2 [--db path]");
  console.error("");
  console.error("  concord objective create --project <id> --file objective.yaml [--actor <principalId>] [--db path]");
  console.error("  concord objective list --project <id> [--db path]");
  console.error("  concord objective activate <objectiveId> --actor <principalId> [--db path]");
  console.error("  concord objective set-primary --project <id> --objective <id> --actor <principalId> [--db path]");
  console.error("  concord objective close <objectiveId> --actor <principalId> --status succeeded --reason '...' [--db path]");
  console.error("");
  console.error("  concord boundary inspect --project <id> [--db path]");
  console.error("  concord boundary evaluate --project <id> --action-type <type> [--actor <principalId>] [--db path]");
  console.error("  concord boundary revise --project <id> --file boundary.yaml --actor <principalId> --reason '...' [--db path]");
  console.error("");
  console.error("  concord principal register --file principal.yaml [--db path]");
  console.error("  concord principal list [--db path]");
  console.error("  concord principal inspect <principalId> [--db path]");
  console.error("");
  console.error("  concord agent register --file agent.yaml [--db path]");
  console.error("  concord agent list [--db path]");
  console.error("  concord agent inspect <agentId> [--db path]");
  console.error("  concord agent bind-runtime --agent <agentId> --file runtime.yaml [--db path]");
  process.exit(code);
}
