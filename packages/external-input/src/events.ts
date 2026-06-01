import type { EventEnvelope, ExternalInputId, ObservationQueueItemId } from "@vibly-ai/concord-foundation";
import type {
  ExternalInput,
  InputClassification,
  InputDeduplicationResult,
  InputRiskAssessment,
  InputRoutingDecision,
  Observation,
  ObservationQueueItem,
} from "./types.js";

// ─── Event Types ──────────────────────────────────────────────────────────────

export type ExternalInputSubmittedEvent = EventEnvelope<
  "ExternalInputSubmitted",
  { input: ExternalInput }
>;

export type ExternalInputClassifiedEvent = EventEnvelope<
  "ExternalInputClassified",
  { inputId: ExternalInputId; classification: InputClassification }
>;

export type ExternalInputRiskAssessedEvent = EventEnvelope<
  "ExternalInputRiskAssessed",
  { inputId: ExternalInputId; assessment: InputRiskAssessment }
>;

export type ExternalInputDeduplicatedEvent = EventEnvelope<
  "ExternalInputDeduplicated",
  { inputId: ExternalInputId; result: InputDeduplicationResult }
>;

export type ExternalInputRoutedEvent = EventEnvelope<
  "ExternalInputRouted",
  { inputId: ExternalInputId; decision: InputRoutingDecision }
>;

export type ExternalInputRejectedEvent = EventEnvelope<
  "ExternalInputRejected",
  { inputId: ExternalInputId; reason: string }
>;

export type ExternalInputArchivedEvent = EventEnvelope<
  "ExternalInputArchived",
  { inputId: ExternalInputId; reason: string }
>;

export type ObservationQueueItemEnqueuedEvent = EventEnvelope<
  "ObservationQueueItemEnqueued",
  { item: ObservationQueueItem }
>;

export type ObservationQueueItemAssignedEvent = EventEnvelope<
  "ObservationQueueItemAssigned",
  { queueItemId: ObservationQueueItemId; observerId: string }
>;

export type ObservationRecordedEvent = EventEnvelope<
  "ObservationRecorded",
  { observation: Observation }
>;

export type ExternalInputAcceptedEvent = EventEnvelope<
  "ExternalInputAccepted",
  { inputId: ExternalInputId; observationId: string }
>;

// ─── Union ────────────────────────────────────────────────────────────────────

export type ExternalInputEvent =
  | ExternalInputSubmittedEvent
  | ExternalInputClassifiedEvent
  | ExternalInputRiskAssessedEvent
  | ExternalInputDeduplicatedEvent
  | ExternalInputRoutedEvent
  | ExternalInputRejectedEvent
  | ExternalInputArchivedEvent
  | ObservationQueueItemEnqueuedEvent
  | ObservationQueueItemAssignedEvent
  | ObservationRecordedEvent
  | ExternalInputAcceptedEvent;
