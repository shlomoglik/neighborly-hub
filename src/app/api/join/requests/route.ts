import { listJoinRequests } from "@/lib/access/invitations";
import { managementPageSchema } from "@/lib/access/management-contracts";
import {
  invitationRoute,
  invitationResponse as respond,
  invitationParse,
} from "@/lib/access/invitation-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = (request: Request) =>
  invitationRoute(request, false, async (userId) => {
    const page = invitationParse(
      managementPageSchema,
      new URL(request.url).searchParams.get("page") ?? undefined,
    );
    const { db } = await import("@/lib/db/client");
    return respond(await listJoinRequests(db, userId, null, page));
  });
