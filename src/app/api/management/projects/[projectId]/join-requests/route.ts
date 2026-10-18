import { listJoinRequests } from "@/lib/access/invitations";
import { managementPageSchema } from "@/lib/access/management-contracts";
import {
  invitationRoute,
  invitationResponse as respond,
  invitationParse,
  invitationUuid,
} from "@/lib/access/invitation-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = (request: Request, context: { params: Promise<{ projectId: string }> }) =>
  invitationRoute(request, false, async (userId) => {
    const projectId = invitationUuid((await context.params).projectId);
    const page = invitationParse(
      managementPageSchema,
      new URL(request.url).searchParams.get("page") ?? undefined,
    );
    const { db } = await import("@/lib/db/client");
    return respond(await listJoinRequests(db, userId, projectId, page));
  });
