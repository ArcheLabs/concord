import { sha256 } from "@vibly-ai/concord-foundation";
import type { ExternalInput, InputDeduplicationResult } from "./types.js";
import type { InputDeduper } from "./ports.js";

export class DefaultDeduper implements InputDeduper {
  async deduplicate(
    input: ExternalInput,
    existing: ExternalInput[],
  ): Promise<Omit<InputDeduplicationResult, "id" | "createdAt">> {
    // Priority 1: match by source externalId + namespace
    if (input.source.externalId && input.source.namespace) {
      const match = existing.find(
        (e) =>
          e.id !== input.id &&
          e.source.externalId === input.source.externalId &&
          e.source.namespace === input.source.namespace,
      );
      if (match) {
        return {
          inputId: input.id,
          isDuplicate: true,
          duplicateOf: match.id,
          matchedBy: "source_external_id",
          similarityScore: 1.0,
        };
      }
    }

    // Priority 2: match by URI
    if (input.source.uri) {
      const match = existing.find((e) => e.id !== input.id && e.source.uri === input.source.uri);
      if (match) {
        return {
          inputId: input.id,
          isDuplicate: true,
          duplicateOf: match.id,
          matchedBy: "uri",
          similarityScore: 1.0,
        };
      }
    }

    // Priority 3: match by body hash
    if (input.body) {
      const bodyHash = sha256(input.body).value;
      const match = existing.find(
        (e) => e.id !== input.id && e.body && sha256(e.body).value === bodyHash,
      );
      if (match) {
        return {
          inputId: input.id,
          isDuplicate: true,
          duplicateOf: match.id,
          matchedBy: "hash",
          similarityScore: 1.0,
        };
      }
    }

    return {
      inputId: input.id,
      isDuplicate: false,
      matchedBy: "hash",
    };
  }
}
