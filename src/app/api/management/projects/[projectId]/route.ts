import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { readManagementHierarchy } from "@/lib/access/management";
import { managementResponse as respond } from "@/lib/access/management-response";
import { logManagementReadError } from "@/lib/access/management-read-error";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const user = await getCurrentUser(request.headers);
    if (!user) return respond({ error: "UNAUTHENTICATED" }, 401);
    const id = z
      .string()
      .uuid()
      .safeParse((await context.params).projectId);
    if (!id.success) return respond({ error: "NOT_FOUND" }, 404);
    const { db } = await import("@/lib/db/client");
    const result = await readManagementHierarchy(db, user.id, id.data);
    return result ? respond(result) : respond({ error: "NOT_FOUND" }, 404);
  } catch (cause) {
    logManagementReadError("hierarchy", cause);
    return respond({ error: "INTERNAL_ERROR" }, 500);
  }
}
