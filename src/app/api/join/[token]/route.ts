import { invitationContext, submitJoin, InvitationError } from "@/lib/access/invitations";
import { joinInput, tokenSchema } from "@/lib/access/invitation-contracts";
import { managementPageSchema } from "@/lib/access/management-contracts";
import {
  invitationRoute,
  invitationResponse as respond,
  invitationParse,
  invitationBody,
} from "@/lib/access/invitation-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ token: string }> };
async function tokenFrom(context: Context) {
  const result = tokenSchema.safeParse((await context.params).token);
  if (!result.success) throw new InvitationError(404, "NOT_FOUND");
  return result.data;
}
export const GET = (request: Request, context: Context) =>
  invitationRoute(request, false, async (userId) => {
    const token = await tokenFrom(context);
    const page = invitationParse(
      managementPageSchema,
      new URL(request.url).searchParams.get("page") ?? undefined,
    );
    const { db } = await import("@/lib/db/client");
    return respond(await invitationContext(db, userId, token, page));
  });
export const POST = (request: Request, context: Context) =>
  invitationRoute(request, true, async (userId) => {
    const token = await tokenFrom(context);
    const input = invitationParse(joinInput, await invitationBody(request));
    const { db } = await import("@/lib/db/client");
    return respond(await submitJoin(db, userId, token, input), 201);
  });
