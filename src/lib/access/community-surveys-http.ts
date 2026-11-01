import "server-only";
import { getCurrentUser } from "@/lib/auth/session";
import { readAuthConfig } from "@/lib/auth/config";
import { managementResponse as respond } from "./management-response";
import { SurveyError, surveyAnswer, surveyId, surveyQuery } from "./community-surveys-contracts";
import { answerSurvey, readSurveys } from "./community-surveys-resident";
export type SurveyContext = { params: Promise<{ projectId: string; surveyId?: string }> };
export async function surveyRoute(request: Request, context: SurveyContext, write = false) {
  try {
    const user = await getCurrentUser(request.headers);
    if (!user) return respond({ error: "UNAUTHENTICATED" }, 401);
    const routeParams = await context.params;
    const projectId = routeParams.projectId.toLowerCase();
    const id = routeParams.surveyId?.toLowerCase();
    if (
      !surveyId.safeParse(projectId).success ||
      (id !== undefined && !surveyId.safeParse(id).success)
    )
      return respond({ error: "NOT_FOUND" }, 404);
    const params = new URL(request.url).searchParams;
    const query = surveyQuery.safeParse(Object.fromEntries(params));
    if (!query.success || params.getAll("page").length > 1 || ((id || write) && params.size))
      return respond({ error: "INVALID_INPUT" }, 400);
    if (write) {
      const origin = readAuthConfig(process.env)?.baseURL;
      if (!origin || request.headers.get("origin") !== origin)
        return respond({ error: "FORBIDDEN" }, 403);
      const input = surveyAnswer.safeParse(await readBody(request));
      if (!input.success || !id) return respond({ error: "INVALID_INPUT" }, 400);
      const { db } = await import("@/lib/db/client");
      return respond(await answerSurvey(db, user.id, projectId, id, input.data.optionId));
    }
    const { db } = await import("@/lib/db/client");
    return respond(await readSurveys(db, user.id, projectId, id, query.data.page));
  } catch (cause) {
    // Driver exceptions can contain account IDs and choices; never log them.
    return cause instanceof SurveyError
      ? respond({ error: cause.code }, cause.status)
      : respond({ error: "INTERNAL_ERROR" }, 500);
  }
}
async function readBody(request: Request): Promise<unknown> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json"
  )
    throw new SurveyError(415, "INVALID_INPUT");
  const reader = request.body?.getReader();
  if (!reader) throw new SurveyError(400, "INVALID_INPUT");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) {
        await reader.cancel();
        throw new SurveyError(413, "PAYLOAD_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
    const value: unknown = JSON.parse(text);
    // This one-string-field contract has exactly two JSON string tokens. Reject
    // duplicate keys, including escaped spellings that JSON.parse would overwrite.
    if (text.match(/"(?:[^"\\]|\\.)*"/g)?.length !== 2) throw new Error();
    return value;
  } catch {
    throw new SurveyError(400, "INVALID_INPUT");
  }
}
