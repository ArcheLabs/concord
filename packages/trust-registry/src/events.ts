// ─── Trust Registry Event Types ──────────────────────────────────────────────

export type TrustRegistryEventType =
  | "FeedbackGiven"
  | "FeedbackRevoked"
  | "FeedbackResponseAppended"
  | "ValidationRequested"
  | "ValidationResponded"
  | "TrustFinalityUpdated";
