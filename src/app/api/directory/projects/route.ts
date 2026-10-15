import { getCurrentUser } from "@/lib/auth/session";
import { readDirectoryProjects } from "@/lib/access/projects";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function GET(request: Request) {
  const user = await getCurrentUser(request.headers);
  if (!user) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401, headers });
  const { db } = await import("@/lib/db/client");
  const projects = await readDirectoryProjects(db, user.id);
  return Response.json({ projects }, { headers });
}
