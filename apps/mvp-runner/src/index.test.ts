import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("mvp runner CLI", () => {
  it("prints a complete MVP loop summary", async () => {
    const { stdout } = await execFileAsync("pnpm", ["exec", "tsx", "src/index.ts"], {
      cwd: appDir,
      timeout: 20_000,
    });
    const output = JSON.parse(stdout) as {
      policyDecision: string;
      workOrder: { status: string };
      review: { aggregation: string };
      eventCount: number;
      knowledgeHash: string;
    };

    expect(output.policyDecision).toBe("requires_negotiation");
    expect(output.workOrder.status).toBe("accepted");
    expect(output.review.aggregation).toBe("accepted");
    expect(output.eventCount).toBeGreaterThan(0);
    expect(output.knowledgeHash).toHaveLength(64);
  });

  it("prints a v0.2 organization-aware causal chain demo", async () => {
    const { stdout } = await execFileAsync("pnpm", ["exec", "tsx", "src/concord.ts", "v02", "demo"], {
      cwd: appDir,
      timeout: 20_000,
    });
    const output = JSON.parse(stdout) as { intent: string; causalChain: string[] };

    expect(output.intent).toBe("CreateObservationTask");
    expect(output.causalChain).toEqual([
      "ObservationTaskCreated",
      "AssignmentOffered",
      "ObservationCreated",
      "DiscussionRoundCreated",
      "DiscussionOutcomeRecorded",
      "ProposalSubmitted",
      "TaskCreated",
    ]);
  });
});
