import "server-only";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { readAuthConfig } from "@/lib/auth/config";
import { managementResponse as respond } from "./management-response";
import { StaffError } from "./staff";
/** Shared cookie/write/error boundary for the administrator-only staff routes. */
export async function staffRoute(
  request: Request,
  projectId: string,
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
    if (!z.string().uuid().safeParse(projectId).success)
      return respond({ error: "NOT_FOUND" }, 404);
    return await action(user.id);
  } catch (cause) {
    return cause instanceof StaffError
      ? respond({ error: cause.code }, cause.status)
      : respond({ error: "INTERNAL_ERROR" }, 500);
  }
}
export async function readStaffBody(request: Request): Promise<unknown> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json"
  )
    throw new StaffError(415, "INVALID_INPUT");
  const reader = request.body?.getReader();
  if (!reader) throw new StaffError(400, "INVALID_INPUT");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        throw new StaffError(413, "PAYLOAD_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new StaffError(400, "INVALID_INPUT");
  }
}
