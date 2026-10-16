import { getCurrentUser } from "@/lib/auth/session";
import { readAuthConfig } from "@/lib/auth/config";
import { provisionProjectSetup } from "@/lib/access/project-setup";
import { projectSetupInput } from "@/lib/db/project-setup-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const json = (body: object, status: number) => Response.json(body, { status, headers });

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser(request.headers);
    if (!user) return json({ error: "UNAUTHENTICATED" }, 401);
    // Cookie-authenticated writes require an exact, configured origin, including in tests.
    const origin = readAuthConfig(process.env)?.baseURL;
    if (!origin || request.headers.get("origin") !== origin)
      return json({ error: "FORBIDDEN" }, 403);
    if (
      request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json"
    )
      return json({ error: "INVALID_INPUT" }, 415);
    // The bounded setup contract needs below 128 KiB, even with 100 long Unicode names.
    const body = await readBody(request);
    if (body === null) return json({ error: "PAYLOAD_TOO_LARGE" }, 413);
    let value: unknown;
    try {
      value = JSON.parse(body);
    } catch {
      return json({ error: "INVALID_INPUT" }, 400);
    }
    const parsed = projectSetupInput.safeParse(value);
    if (!parsed.success) return json({ error: "INVALID_INPUT" }, 400);
    const { db } = await import("@/lib/db/client");
    const result = await provisionProjectSetup(db, user.id, parsed.data);
    return result ? json(result, 201) : json({ error: "FORBIDDEN" }, 403);
  } catch {
    // Never serialize database details, session data or raw input into errors.
    return json({ error: "SETUP_FAILED" }, 500);
  }
}

async function readBody(request: Request): Promise<string | null> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 128 * 1024) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    reader.releaseLock();
  }
}
