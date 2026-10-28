import { staffRoute, readStaffBody } from "@/lib/access/staff-http";
import { inspectStaffRecipient, StaffError } from "@/lib/access/staff";
import { staffInput } from "@/lib/access/staff-contracts";
import { managementResponse } from "@/lib/access/management-response";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const POST = async (
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) => {
  const { projectId } = await context.params;
  return staffRoute(request, projectId, true, async (actorId) => {
    const input = staffInput.safeParse(await readStaffBody(request));
    if (!input.success) throw new StaffError(400, "INVALID_INPUT");
    const { db } = await import("@/lib/db/client");
    return managementResponse(await inspectStaffRecipient(db, actorId, projectId, input.data));
  });
};
