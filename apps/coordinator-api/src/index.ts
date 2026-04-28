import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import Fastify from "fastify";
import { createConcord, createSQLiteConcord, type Concord } from "@concord/sdk";
import { registerTraceRoutes } from "./routes/traces.js";

export function buildServer(concord: Concord = createDefaultConcord(), options: { traceDir?: string } = {}) {
  const server = Fastify({ logger: false });

  server.get("/health", async () => ({ status: "ok" }));

  server.post("/actors", async (request) => {
    const body = asRecord(request.body);
    return concord.actors.register({
      kind: (body.kind as never) ?? "agent",
      identities: (body.identities as never) ?? [{ namespace: "local", subject: (body.displayName as string | undefined) ?? "actor" }],
      ...(body.displayName ? { displayName: String(body.displayName) } : {}),
      ...(body.metadata ? { metadata: body.metadata as Record<string, unknown> } : {}),
    });
  });

  server.post("/goals", async (request) => {
    const body = asRecord(request.body);
    return concord.goals.create({
      title: String(body.title ?? "Untitled goal"),
      description: String(body.description ?? ""),
      createdBy: String(body.createdBy) as never,
    });
  });

  server.post("/context-bundles", async (request) => {
    const body = asRecord(request.body);
    return concord.context.createBundle({
      goalId: String(body.goalId) as never,
      actorId: String(body.actorId) as never,
      artifacts: (body.artifacts as never) ?? [],
    });
  });

  server.post("/actions", async (request) => {
    const body = asRecord(request.body);
    return concord.actions.propose({
      type: String(body.type),
      proposedBy: String(body.proposedBy) as never,
      goalId: String(body.goalId) as never,
      title: String(body.title),
      description: String(body.description),
      riskLevel: (body.riskLevel as never) ?? "low",
      context: body.context as never,
      inputs: (body.inputs as never) ?? [],
      ...(body.expectedOutputs ? { expectedOutputs: body.expectedOutputs as never } : {}),
      ...(body.requestedResources ? { requestedResources: body.requestedResources as never } : {}),
    });
  });

  server.post("/actions/:id/evaluate", async (request) => {
    const params = asRecord(request.params);
    const body = asRecord(request.body);
    const action = await concord.actions.get(String(params.id));
    if (!action) {
      return notFound("action");
    }
    const actor = await concord.actors.get(String(body.actorId ?? action.proposedBy) as never);
    if (!actor) {
      return notFound("actor");
    }
    const context = await concord.context.getBundle(String(body.contextBundleId));
    if (!context) {
      return notFound("context");
    }
    return concord.actions.evaluate({ action, actor, context });
  });

  server.post("/work-orders/:id/claim", async (request) => {
    const params = asRecord(request.params);
    const body = asRecord(request.body);
    return concord.work.claim({ workOrderId: String(params.id) as never, actorId: String(body.actorId) as never });
  });

  server.post("/work-orders/:id/submit", async (request) => {
    const params = asRecord(request.params);
    const body = asRecord(request.body);
    return concord.work.submit({
      workOrderId: String(params.id) as never,
      submittedBy: String(body.submittedBy) as never,
      contextReceipt: body.contextReceipt as never,
      executionReceipt: body.executionReceipt as never,
      artifacts: (body.artifacts as never) ?? [],
      summary: String(body.summary ?? ""),
    });
  });

  server.post("/reviews", async (request) => {
    const body = asRecord(request.body);
    return concord.review.submitReview({
      target: body.target as never,
      reviewerId: String(body.reviewerId) as never,
      result: (body.result as never) ?? "accept",
      rationale: String(body.rationale ?? ""),
      evidence: (body.evidence as never) ?? [],
      contextReceipt: body.contextReceipt as never,
      ...(body.score === undefined ? {} : { score: body.score as never }),
    });
  });

  server.post("/loop/run-once", async () => concord.loop.runOnce());

  server.get("/events", async (request) => {
    const query = asRecord(request.query);
    const type = query.type ? String(query.type).split(",") : undefined;
    return concord.state.events.query(type ? { type } : {});
  });

  server.get("/state/latest", async () => concord.state.projections.getLatestStateView());

  server.get("/knowledge/latest", async () => concord.knowledge.getLatestVersion());
  registerTraceRoutes(server, {
    traceDir: options.traceDir ?? process.env.CONCORD_TRACE_DIR ?? `${process.env.INIT_CWD ?? process.cwd()}/traces`,
  });

  return server;
}

function createDefaultConcord(): Concord {
  const db = process.env.CONCORD_DB;
  if (!db) return createConcord();
  const filename = resolve(db);
  mkdirSync(dirname(filename), { recursive: true });
  return createSQLiteConcord(filename);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function notFound(resource: string) {
  return { error: "not_found", resource };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const port = Number(process.env.PORT ?? 3000);
  const server = buildServer();
  await server.listen({ port, host: "0.0.0.0" });
  console.log(`Concord coordinator API listening on http://localhost:${port}`);
}
