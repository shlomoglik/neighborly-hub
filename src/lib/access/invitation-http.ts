import "server-only";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { readAuthConfig } from "@/lib/auth/config";
import { InvitationError } from "./invitations";
export function invitationResponse(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
      "Referrer-Policy": "no-referrer",
    },
  });
}
export const invitationUuid = (value: string) => {
  if (!z.string().uuid().safeParse(value).success) throw new InvitationError(404, "NOT_FOUND");
  return value;
};
export async function invitationRoute(
  request: Request,
  write: boolean,
  action: (userId: string) => Promise<Response>,
) {
  try {
    const user = await getCurrentUser(request.headers);
    if (!user) return invitationResponse({ error: "UNAUTHENTICATED" }, 401);
    if (write) {
      const origin = readAuthConfig(process.env)?.baseURL;
      if (!origin || request.headers.get("origin") !== origin)
        throw new InvitationError(403, "FORBIDDEN");
    }
    return await action(user.id);
  } catch (error) {
    return error instanceof InvitationError
      ? invitationResponse({ error: error.code }, error.status)
      : invitationResponse({ error: "INTERNAL_ERROR" }, 500);
  }
}
export async function invitationBody(request: Request): Promise<unknown> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json"
  )
    throw new InvitationError(415, "INVALID_INPUT");
  const reader = request.body?.getReader();
  if (!reader) throw new InvitationError(400, "INVALID_INPUT");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        throw new InvitationError(413, "PAYLOAD_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new InvitationError(400, "INVALID_INPUT");
  }
}
export function invitationParse<S extends z.ZodTypeAny>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw new InvitationError(400, "INVALID_INPUT");
  return result.data;
}
