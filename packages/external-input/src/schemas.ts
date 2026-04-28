import { z } from "zod";

export const ExternalInputSourceKindSchema = z.enum([
  "human",
  "agent",
  "a2a_agent",
  "forum",
  "github_issue",
  "github_pr",
  "chain_event",
  "web_page",
  "file",
  "manual_import",
  "other",
]);

export const ExternalInputSourceSchema = z.object({
  kind: ExternalInputSourceKindSchema,
  namespace: z.string().optional(),
  externalId: z.string().optional(),
  uri: z.string().optional(),
  author: z.string().optional(),
  observedAt: z.object({ iso: z.string() }).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const InputCategorySchema = z.enum([
  "idea",
  "bug",
  "risk",
  "proposal",
  "task_suggestion",
  "knowledge_candidate",
  "spam",
  "question",
  "status_update",
  "unknown",
]);

export const InputRiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);

export const InputRiskFlagSchema = z.enum([
  "prompt_injection",
  "financial_impact",
  "governance_impact",
  "malicious_link",
  "spam",
  "pii",
  "off_topic",
]);

export const InputRouteSchema = z.enum([
  "observation_queue",
  "knowledge_candidate_queue",
  "action_suggestion_queue",
  "guardian_review",
  "archive",
  "reject",
]);

export const ExternalInputStatusSchema = z.enum([
  "submitted",
  "classified",
  "deduplicated",
  "routed",
  "awaiting_observation",
  "observed",
  "accepted",
  "rejected",
  "archived",
]);

export const ObservationQueueItemPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);
export const ObservationQueueItemStatusSchema = z.enum([
  "queued",
  "assigned",
  "observed",
  "expired",
  "archived",
]);
export const ObservationOutcomeSchema = z.enum([
  "accepted",
  "rejected",
  "knowledge_candidate",
  "deferred",
]);
