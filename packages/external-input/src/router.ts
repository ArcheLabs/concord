import type { ExternalInput, InputRoute, InputRoutingDecision } from "./types.js";
import type { InputRouter } from "./ports.js";

export class DefaultInputRouter implements InputRouter {
  async route(input: ExternalInput): Promise<{ route: InputRoute; reason: string }> {
    const category = input.classification?.category;
    const riskLevel = input.risk?.riskLevel;
    const isDuplicate = input.dedupe?.isDuplicate === true;
    const flags = input.risk?.flags ?? [];

    // Duplicate → archive
    if (isDuplicate) {
      return { route: "archive", reason: "Duplicate of existing input" };
    }

    // Spam → reject
    if (category === "spam") {
      return { route: "reject", reason: "Input classified as spam" };
    }

    // Critical risk → guardian review
    if (riskLevel === "critical" || flags.includes("prompt_injection")) {
      return { route: "guardian_review", reason: `Critical risk or prompt injection detected (${riskLevel})` };
    }

    // Knowledge candidates
    if (category === "knowledge_candidate") {
      return { route: "knowledge_candidate_queue", reason: "Input is a knowledge candidate" };
    }

    // Tasks, proposals, risks, bugs → observation queue
    if (
      category === "task_suggestion" ||
      category === "proposal" ||
      category === "risk" ||
      category === "bug" ||
      category === "idea"
    ) {
      return { route: "observation_queue", reason: `Input category "${category}" requires observation` };
    }

    // High risk without other classification → guardian review
    if (riskLevel === "high") {
      return { route: "guardian_review", reason: "High risk input requires guardian review" };
    }

    // Default → observation queue
    return { route: "observation_queue", reason: `No specific route matched for category "${category ?? "unknown"}"` };
  }
}
