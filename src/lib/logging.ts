import pino, { type DestinationStream } from "pino";

import { errorDiagnostics } from "./error-diagnostics";

type ErrorContext = { phase?: string; operation?: string };

/** Use static event names and diagnostic fields, never requests, headers or resident data. */
export function createAppLogger(destination?: DestinationStream) {
  const formatLevel = (label: string) => ({ level: label });
  const sink = pino(
    {
      base: null,
      level: process.env.NODE_ENV === "development" ? "debug" : "info",
      formatters: { level: formatLevel },
      browser: { asObject: true, formatters: { level: formatLevel } },
    },
    destination,
  ).child({ service: "neighborly-hub" });
  return {
    error(event: string, cause: unknown, context: ErrorContext = {}) {
      sink.error({ ...context, event, error: errorDiagnostics(cause) }, event);
    },
    warn(event: string, fields: Record<string, unknown>) {
      sink.warn({ ...fields, event }, event);
    },
  };
}

export const logger = createAppLogger();
