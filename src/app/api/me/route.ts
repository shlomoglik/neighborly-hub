import { getCurrentUser } from "@/lib/auth/session";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const user = await getCurrentUser(request.headers);
  return user
    ? Response.json({ user }, { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } })
    : Response.json(
        { error: "UNAUTHENTICATED" },
        { status: 401, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } },
      );
}
