import { z } from "zod";
import { revokeFamilyInvitation } from "@/lib/access/family-invitations";
import { householdRoute } from "@/lib/access/household-http";
import { managementResponse as respond } from "@/lib/access/management-response";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; invitationId: string }> },
) {
  const { id, invitationId } = await context.params;
  return householdRoute(request, id, true, async (userId) => {
    if (!z.string().uuid().safeParse(invitationId).success)
      return respond({ error: "NOT_FOUND" }, 404);
    const { db } = await import("@/lib/db/client");
    return respond(await revokeFamilyInvitation(db, userId, id, invitationId));
  });
}
