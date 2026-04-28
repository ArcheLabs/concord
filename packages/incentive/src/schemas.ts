import { z } from "zod";

export const RewardKindSchema = z.enum([
  "work_reward",
  "observer_reward",
  "delegate_reward",
  "review_reward",
  "knowledge_reward",
  "risk_report_reward",
  "tip",
  "retroactive_reward",
]);

export const RewardStatusSchema = z.enum([
  "draft",
  "reserved",
  "approved",
  "claimable",
  "claimed",
  "settled",
  "rejected",
  "disputed",
  "cancelled",
]);

export const RewardPolicyTriggerSchema = z.enum([
  "work_accepted",
  "review_completed",
  "observer_completed",
  "delegate_voted",
  "knowledge_committed",
  "risk_report_valid",
]);
