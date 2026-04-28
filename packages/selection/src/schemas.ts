import { z } from "zod";

export const SelectionStrategySchema = z.enum([
  "manual",
  "first_available",
  "round_robin",
  "random",
  "capability_weighted",
  "reputation_weighted",
  "stake_weighted",
  "hybrid",
]);

export const LeaseKindSchema = z.enum([
  "observer_round",
  "candidate_observer",
  "delegate_vote",
  "work_claim",
  "review_assignment",
  "negotiation_participation",
]);

export const LeaseStatusSchema = z.enum([
  "active",
  "renewed",
  "expired",
  "released",
  "revoked",
]);

export const RoleAssignmentStatusSchema = z.enum([
  "active",
  "expired",
  "released",
  "revoked",
  "completed",
]);

export const FailoverKindSchema = z.enum([
  "observer_failover",
  "work_claim_expired",
  "reviewer_non_response",
  "delegate_non_response",
]);
