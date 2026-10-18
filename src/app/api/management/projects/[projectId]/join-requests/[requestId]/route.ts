import { reviewJoinRequest } from "@/lib/access/invitations";
import { reviewInput } from "@/lib/access/invitation-contracts";
import {
  invitationRoute,
  invitationResponse as respond,
  invitationParse,
  invitationBody,
  invitationUuid,
} from "@/lib/access/invitation-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = (
  request: Request,
  context: { params: Promise<{ projectId: string; requestId: string }> },
) =>
  invitationRoute(request, true, async (userId) => {
    const params = await context.params;
    const input = invitationParse(reviewInput, await invitationBody(request));
    const { db } = await import("@/lib/db/client");
    return respond(
      await reviewJoinRequest(
        db,
        userId,
        invitationUuid(params.projectId),
        invitationUuid(params.requestId),
        input.decision,
      ),
    );
  });
