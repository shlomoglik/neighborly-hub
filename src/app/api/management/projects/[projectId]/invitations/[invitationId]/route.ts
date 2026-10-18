import { revokeInvitation } from "@/lib/access/invitations";
import {
  invitationRoute,
  invitationResponse as respond,
  invitationUuid,
} from "@/lib/access/invitation-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const DELETE = (
  request: Request,
  context: { params: Promise<{ projectId: string; invitationId: string }> },
) =>
  invitationRoute(request, true, async (userId) => {
    const params = await context.params;
    const { db } = await import("@/lib/db/client");
    return respond(
      await revokeInvitation(
        db,
        userId,
        invitationUuid(params.projectId),
        invitationUuid(params.invitationId),
      ),
    );
  });
