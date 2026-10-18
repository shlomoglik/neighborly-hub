import { readAuthConfig } from "@/lib/auth/config";
import { createInvitation, listInvitations } from "@/lib/access/invitations";
import { invitationInput } from "@/lib/access/invitation-contracts";
import { managementPageSchema } from "@/lib/access/management-contracts";
import {
  invitationRoute,
  invitationResponse as respond,
  invitationBody,
  invitationParse,
  invitationUuid,
} from "@/lib/access/invitation-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ projectId: string }> };
export const GET = (request: Request, context: Context) =>
  invitationRoute(request, false, async (userId) => {
    const projectId = invitationUuid((await context.params).projectId);
    const page = invitationParse(
      managementPageSchema,
      new URL(request.url).searchParams.get("page") ?? undefined,
    );
    const { db } = await import("@/lib/db/client");
    return respond(await listInvitations(db, userId, projectId, page));
  });
export const POST = (request: Request, context: Context) =>
  invitationRoute(request, true, async (userId) => {
    const projectId = invitationUuid((await context.params).projectId);
    const input = invitationParse(invitationInput, await invitationBody(request));
    const { db } = await import("@/lib/db/client");
    const result = await createInvitation(db, userId, projectId, input);
    return respond(
      { id: result.id, url: `${readAuthConfig(process.env)!.baseURL}/join/${result.token}` },
      201,
    );
  });
