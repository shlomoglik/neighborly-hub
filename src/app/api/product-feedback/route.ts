import { getCurrentUser } from "@/lib/auth/session";
import { readAuthConfig } from "@/lib/auth/config";
import { managementResponse as respond } from "@/lib/access/management-response";
import { feedbackInput, feedbackQuery } from "@/lib/access/product-feedback-contracts";
import { FeedbackError, listFeedback, submitFeedback } from "@/lib/access/product-feedback";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function route(request: Request, write: boolean) {
  try {
    const user = await getCurrentUser(request.headers);
    if (!user) return respond({ error: "UNAUTHENTICATED" }, 401);
    if (write) {
      const origin = readAuthConfig(process.env)?.baseURL;
      if (!origin || request.headers.get("origin") !== origin)
        return respond({ error: "FORBIDDEN" }, 403);
      const input = feedbackInput.safeParse(await readBody(request));
      if (!input.success) return respond({ error: "INVALID_INPUT" }, 400);
      const { db } = await import("@/lib/db/client");
      return respond(await submitFeedback(db, user.id, input.data));
    }
    const params = new URL(request.url).searchParams;
    const query = feedbackQuery.safeParse(Object.fromEntries(params));
    if (!query.success || params.getAll("page").length > 1)
      return respond({ error: "INVALID_INPUT" }, 400);
    const { db } = await import("@/lib/db/client");
    return respond(await listFeedback(db, user.id, query.data.page));
  } catch (cause) {
    // Never log driver errors: they may contain SQL parameters and feedback text.
    return cause instanceof FeedbackError
      ? respond({ error: cause.code }, cause.status)
      : respond({ error: "INTERNAL_ERROR" }, 500);
  }
}
export const POST = (request: Request) => route(request, true);
export const GET = (request: Request) => route(request, false);
async function readBody(request: Request): Promise<unknown> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json"
  )
    throw new FeedbackError(415, "INVALID_INPUT");
  const reader = request.body?.getReader();
  if (!reader) throw new FeedbackError(400, "INVALID_INPUT");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) {
        await reader.cancel();
        throw new FeedbackError(413, "PAYLOAD_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
  } catch {
    throw new FeedbackError(400, "INVALID_INPUT");
  }
}
