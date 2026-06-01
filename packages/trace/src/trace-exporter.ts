import { canonicalize } from "@vibly-ai/concord-foundation";
import type { ProtocolTrace } from "./types.js";

export function exportTraceJson(trace: ProtocolTrace): string {
  return `${JSON.stringify(canonicalize(trace), null, 2)}\n`;
}
