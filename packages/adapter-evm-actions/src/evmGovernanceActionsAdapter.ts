import type {
  GovernanceActionsPort,
  GovernanceSubjectRef,
  GovernanceVoteStance,
  GovernanceProposalSummary,
} from "@vibly-ai/concord-governance";
import type { ChainRef, TxReceipt } from "@vibly-ai/concord-core";
import { mapStanceToSupport } from "./evmStatusMapping.js";

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function fixtureReceipt(chain: ChainRef, label: string): TxReceipt {
  return {
    txHash: `0xfixture_${label}_${Date.now().toString(16)}`,
    chain,
    finality: "pending",
  };
}

function notSupportedError(method: string): Error {
  return new Error(
    `EvmGovernanceActionsAdapter: ${method} is not supported by EVM Governor contracts. ` +
    "EVM Governor uses token-based voting weight, not explicit delegation."
  );
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export interface EvmActionsConfig {
  /** Chain to operate on. Defaults to EVM chainId 31337 (Anvil). */
  chain?: ChainRef;
}

/**
 * EvmGovernanceActionsAdapter
 *
 * Implements GovernanceActionsPort for OpenZeppelin Governor-style EVM contracts.
 *
 * Design notes:
 * - Phase D uses fixture receipts (no live RPC / wallet required).
 * - `delegate` / `undelegate` are explicitly unsupported — EVM Governor uses
 *   token-based voting weight; delegation is handled at the token level, not
 *   at the governance level.
 * - Phase E+ can replace fixtureReceipt() with real viem/ethers calls.
 */
export class EvmGovernanceActionsAdapter implements GovernanceActionsPort {
  readonly kind = "evm-governor" as const;

  private readonly chain: ChainRef;

  constructor(config: EvmActionsConfig = {}) {
    this.chain = config.chain ?? { namespace: "eip155", chainId: "31337" };
  }

  async prepareProposal(input: {
    chain: ChainRef;
    actor: string;
    title: string;
    description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ chain: ChainRef; actor: string; payload: unknown; summary: GovernanceProposalSummary }> {
    const chain = input.chain;
    const descriptionHash = `0x${Buffer.from(input.description ?? input.title).toString("hex")}`;
    const payload = {
      targets: [] as string[],
      values: [] as string[],
      calldatas: [] as string[],
      description: input.description ?? input.title,
      descriptionHash,
    };
    const summary: GovernanceProposalSummary = {
      ref: { chain, backend: "evm-governor", externalId: "" },
      title: input.title,
      proposer: input.actor,
      status: "Pending",
    };
    if (input.description !== undefined) summary.description = input.description;
    return { chain, actor: input.actor, payload, summary };
  }

  async submitProposal(input: {
    chain: ChainRef;
    actor: string;
    payload: unknown;
  }): Promise<TxReceipt> {
    return fixtureReceipt(input.chain, "submit");
  }

  async prepareVote(input: {
    subject: GovernanceSubjectRef;
    voter: string;
    stance: GovernanceVoteStance;
    weight?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ subject: GovernanceSubjectRef; voter: string; payload: unknown }> {
    return {
      subject: input.subject,
      voter: input.voter,
      payload: {
        support: mapStanceToSupport(input.stance),
        reason: input.reason ?? "",
      },
    };
  }

  async castVote(input: {
    subject: GovernanceSubjectRef;
    voter: string;
    payload: unknown;
  }): Promise<TxReceipt> {
    // Phase D: returns fixture receipt without requiring a live signer.
    // Phase E+: replace with real viem call.
    return fixtureReceipt(input.subject.chain, "castVote");
  }

  async queueExecution(input: {
    subject: GovernanceSubjectRef;
    actor: string;
    metadata?: Record<string, unknown>;
  }): Promise<TxReceipt> {
    return fixtureReceipt(input.subject.chain, "queue");
  }

  async executeProposal(input: {
    subject: GovernanceSubjectRef;
    actor: string;
    metadata?: Record<string, unknown>;
  }): Promise<TxReceipt> {
    return fixtureReceipt(input.subject.chain, "execute");
  }

  async delegate(_input: {
    chain: ChainRef;
    delegator: string;
    delegatee: string;
    scope?: string;
    conviction?: string;
    metadata?: Record<string, unknown>;
  }): Promise<TxReceipt> {
    throw notSupportedError("delegate");
  }

  async undelegate(_input: {
    chain: ChainRef;
    delegator: string;
    scope?: string;
  }): Promise<TxReceipt> {
    throw notSupportedError("undelegate");
  }
}
