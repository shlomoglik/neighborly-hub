import { getCurrentUser } from "@/lib/auth/session";
import { readManagementProjects } from "@/lib/access/management";
import { managementPageSchema } from "@/lib/access/management-contracts";
import { managementResponse as respond } from "@/lib/access/management-response";
import { logManagementReadError } from "@/lib/access/management-read-error";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request.headers);
    if (!user) return respond({ error: "UNAUTHENTICATED" }, 401);
    const page = managementPageSchema.safeParse(
      new URL(request.url).searchParams.get("page") ?? undefined,
    );
    if (!page.success) return respond({ error: "INVALID_QUERY" }, 400);
    const { db } = await import("@/lib/db/client");
    return respond(await readManagementProjects(db, user.id, page.data));
  } catch (cause) {
    logManagementReadError("projects", cause);
    return respond({ error: "INTERNAL_ERROR" }, 500);
  }
}
