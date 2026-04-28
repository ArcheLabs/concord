import type { ExternalInput, InputRiskAssessment, InputRiskFlag, InputRiskLevel } from "./types.js";
import type { InputRiskAssessor } from "./ports.js";

export class DefaultRiskAssessor implements InputRiskAssessor {
  async assess(input: ExternalInput): Promise<Omit<InputRiskAssessment, "id" | "createdAt">> {
    const text = `${input.title ?? ""} ${input.body ?? ""}`.toLowerCase();
    const flags: InputRiskFlag[] = [];
    let riskLevel: InputRiskLevel = "low";

    // Detect flags
    if (text.includes("ignore previous") || text.includes("disregard") || text.includes("system prompt")) {
      flags.push("prompt_injection");
    }
    if (text.includes("http://") || text.includes("https://") || text.includes("bit.ly") || text.includes("tinyurl")) {
      // Only flag as malicious if paired with suspicious context
      if (text.includes("click") || text.includes("download") || text.includes("free")) {
        flags.push("malicious_link");
      }
    }
    if (
      text.includes("financial") ||
      text.includes("fund") ||
      text.includes("treasury") ||
      text.includes("budget") ||
      text.includes("token") ||
      text.includes("payment")
    ) {
      flags.push("financial_impact");
    }
    if (
      text.includes("governance") ||
      text.includes("vote") ||
      text.includes("policy") ||
      text.includes("protocol change")
    ) {
      flags.push("governance_impact");
    }

    const category = input.classification?.category;
    if (category === "spam") {
      flags.push("spam");
      riskLevel = "medium";
    }

    // Determine risk level
    if (flags.includes("prompt_injection") || flags.includes("malicious_link")) {
      riskLevel = "high";
    }
    if (flags.includes("financial_impact") && flags.includes("governance_impact")) {
      riskLevel = "critical";
    } else if (flags.includes("financial_impact") || flags.includes("governance_impact")) {
      if (riskLevel === "low") riskLevel = "high";
    }

    return {
      inputId: input.id,
      assessedBy: "rule_engine",
      riskLevel,
      flags,
      rationale: flags.length === 0 ? "No risk indicators detected" : `Risk flags: ${flags.join(", ")}`,
    };
  }
}
