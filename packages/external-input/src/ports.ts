import type { ExternalInput, InputCategory, InputClassification, InputDeduplicationResult, InputRiskAssessment, InputRoute, InputRoutingDecision } from "./types.js";

export interface InputClassifier {
  classify(input: ExternalInput): Promise<Omit<InputClassification, "id" | "createdAt">>;
}

export interface InputRiskAssessor {
  assess(input: ExternalInput): Promise<Omit<InputRiskAssessment, "id" | "createdAt">>;
}

export interface InputDeduper {
  deduplicate(input: ExternalInput, existing: ExternalInput[]): Promise<Omit<InputDeduplicationResult, "id" | "createdAt">>;
}

export interface InputRouter {
  route(input: ExternalInput): Promise<{ route: InputRoute; reason: string }>;
}
