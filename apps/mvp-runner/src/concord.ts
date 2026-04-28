import { DefaultInvariantRunner } from "@concord/invariants";
import { DefaultScenarioRunner } from "@concord/scenario";
import { DefaultTraceReplayer, DefaultTraceVerifier, loadTrace } from "@concord/trace";

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
  } else {
    usage(2);
  }
} catch (error) {
  console.error((error as Error).message);
  process.exit(2);
}

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
  console.error("Usage: concord scenario run <scenario.yaml> [--trace-out path] [--verify] [--replay]");
  console.error("       concord trace verify <trace.json> [--strict] [--json] [--skip id]");
  console.error("       concord trace replay <trace.json> [--store memory|sqlite] [--sqlite-path path] [--stop-after n]");
  console.error("       concord trace run <scenario.yaml>");
  process.exit(code);
}
