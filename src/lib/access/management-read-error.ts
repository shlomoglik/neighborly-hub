import "server-only";

/** SQLSTATE is safe to log; raw driver errors can contain SQL and private parameters. */
export function logManagementReadError(operation: "projects" | "hierarchy", cause: unknown) {
  let error = cause;
  let databaseCode: string | undefined;
  for (let depth = 0; depth < 5 && error && typeof error === "object"; depth++) {
    if ("code" in error && typeof error.code === "string" && /^[0-9A-Z]{5}$/.test(error.code)) {
      databaseCode = error.code;
      break;
    }
    error = "cause" in error ? error.cause : undefined;
  }
  console.error("Management read failed", { operation, databaseCode });
}
