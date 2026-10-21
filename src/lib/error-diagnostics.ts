const connectionCodes = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "CONNECT_TIMEOUT",
  "CONNECTION_CLOSED",
  "CONNECTION_ENDED",
]);
const errorHints: Record<string, string> = {
  "42703": "Missing database column. Check that all database/migrations files have been applied.",
  "42P01": "Missing database table. Check that all database/migrations files have been applied.",
  "23505": "Database uniqueness constraint rejected the layout.",
  "23503": "Database foreign-key constraint rejected the layout.",
  "23514": "Database check constraint rejected the layout.",
  "28P01": "Database authentication failed. Check the server database credentials.",
};

/** Driver errors may wrap SQL and private parameters. Never log their messages or stacks. */
export function errorDiagnostics(cause: unknown) {
  let error = cause;
  let code: string | undefined;
  for (let depth = 0; depth < 5 && error && typeof error === "object"; depth++) {
    if (
      "code" in error &&
      typeof error.code === "string" &&
      (/^[0-9A-Z]{5}$/.test(error.code) || connectionCodes.has(error.code))
    ) {
      code = error.code;
      break;
    }
    error = "cause" in error ? error.cause : undefined;
  }
  return {
    code,
    hint:
      code && connectionCodes.has(code)
        ? "Database connection failed. Check PostgreSQL availability and the server database connection."
        : code
          ? errorHints[code]
          : undefined,
  };
}

export const publicErrorReasons = [
  "SERVICE_SETUP_INCOMPLETE",
  "SERVICE_UNAVAILABLE",
  "LAYOUT_CONFLICT",
] as const;
export type PublicErrorReason = (typeof publicErrorReasons)[number];

export function publicErrorReason(cause: unknown): PublicErrorReason | undefined {
  const { code } = errorDiagnostics(cause);
  if (code === "42703" || code === "42P01") return "SERVICE_SETUP_INCOMPLETE";
  if (
    code &&
    (connectionCodes.has(code) ||
      code.startsWith("08") ||
      code === "28P01" ||
      code === "57P03" ||
      code === "53300")
  )
    return "SERVICE_UNAVAILABLE";
  if (code === "23505") return "LAYOUT_CONFLICT";
  return undefined;
}
