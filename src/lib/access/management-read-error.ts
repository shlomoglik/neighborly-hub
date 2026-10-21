import "server-only";
import { logger } from "@/lib/logging";

/** SQLSTATE is safe to log; raw driver errors can contain SQL and private parameters. */
export function logManagementReadError(operation: "projects" | "hierarchy", cause: unknown) {
  logger.error("management.read.failed", cause, { operation });
}
