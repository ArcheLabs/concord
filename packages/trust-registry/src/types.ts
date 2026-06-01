import type { ChainRef } from "@vibly-ai/concord-core";

// ─── Backend Kind ─────────────────────────────────────────────────────────────

export type TrustRegistryBackendKind =
  | "eip8004-reputation"
  | "eip8004-validation"
  | "substrate-trust-registry"
  | "unknown";

// ─── Subject Reference ───────────────────────────────────────────────────────

export interface TrustSubjectRef {
  chain: ChainRef;
  backend: TrustRegistryBackendKind;
  registryId: string;
  subjectId: string;
}

// ─── Feedback Record ─────────────────────────────────────────────────────────

export interface FeedbackRecord {
  subject: TrustSubjectRef;
  clientAddress: string;
  feedbackIndex?: string;
  value: string;
  valueDecimals: number;
  tag1?: string;
  tag2?: string;
  endpoint?: string;
  feedbackURI?: string;
  feedbackHash?: string;
  revoked?: boolean;
  createdAt?: string;
}

// ─── Validation Record ───────────────────────────────────────────────────────

export interface ValidationRecord {
  subject: TrustSubjectRef;
  validatorAddress: string;
  requestHash: string;
  response?: number;
  responseURI?: string;
  responseHash?: string;
  tag?: string;
  lastUpdate?: string;
}
