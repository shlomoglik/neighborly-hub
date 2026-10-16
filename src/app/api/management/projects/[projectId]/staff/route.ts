import { staffRoute, readStaffBody } from "@/lib/access/staff-http";
import { assignProjectStaff, readProjectStaff, StaffError } from "@/lib/access/staff";
import { staffInput } from "@/lib/access/staff-contracts";
import { managementPageSchema } from "@/lib/access/management-contracts";
import { managementResponse as respond } from "@/lib/access/management-response";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ projectId: string }> };
export async function GET(request: Request, context: Context) {
  const { projectId } = await context.params;
  return staffRoute(request, projectId, false, async (userId) => {
    const page = managementPageSchema.safeParse(
      new URL(request.url).searchParams.get("page") ?? undefined,
    );
    if (!page.success) throw new StaffError(400, "INVALID_QUERY");
    const { db } = await import("@/lib/db/client");
    return respond(await readProjectStaff(db, userId, projectId, page.data));
  });
}
export async function POST(request: Request, context: Context) {
  const { projectId } = await context.params;
  return staffRoute(request, projectId, true, async (userId) => {
    const input = staffInput.safeParse(await readStaffBody(request));
    if (!input.success) throw new StaffError(400, "INVALID_INPUT");
    const { db } = await import("@/lib/db/client");
    return respond(await assignProjectStaff(db, userId, projectId, input.data), 201);
  });
}
