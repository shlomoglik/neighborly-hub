import { managementPageSchema } from "@/lib/access/management-contracts";
import { readFamily, mutateFamily } from "@/lib/access/family";
import { familyMutation } from "@/lib/access/family-contracts";
import { householdRoute, readHouseholdBody } from "@/lib/access/household-http";
import { managementResponse as respond } from "@/lib/access/management-response";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  return householdRoute(request, id, false, async (userId) => {
    const page = managementPageSchema.safeParse(
      new URL(request.url).searchParams.get("page") ?? undefined,
    );
    if (!page.success) return respond({ error: "INVALID_INPUT" }, 400);
    const { db } = await import("@/lib/db/client");
    return respond(await readFamily(db, userId, id, page.data));
  });
}
export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  return householdRoute(request, id, true, async (userId) => {
    const input = familyMutation.safeParse(await readHouseholdBody(request));
    if (!input.success) return respond({ error: "INVALID_INPUT" }, 400);
    const { db } = await import("@/lib/db/client");
    return respond(await mutateFamily(db, userId, id, input.data));
  });
}
