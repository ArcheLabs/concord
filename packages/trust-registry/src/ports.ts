import type {
  ChainRef,
  TxReceipt,
  IndexCursor,
  NormalizedChainEvent,
} from "@vibly-ai/concord-core";
import type {
  TrustRegistryBackendKind,
  TrustSubjectRef,
  FeedbackRecord,
  ValidationRecord,
} from "./types.js";
import type { TrustRegistryEventType } from "./events.js";

// ─── Actions Port ────────────────────────────────────────────────────────────

export interface TrustRegistryActionsPort {
  readonly kind: TrustRegistryBackendKind;

  giveFeedback(input: {
    subject: TrustSubjectRef;
    actor: string;
    value: string;
    valueDecimals: number;
    tag1?: string;
    tag2?: string;
    endpoint?: string;
    feedbackURI?: string;
    feedbackHash?: string;
  }): Promise<TxReceipt>;

  revokeFeedback?(input: {
    subject: TrustSubjectRef;
    actor: string;
    feedbackIndex: string;
  }): Promise<TxReceipt>;

  appendResponse?(input: {
    subject: TrustSubjectRef;
    actor: string;
    clientAddress: string;
    feedbackIndex: string;
    responseURI: string;
    responseHash?: string;
  }): Promise<TxReceipt>;

  requestValidation?(input: {
    subject: TrustSubjectRef;
    actor: string;
    validatorAddress: string;
    requestURI: string;
    requestHash: string;
  }): Promise<TxReceipt>;

  submitValidationResponse?(input: {
    subject: TrustSubjectRef;
    actor: string;
    requestHash: string;
    response: number;
    responseURI?: string;
    responseHash?: string;
    tag?: string;
  }): Promise<TxReceipt>;
}

// ─── Query Port ──────────────────────────────────────────────────────────────

export interface TrustRegistryQueryPort {
  readonly kind: TrustRegistryBackendKind;

  getFeedback(input: {
    subject: TrustSubjectRef;
    clientAddress: string;
    feedbackIndex: string;
  }): Promise<FeedbackRecord | null>;

  listFeedback(input: {
    subject: TrustSubjectRef;
    clientAddresses?: string[];
    tag1?: string;
    tag2?: string;
    includeRevoked?: boolean;
  }): Promise<FeedbackRecord[]>;

  getFeedbackSummary(input: {
    subject: TrustSubjectRef;
    clientAddresses?: string[];
    tag1?: string;
    tag2?: string;
  }): Promise<{
    count: number;
    summaryValue?: string;
    summaryValueDecimals?: number;
  } | null>;

  getValidationStatus(input: {
    subject: TrustSubjectRef;
    requestHash: string;
  }): Promise<ValidationRecord | null>;

  listAgentValidations(input: {
    subject: TrustSubjectRef;
  }): Promise<ValidationRecord[]>;
}

// ─── Indexer Port ────────────────────────────────────────────────────────────

export interface TrustRegistryIndexerPort {
  readonly kind: TrustRegistryBackendKind;

  backfill(input: {
    chain: ChainRef;
    from?: IndexCursor;
    to?: IndexCursor;
  }): Promise<NormalizedChainEvent<TrustRegistryEventType>[]>;

  subscribe(input: {
    chain: ChainRef;
    from?: IndexCursor;
  }): AsyncIterable<NormalizedChainEvent<TrustRegistryEventType>>;

  resolveFeedbackState(input: {
    subject: TrustSubjectRef;
    clientAddress: string;
    feedbackIndex: string;
  }): Promise<FeedbackRecord | null>;

  resolveValidationState(input: {
    subject: TrustSubjectRef;
    requestHash: string;
  }): Promise<ValidationRecord | null>;
}
