import type { EventEnvelope, SettlementIntentId, SlashIntentId } from "@concord/foundation";
import type { SettlementIntent, SettlementReceipt, SlashIntent } from "./types.js";

export type SettlementIntentCreatedEvent = EventEnvelope<"SettlementIntentCreated", { intent: SettlementIntent }>;
export type SettlementCompletedEvent = EventEnvelope<"SettlementCompleted", { receipt: SettlementReceipt }>;
export type SettlementFailedEvent = EventEnvelope<"SettlementFailed", { intentId: SettlementIntentId; reason: string }>;
export type SettlementCancelledEvent = EventEnvelope<"SettlementCancelled", { intentId: SettlementIntentId }>;
export type SlashProposedEvent = EventEnvelope<"SlashProposed", { intent: SlashIntent }>;
export type SlashExecutedEvent = EventEnvelope<"SlashExecuted", { intentId: SlashIntentId }>;
export type SlashCancelledEvent = EventEnvelope<"SlashCancelled", { intentId: SlashIntentId; reason: string }>;

export type SettlementEvent =
  | SettlementIntentCreatedEvent
  | SettlementCompletedEvent
  | SettlementFailedEvent
  | SettlementCancelledEvent
  | SlashProposedEvent
  | SlashExecutedEvent
  | SlashCancelledEvent;
