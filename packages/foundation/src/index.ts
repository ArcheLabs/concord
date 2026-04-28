import { createHash, randomUUID } from "node:crypto";

export type Id<T extends string> = string & { readonly __brand: T };

export type ActorId = Id<"ActorId">;
export type GoalId = Id<"GoalId">;
export type LoopId = Id<"LoopId">;
export type ActionId = Id<"ActionId">;
export type EventId = Id<"EventId">;
export type StateViewId = Id<"StateViewId">;
export type KnowledgeVersionId = Id<"KnowledgeVersionId">;
export type KnowledgeCandidateId = Id<"KnowledgeCandidateId">;
export type KnowledgeCommitId = Id<"KnowledgeCommitId">;
export type ContextBundleId = Id<"ContextBundleId">;
export type ActionPolicyId = Id<"ActionPolicyId">;
export type PolicyDecisionId = Id<"PolicyDecisionId">;
export type NegotiationInstanceId = Id<"NegotiationInstanceId">;
export type NegotiationProtocolId = Id<"NegotiationProtocolId">;
export type DecisionRecordId = Id<"DecisionRecordId">;
export type WorkOrderId = Id<"WorkOrderId">;
export type WorkClaimId = Id<"WorkClaimId">;
export type SubmissionId = Id<"SubmissionId">;
export type ReviewRecordId = Id<"ReviewRecordId">;
export type IncentiveIntentId = Id<"IncentiveIntentId">;
export type GovernanceIntentId = Id<"GovernanceIntentId">;

export interface Version {
  value: string;
}

export interface Timestamp {
  iso: string;
}

export interface Hash {
  algorithm: "sha256";
  value: string;
}

export interface SchemaRef {
  uri: string;
  version?: Version;
}

export interface SignatureRef {
  algorithm: string;
  publicKey: string;
  value: string;
}

export interface ReceiptRef {
  uri: string;
  hash?: Hash;
}

export interface ArtifactRef {
  uri: string;
  hash?: Hash;
  mediaType?: string;
  schema?: SchemaRef;
}

export interface EventEnvelope<TType extends string = string, TPayload = unknown> {
  id: EventId;
  type: TType;
  version: Version;
  timestamp: Timestamp;
  actorId?: ActorId;
  causationId?: EventId;
  correlationId?: string;
  payload: TPayload;
  hash: Hash;
  signature?: SignatureRef;
}

export function makeId<T extends string>(kind: T, value = `${kind.toLowerCase()}_${randomUUID()}`): Id<T> {
  return value as Id<T>;
}

export function nowTimestamp(): Timestamp {
  return { iso: new Date().toISOString() };
}

export function version(value = "1.0.0"): Version {
  return { value };
}

export function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  const source = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    const item = source[key];
    if (item !== undefined) {
      output[key] = canonicalize(item);
    }
  }
  return output;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function sha256(value: unknown): Hash {
  return {
    algorithm: "sha256",
    value: createHash("sha256").update(canonicalJson(value)).digest("hex"),
  };
}

export function eventHashInput<TType extends string, TPayload>(
  event: Omit<EventEnvelope<TType, TPayload>, "hash"> | EventEnvelope<TType, TPayload>,
): Omit<EventEnvelope<TType, TPayload>, "hash" | "signature"> {
  const { hash: _hash, signature: _signature, ...hashInput } = event as EventEnvelope<TType, TPayload>;
  return hashInput;
}

export function hashEvent<TType extends string, TPayload>(
  event: Omit<EventEnvelope<TType, TPayload>, "hash"> | EventEnvelope<TType, TPayload>,
): Hash {
  return sha256(eventHashInput(event));
}

export function createEvent<TType extends string, TPayload>(input: {
  type: TType;
  payload: TPayload;
  actorId?: ActorId;
  causationId?: EventId;
  correlationId?: string;
  id?: EventId;
  timestamp?: Timestamp;
  version?: Version;
}): EventEnvelope<TType, TPayload> {
  const base: Omit<EventEnvelope<TType, TPayload>, "hash"> = {
    id: input.id ?? makeId("EventId"),
    type: input.type,
    version: input.version ?? version(),
    timestamp: input.timestamp ?? nowTimestamp(),
    payload: input.payload,
    ...(input.actorId ? { actorId: input.actorId } : {}),
    ...(input.causationId ? { causationId: input.causationId } : {}),
    ...(input.correlationId ? { correlationId: input.correlationId } : {}),
  };

  return { ...base, hash: hashEvent(base) };
}

export function assertEventHash(event: EventEnvelope<string, unknown>): void {
  const expected = hashEvent(event);
  if (event.hash.value !== expected.value) {
    throw new Error(`Invalid event hash for ${event.id}`);
  }
}
