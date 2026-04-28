import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { DefaultInvariantRunner } from "@concord/invariants";
import { DefaultTraceReplayer, DefaultTraceVerifier, parseTraceJson } from "@concord/trace";

export function registerTraceRoutes(server: FastifyInstance, input: { traceDir: string }): void {
  server.get("/traces", async () => {
    try {
      const files = (await readdir(input.traceDir)).filter((file) => file.endsWith(".json"));
      return files.map((file) => ({ traceId: file.replace(/\.json$/, ""), path: file }));
    } catch {
      return [];
    }
  });

  server.get("/traces/:traceId", async (request, reply) => {
    const trace = await loadTraceFromDir(input.traceDir, String((request.params as { traceId: string }).traceId));
    if (!trace) return reply.code(404).send({ error: "not_found", resource: "trace" });
    return trace;
  });

  server.post("/traces/:traceId/verify", async (request, reply) => {
    const trace = await loadTraceFromDir(input.traceDir, String((request.params as { traceId: string }).traceId));
    if (!trace) return reply.code(404).send({ error: "not_found", resource: "trace" });
    const invariantRunner = new DefaultInvariantRunner();
    return new DefaultTraceVerifier().verify(trace, {
      runInvariants: async (verifiedTrace) =>
        (await invariantRunner.run(verifiedTrace)).results.map((result) => ({
          id: result.id,
          name: result.name,
          status: result.status,
          ...(result.message === undefined ? {} : { message: result.message }),
          ...(result.details === undefined ? {} : { details: result.details }),
        })),
    });
  });

  server.post("/traces/:traceId/replay", async (request, reply) => {
    const trace = await loadTraceFromDir(input.traceDir, String((request.params as { traceId: string }).traceId));
    if (!trace) return reply.code(404).send({ error: "not_found", resource: "trace" });
    return new DefaultTraceReplayer().replay(trace);
  });
}

async function loadTraceFromDir(traceDir: string, traceId: string) {
  const candidates = [`${traceId}.json`, traceId.endsWith(".json") ? traceId : `${traceId}.trace.json`];
  for (const candidate of candidates) {
    try {
      return parseTraceJson(await readFile(join(traceDir, candidate), "utf8"));
    } catch {
      // Try the next local filename convention.
    }
  }
  return null;
}
