import { z } from "zod";
import { staffRoute } from "@/lib/access/staff-http";
import { revokeProjectStaff, StaffError } from "@/lib/access/staff";
import { managementResponse as respond } from "@/lib/access/management-response";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function DELETE(
  request: Request,
  context: { params: Promise<{ projectId: string; assignmentId: string }> },
) {
  const { projectId, assignmentId } = await context.params;
  return staffRoute(request, projectId, true, async (userId) => {
    if (!z.string().uuid().safeParse(assignmentId).success) throw new StaffError(404, "NOT_FOUND");
    const { db } = await import("@/lib/db/client");
    return respond(await revokeProjectStaff(db, userId, projectId, assignmentId));
  });
}
