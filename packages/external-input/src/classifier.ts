import { makeId, nowTimestamp } from "@concord/foundation";
import type { ExternalInput, InputCategory, InputClassification } from "./types.js";
import type { InputClassifier } from "./ports.js";

const BUG_KEYWORDS = ["bug", "error", "crash", "broken", "fix", "failure", "exception"];
const RISK_KEYWORDS = ["risk", "attack", "exploit", "vulnerability", "security", "threat", "danger"];
const PROPOSAL_KEYWORDS = ["proposal", "should", "suggest", "recommend", "建议", "propose", "enhancement", "feature request"];
const KNOWLEDGE_KEYWORDS = ["documentation", "wiki", "reference", "learn", "explain", "how to", "guide", "tutorial"];
const TASK_KEYWORDS = ["task", "todo", "action item", "implement", "create", "build", "develop"];
const QUESTION_KEYWORDS = ["?", "how", "what", "why", "when", "where", "who"];
const SPAM_KEYWORDS = ["buy now", "click here", "free", "earn money", "limited offer"];

function matchesAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

export class DefaultInputClassifier implements InputClassifier {
  async classify(input: ExternalInput): Promise<Omit<InputClassification, "id" | "createdAt">> {
    const text = `${input.title ?? ""} ${input.body ?? ""}`.trim();

    if (!text || matchesAny(text, SPAM_KEYWORDS)) {
      return {
        inputId: input.id,
        classifiedBy: "rule_engine",
        category: text ? "spam" : "spam",
        labels: ["auto-classified"],
        rationale: "Matched spam keyword patterns or empty content",
      };
    }

    let category: InputCategory = "unknown";
    const labels: string[] = [];

    if (matchesAny(text, BUG_KEYWORDS)) {
      category = "bug";
      labels.push("bug");
    } else if (matchesAny(text, RISK_KEYWORDS)) {
      category = "risk";
      labels.push("risk");
    } else if (matchesAny(text, KNOWLEDGE_KEYWORDS)) {
      category = "knowledge_candidate";
      labels.push("knowledge");
    } else if (matchesAny(text, TASK_KEYWORDS)) {
      category = "task_suggestion";
      labels.push("task");
    } else if (matchesAny(text, PROPOSAL_KEYWORDS)) {
      category = "proposal";
      labels.push("proposal");
    } else if (matchesAny(text, QUESTION_KEYWORDS)) {
      category = "question";
      labels.push("question");
    }

    return {
      inputId: input.id,
      classifiedBy: "rule_engine",
      category,
      confidence: category === "unknown" ? 0.3 : 0.75,
      labels,
      rationale: `Matched keyword rules for category "${category}"`,
    };
  }
}
