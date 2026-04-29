import { z } from "zod";

export const ReputationEvidenceKindSchema = z.enum([
  "work_accepted",
  "work_rejected",
  "review_accurate",
  "review_inaccurate",
  "observation_completed",
  "delegate_participated",
  "delegate_non_response",
  "delegate_revision_accepted",
  "review_consensus_deviation",
  "knowledge_committed",
  "knowledge_rejected",
  "failover_triggered",
  "guardian_escalation",
  "slash",
  "tip",
]);
