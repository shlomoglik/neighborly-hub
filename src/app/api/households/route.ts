import { z } from "zod";
import { listMyHouseholds } from "@/lib/access/households";
import { householdRoute } from "@/lib/access/household-http";
import { managementResponse as respond } from "@/lib/access/management-response";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return householdRoute(request, null, false, async (userId) => {
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(10000)
      .safeParse(new URL(request.url).searchParams.get("page") ?? 1);
    if (!page.success) return respond({ error: "INVALID_INPUT" }, 400);
    const { db } = await import("@/lib/db/client");
    return respond(await listMyHouseholds(db, userId, page.data));
  });
}
