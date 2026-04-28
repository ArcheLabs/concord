import { z } from "zod";

export const SettlementStatusSchema = z.enum([
  "pending", "processing", "completed", "failed", "disputed", "cancelled",
]);

export const SlashStatusSchema = z.enum([
  "pending", "executed", "disputed", "cancelled",
]);
