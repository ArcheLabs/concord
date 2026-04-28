import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createConcord, createSQLiteConcord, ScriptRuntimeAdapter } from "@concord/sdk";

interface CliOptions {
  db?: string;
  runtimeScript?: string;
}

const options = parseArgs(process.argv.slice(2));
if (options.db) {
  mkdirSync(dirname(resolve(options.db)), { recursive: true });
}

const config = options.runtimeScript
  ? { runtimes: [new ScriptRuntimeAdapter(process.execPath, [resolve(options.runtimeScript)])] }
  : {};
const concord = options.db ? createSQLiteConcord(resolve(options.db), config) : createConcord(config);
const result = await concord.loop.runOnce();

console.log(
  JSON.stringify(
    {
      goal: result.goal.title,
      action: result.action.title,
      policyDecision: result.policyDecision.result,
      decisionRecordId: result.decisionRecordId,
      workOrder: {
        id: result.workOrder.id,
        status: result.workOrder.status,
      },
      submission: {
        id: result.submission.id,
        summary: result.submission.summary,
      },
      review: {
        id: result.review.id,
        aggregation: result.reviewAggregation.result,
      },
      stateView: {
        id: result.stateView.id,
        version: result.stateView.version.value,
      },
      knowledgeHash: result.knowledgeHash,
      eventCount: result.eventCount,
    },
    null,
    2,
  ),
);

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--db") {
      const value = args[index + 1];
      if (!value) throw new Error("--db requires a value");
      options.db = value;
      index += 1;
    } else if (arg === "--runtime-script") {
      const value = args[index + 1];
      if (!value) throw new Error("--runtime-script requires a value");
      options.runtimeScript = value;
      index += 1;
    }
  }
  return options;
}
