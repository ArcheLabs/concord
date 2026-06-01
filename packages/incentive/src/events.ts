import type { EventEnvelope, FundingReceiptId, RewardIntentId, RewardPolicyId } from "@vibly-ai/concord-foundation";
import type { FundingReceipt, RewardIntent, RewardPolicy } from "./types.js";

export type RewardPolicyCreatedEvent = EventEnvelope<"RewardPolicyCreated", { policy: RewardPolicy }>;
export type RewardIntentProposedEvent = EventEnvelope<"RewardIntentProposed", { intent: RewardIntent }>;
export type RewardIntentApprovedEvent = EventEnvelope<"RewardIntentApproved", { intentId: RewardIntentId }>;
export type RewardIntentRejectedEvent = EventEnvelope<"RewardIntentRejected", { intentId: RewardIntentId; reason: string }>;
export type FundingReservedEvent = EventEnvelope<"FundingReserved", { intentId: RewardIntentId; receipt: FundingReceipt }>;
export type RewardClaimableEvent = EventEnvelope<"RewardClaimable", { intentId: RewardIntentId }>;
export type RewardClaimedEvent = EventEnvelope<"RewardClaimed", { intentId: RewardIntentId }>;
export type RewardSettledEvent = EventEnvelope<"RewardSettled", { intentId: RewardIntentId; settlementIntentId: string }>;
export type RewardCancelledEvent = EventEnvelope<"RewardCancelled", { intentId: RewardIntentId; reason: string }>;

export type IncentiveEvent =
  | RewardPolicyCreatedEvent
  | RewardIntentProposedEvent
  | RewardIntentApprovedEvent
  | RewardIntentRejectedEvent
  | FundingReservedEvent
  | RewardClaimableEvent
  | RewardClaimedEvent
  | RewardSettledEvent
  | RewardCancelledEvent;
