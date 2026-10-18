import "server-only";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { readAuthConfig } from "@/lib/auth/config";
import { managementResponse as respond } from "./management-response";
import { HouseholdError } from "./households";
/** Cookie/write/error boundary for authenticated household routes. */
export async function householdRoute(
  request: Request,
  householdId: string | null,
  write: boolean,
  action: (userId: string) => Promise<Response>,
) {
  try {
    const user = await getCurrentUser(request.headers);
    if (!user) return respond({ error: "UNAUTHENTICATED" }, 401);
    if (write) {
      const origin = readAuthConfig(process.env)?.baseURL;
      if (!origin || request.headers.get("origin") !== origin)
        return respond({ error: "FORBIDDEN" }, 403);
    }
    if (householdId !== null && !z.string().uuid().safeParse(householdId).success)
      return respond({ error: "NOT_FOUND" }, 404);
    return await action(user.id);
  } catch (cause) {
    return cause instanceof HouseholdError
      ? respond({ error: cause.code }, cause.status)
      : respond({ error: "INTERNAL_ERROR" }, 500);
  }
}
export async function readHouseholdBody(request: Request): Promise<unknown> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json"
  )
    throw new HouseholdError(415, "INVALID_INPUT");
  const reader = request.body?.getReader();
  if (!reader) throw new HouseholdError(400, "INVALID_INPUT");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        throw new HouseholdError(413, "PAYLOAD_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HouseholdError(400, "INVALID_INPUT");
  }
}
