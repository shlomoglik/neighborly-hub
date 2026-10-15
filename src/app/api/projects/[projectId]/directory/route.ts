import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { readDirectory } from "@/lib/access/directory";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function GET(request: Request, context: { params: Promise<{ projectId: string }> }) {
  const user = await getCurrentUser(request.headers);
  if (!user) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401, headers });
  const parsed = z
    .string()
    .uuid()
    .safeParse((await context.params).projectId);
  if (!parsed.success) return Response.json({ error: "NOT_FOUND" }, { status: 404, headers });
  const { db } = await import("@/lib/db/client");
  const result = await readDirectory(db, user.id, parsed.data);
  return result
    ? Response.json(result, { headers })
    : Response.json({ error: "NOT_FOUND" }, { status: 404, headers });
}
