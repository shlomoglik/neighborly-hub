import { readAuthConfig } from "@/lib/auth/config";
import { renewInvitation, revokeInvitation } from "@/lib/access/invitations";
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

export const POST = (
  request: Request,
  context: { params: Promise<{ projectId: string; invitationId: string }> },
) =>
  invitationRoute(request, true, async (userId) => {
    const p = await context.params;
    const { db } = await import("@/lib/db/client");
    const result = await renewInvitation(
      db,
      userId,
      invitationUuid(p.projectId),
      invitationUuid(p.invitationId),
    );
    return respond({
      id: result.id,
      url: `${readAuthConfig(process.env)!.baseURL}/join/${result.token}`,
    });
  });
