import { spawn } from "node:child_process";
import type {
  AgentRuntimeAdapter,
  AssetAmount,
  CapabilityDescriptor,
  ContextBundle,
  ContextReceipt,
  CoordinationGateway,
  FundingGateway,
  FundingReceipt,
  GovernanceGateway,
  GovernanceReceipt,
  RoleAssignment,
  RuntimeExecutionResult,
  WorkOrder,
} from "@concord/core";
import {
  createEvent,
  type ActorId,
  type EventEnvelope,
  makeId,
  nowTimestamp,
  sha256,
} from "@concord/foundation";

export { MemoryKnowledgeStore, SQLiteKnowledgeStore } from "@concord/knowledge";
export { createStateView, MemoryEventStore, MemoryProjectionStore, SQLiteEventStore, SQLiteProjectionStore } from "@concord/state";

export class MockRuntimeAdapter implements AgentRuntimeAdapter {
  readonly id = "mock-runtime";

  async describeCapabilities(_actorId: ActorId): Promise<CapabilityDescriptor[]> {
    return [{ id: "mock.execute", description: "Deterministic mock execution" }];
  }

  async execute(input: { actorId: ActorId; workOrder: WorkOrder; context: ContextBundle }): Promise<RuntimeExecutionResult> {
    const summary = `Mock execution completed for work order ${input.workOrder.id}: ${input.workOrder.title}`;
    const artifacts = [
      {
        uri: `memory://submissions/${input.workOrder.id}`,
        mediaType: "text/plain",
        hash: sha256({ summary, workOrderId: input.workOrder.id }),
      },
    ];
    return {
      submissionDraft: { summary, artifacts },
      executionReceipt: {
        runtimeId: this.id,
        actorId: input.actorId,
        startedAt: nowTimestamp(),
        finishedAt: nowTimestamp(),
        inputContext: receiptFromBundle(input.context, input.actorId),
        outputHash: sha256({ summary, artifacts }),
        status: "success",
      },
    };
  }
}

export class ScriptRuntimeAdapter implements AgentRuntimeAdapter {
  readonly id: string;

  constructor(
    private readonly command: string,
    private readonly args: string[] = [],
    id = "script-runtime",
  ) {
    this.id = id;
  }

  async describeCapabilities(_actorId: ActorId): Promise<CapabilityDescriptor[]> {
    return [{ id: "script.execute", description: `Executes ${this.command}` }];
  }

  async execute(input: { actorId: ActorId; workOrder: WorkOrder; context: ContextBundle }): Promise<RuntimeExecutionResult> {
    const startedAt = nowTimestamp();
    const payload = JSON.stringify(input);
    const output = await runJsonProcess(this.command, this.args, payload);
    const parsed = JSON.parse(output) as Partial<RuntimeExecutionResult>;
    const summary = parsed.submissionDraft?.summary ?? `Script execution completed for ${input.workOrder.id}`;
    const artifacts = parsed.submissionDraft?.artifacts ?? [];

    return {
      submissionDraft: { summary, artifacts },
      executionReceipt: {
        runtimeId: this.id,
        actorId: input.actorId,
        startedAt,
        finishedAt: nowTimestamp(),
        inputContext: receiptFromBundle(input.context, input.actorId),
        logs: [{ uri: `process://${this.command}` }],
        outputHash: sha256({ summary, artifacts }),
        status: parsed.executionReceipt?.status ?? "success",
      },
    };
  }
}

export class MockFundingGateway implements FundingGateway {
  async reserve(input: unknown): Promise<FundingReceipt> {
    return this.receipt("reserved", input);
  }

  async claim(input: unknown): Promise<FundingReceipt> {
    return this.receipt("claimed", input);
  }

  async query(input: unknown): Promise<{ status: string; input: unknown }> {
    return { status: "mocked", input };
  }

  private async receipt(status: string, input: unknown): Promise<FundingReceipt> {
    return { id: makeId("IncentiveIntentId"), status, artifact: { uri: "mock://funding", hash: sha256(input) } };
  }
}

export class MockGovernanceGateway implements GovernanceGateway {
  async submitProposal(input: unknown): Promise<GovernanceReceipt> {
    return this.receipt("submitted", input);
  }

  async vote(input: unknown): Promise<GovernanceReceipt> {
    return this.receipt("voted", input);
  }

  async execute(input: unknown): Promise<GovernanceReceipt> {
    return this.receipt("executed", input);
  }

  async getStatus(input: unknown): Promise<{ status: string; input: unknown }> {
    return { status: "mocked", input };
  }

  private async receipt(status: string, input: unknown): Promise<GovernanceReceipt> {
    return { id: makeId("GovernanceIntentId"), status, artifact: { uri: "mock://governance", hash: sha256(input) } };
  }
}

export class SimpleCoordinatorGateway implements CoordinationGateway {
  private readonly events: EventEnvelope<string, unknown>[] = [];

  async publishEvent(event: EventEnvelope<string, unknown>): Promise<void> {
    this.events.push(event);
  }

  async *subscribe(input: { type?: string[] } = {}): AsyncIterable<EventEnvelope<string, unknown>> {
    for (const event of this.events) {
      if (!input.type?.length || input.type.includes(event.type)) {
        yield event;
      }
    }
  }

  async assignRole(input: {
    actorId: ActorId;
    role: RoleAssignment["role"];
    scope?: RoleAssignment["scope"];
  }): Promise<RoleAssignment> {
    return {
      actorId: input.actorId,
      role: input.role,
      scope: input.scope ?? {},
      validFrom: nowTimestamp(),
      source: "coordinator",
    };
  }

  async acquireLease(input: { resourceId: string; holderId: ActorId; ttlMs: number }): Promise<{ id: string; expiresAt: { iso: string } }> {
    return {
      id: `${input.resourceId}:${input.holderId}`,
      expiresAt: { iso: new Date(Date.now() + input.ttlMs).toISOString() },
    };
  }

  async broadcastContext(input: { contextBundle: ContextBundle; recipients?: ActorId[] }): Promise<void> {
    this.events.push(
      createEvent({
        type: "ContextBroadcast",
        payload: input,
      }),
    );
  }
}

export function receiptFromBundle(context: ContextBundle, actorId: ActorId): ContextReceipt {
  return {
    contextBundleId: context.id,
    stateViewId: context.stateViewId,
    stateViewVersion: context.stateViewVersion,
    knowledgeVersionId: context.knowledgeVersionId,
    knowledgeHash: context.knowledgeHash,
    protocolVersion: context.protocolVersion,
    actionPolicyVersion: context.actionPolicyVersion,
    acceptedAt: nowTimestamp(),
    actorId,
  };
}

export function defaultReward(asset = "VIB", amount = "1"): { amount: AssetAmount; reason: string } {
  return { amount: { asset, amount }, reason: "MVP mock reward" };
}

function runJsonProcess(command: string, args: string[], input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Script runtime failed with code ${code}: ${stderr}`));
      }
    });
    child.stdin.end(input);
  });
}
