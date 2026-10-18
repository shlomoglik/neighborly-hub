import { globalSearchQuerySchema } from "@/lib/access/search-contracts";
import { readGlobalSearch } from "@/lib/access/directory";
import { getCurrentUser } from "@/lib/auth/session";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function GET(request: Request) {
  const user = await getCurrentUser(request.headers);
  if (!user) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401, headers });
  const query = globalSearchQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success) return Response.json({ error: "INVALID_QUERY" }, { status: 400, headers });
  const { db } = await import("@/lib/db/client");
  return Response.json(await readGlobalSearch(db, user.id, query.data), { headers });
}
