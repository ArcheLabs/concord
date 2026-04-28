import { readFile } from "node:fs/promises";
import type { ProtocolTrace } from "./types.js";
import { TraceParseError } from "./errors.js";

export function parseTraceJson(input: string): ProtocolTrace {
  try {
    const value = JSON.parse(input) as ProtocolTrace;
    if (!value || typeof value !== "object" || !Array.isArray(value.events) || typeof value.traceId !== "string") {
      throw new Error("Trace must include traceId and events");
    }
    return value;
  } catch (error) {
    throw new TraceParseError("Invalid protocol trace JSON", error);
  }
}

export async function loadTrace(path: string): Promise<ProtocolTrace> {
  return parseTraceJson(await readFile(path, "utf8"));
}
