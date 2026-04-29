import type { ChainRef } from "@concord/core";

// ─── Backend Kind ─────────────────────────────────────────────────────────────

export type AgentDirectoryBackendKind =
  | "eip8004-identity"
  | "substrate-agent-identity"
  | "unknown";

// ─── Registration Reference ──────────────────────────────────────────────────

export interface AgentRegistrationRef {
  chain: ChainRef;
  backend: AgentDirectoryBackendKind;
  registryId: string;
  agentId: string;
}

// ─── Registration Record ─────────────────────────────────────────────────────

export interface AgentRegistrationRecord {
  ref: AgentRegistrationRef;
  owner: string;
  agentURI?: string;
  wallet?: string;
  active?: boolean;
  name?: string;
  description?: string;
  image?: string;
  services?: Array<{
    name: string;
    endpoint: string;
    version?: string;
  }>;
  supportedTrust?: string[];
  metadata?: Record<string, unknown>;
  updatedAt?: string;
}
