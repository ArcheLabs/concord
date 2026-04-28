export class TraceError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export class TraceParseError extends TraceError {
  constructor(message: string, details?: unknown) {
    super("trace.parse", message, details);
  }
}
