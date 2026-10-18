import { readAuthConfig } from "@/lib/auth/config";
import { managementPageSchema } from "@/lib/access/management-contracts";
import { createFamilyInvitation, listFamilyInvitations } from "@/lib/access/family-invitations";
import { householdInvitationInput } from "@/lib/access/invitation-contracts";
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
    return respond(await listFamilyInvitations(db, userId, id, page.data));
  });
}
export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  return householdRoute(request, id, true, async (userId) => {
    const input = householdInvitationInput.safeParse(await readHouseholdBody(request));
    if (!input.success) return respond({ error: "INVALID_INPUT" }, 400);
    const { db } = await import("@/lib/db/client");
    const result = await createFamilyInvitation(db, userId, id, input.data);
    return respond(
      { id: result.id, url: `${readAuthConfig(process.env)!.baseURL}/join/${result.token}` },
      201,
    );
  });
}
