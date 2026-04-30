/**
 * E2E test: M10 (External Input) → M11 (Selection/Reputation) → M13 (Incentive/Settlement)
 *
 * Scenario:
 * 1. Submit a bug report as external input and run the processing pipeline.
 * 2. Use selection service to assign an observer via reputation_weighted strategy.
 * 3. Acquire a work-claim lease for the selected worker.
 * 4. Record reputation evidence for the worker after accepted work.
 * 5. Propose a reward intent, approve and reserve funding, mark claimable/claimed/settled.
 * 6. Create and process a settlement intent; verify final status.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createConcord } from "./index.js";
import { MockLedger, MockFundingGateway as MockLedgerFundingGateway } from "@concord/adapters-mock-ledger";
import { makeId, version } from "@concord/foundation";

describe("E2E: M10 → M11 → M13", () => {
  let sdk: ReturnType<typeof createConcord>;
  let mockLedger: MockLedger;

  const projectId = makeId("ProjectId");
  const submitterId = makeId("ActorId");
  const observerId = makeId("ActorId");
  const workerId = makeId("ActorId");

  beforeEach(() => {
    mockLedger = new MockLedger();

    const m13FundingGateway = new MockLedgerFundingGateway(mockLedger, {
      [projectId]: { asset: "USDC", amount: "1000" },
    });

    sdk = createConcord({ m13FundingGateway });
  });

  it("full pipeline: submit input → select observer → reputation → reward → settlement", async () => {
    // ── M10: Submit and process external input ──────────────────────────────
    const { input, queueItem } = await sdk.externalInputs.processInput(
      projectId,
      { kind: "github_issue", namespace: "github", externalId: "issue-42" },
      {
        title: "Crash on startup",
        body: "Null pointer in init.ts",
        submittedBy: submitterId,
      },
    );

    expect(input.status).toBe("awaiting_observation");
    expect(queueItem).toBeDefined();
    expect(queueItem!.status).toBe("queued");

    const queueItemId = queueItem!.id;

    // ── M11: Select observer and assign ────────────────────────────────────
    const policy = await sdk.selection.createPolicy({
      projectId,
      role: "observer",
      strategy: "reputation_weighted",
      filters: [],
      version: version(),
    });

    const selected = await sdk.selection.select(
      [{ actorId: observerId, reputationScore: 0.8 }],
      policy,
    );
    expect(selected).toBe(observerId);

    // Assign the queue item to the selected observer
    const assigned = await sdk.externalInputs.assignObserver(queueItemId, observerId);
    expect(assigned.status).toBe("assigned");
    expect(assigned.assignedObserverId).toBe(observerId);

    // ── M11: Acquire work-claim lease ───────────────────────────────────────
    const lease = await sdk.leases.acquire(
      projectId,
      "work_claim",
      input.id,
      workerId,
      60_000,
    );
    expect(lease.status).toBe("active");

    // ── M11: Record reputation evidence ────────────────────────────────────
    const evidence = await sdk.reputation.recordEvidence(
      workerId,
      projectId,
      "work_accepted",
      0.9,
    );
    expect(evidence.score).toBe(0.9);

    const repScore = await sdk.reputation.getScore(workerId, projectId);
    expect(repScore).toBeDefined();
    expect(repScore!.normalizedScore).toBeGreaterThan(0);

    // ── M13: Propose and approve reward ────────────────────────────────────
    const reward = await sdk.incentives.proposeReward(
      projectId,
      "work_reward",
      workerId,
      { asset: "USDC", amount: "100" },
      "completed external input investigation",
      "work-order",
    );
    expect(reward.status).toBe("draft");

    const approved = await sdk.incentives.approveReward(reward.id);
    expect(approved.status).toBe("approved");

    const { intent: reserved } = await sdk.incentives.reserveFunding(reward.id);
    expect(reserved.status).toBe("reserved");

    const claimable = await sdk.incentives.markClaimable(reward.id);
    expect(claimable.status).toBe("claimable");

    const claimed = await sdk.incentives.markClaimed(reward.id);
    expect(claimed.status).toBe("claimed");

    // ── M13: Settlement intent ──────────────────────────────────────────────
    const settlementIntent = await sdk.settlement.createSettlementIntent(
      projectId,
      workerId,
      [reward.id],
      { asset: "USDC", amount: "100" },
      "reward settlement for external input work",
    );
    expect(settlementIntent.status).toBe("pending");

    const settled = await sdk.incentives.markSettled(reward.id, settlementIntent.id);
    expect(settled.status).toBe("settled");

    const { intent: processed } = await sdk.settlement.processSettlement(settlementIntent.id);
    expect(processed.status).toBe("completed");
  });

  it("failover service registers and queries failover records", async () => {
    const targetId = makeId("ActorId");
    const replacementId = makeId("ActorId");
    const originalLeaseId = makeId("LeaseId");

    const record = await sdk.failover.recordFailover(
      projectId,
      "observer_failover",
      targetId,
      originalLeaseId,
      "timeout",
      { replacementActorId: replacementId },
    );

    expect(record.failedActorId).toBe(targetId);
    expect(record.replacementActorId).toBe(replacementId);

    const records = await sdk.failover.listFailovers(projectId);
    expect(records).toHaveLength(1);
  });
});
