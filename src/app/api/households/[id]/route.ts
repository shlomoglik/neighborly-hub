import { z } from "zod";
import { readHousehold, updateHousehold } from "@/lib/access/households";
import { householdMutation } from "@/lib/access/household-contracts";
import { householdRoute, readHouseholdBody } from "@/lib/access/household-http";
import { managementResponse as respond } from "@/lib/access/management-response";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  return householdRoute(request, id, false, async (userId) => {
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(10000)
      .safeParse(new URL(request.url).searchParams.get("page") ?? 1);
    if (!page.success) return respond({ error: "INVALID_INPUT" }, 400);
    const { db } = await import("@/lib/db/client");
    const data = await readHousehold(db, userId, id, page.data);
    return data ? respond(data) : respond({ error: "NOT_FOUND" }, 404);
  });
}
export async function PATCH(request: Request, context: Context) {
  const { id } = await context.params;
  return householdRoute(request, id, true, async (userId) => {
    const input = householdMutation.safeParse(await readHouseholdBody(request));
    if (!input.success) return respond({ error: "INVALID_INPUT" }, 400);
    const { db } = await import("@/lib/db/client");
    return respond(await updateHousehold(db, userId, id, input.data));
  });
}
