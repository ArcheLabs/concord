import type { EventEnvelope, ReputationEvidenceId } from "@concord/foundation";
import type { ReputationEvidence, ReputationScore } from "./types.js";

export type ReputationEvidenceRecordedEvent = EventEnvelope<
  "ReputationEvidenceRecorded",
  { evidence: ReputationEvidence }
>;

export type ReputationScoreUpdatedEvent = EventEnvelope<
  "ReputationScoreUpdated",
  { score: ReputationScore }
>;

export type ReputationEvent =
  | ReputationEvidenceRecordedEvent
  | ReputationScoreUpdatedEvent;
