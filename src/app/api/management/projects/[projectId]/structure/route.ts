import { buildingLayoutInput } from "@/lib/access/building-layout-contracts";
import { updateBuildingLayouts } from "@/lib/access/building-layout";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { readAuthConfig } from "@/lib/auth/config";
import {
  createManagementStructure,
  updateManagementStructure,
  StructureManagementError,
} from "@/lib/access/structure-management";
import {
  createManagedStructure,
  updateManagedStructure,
} from "@/lib/access/structure-management-contracts";
import { managementResponse as respond } from "@/lib/access/management-response";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ projectId: string }> };
async function body(request: Request) {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json"
  )
    throw new StructureManagementError(415, "INVALID_INPUT");
  const reader = request.body?.getReader();
  if (!reader) throw new StructureManagementError(400, "INVALID_INPUT");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > (request.method === "PUT" ? 128 * 1024 : 4096)) {
        await reader.cancel();
        throw new StructureManagementError(413, "PAYLOAD_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new StructureManagementError(400, "INVALID_INPUT");
  }
}
async function write(request: Request, context: Context, update: boolean) {
  try {
    const user = await getCurrentUser(request.headers);
    if (!user) return respond({ error: "UNAUTHENTICATED" }, 401);
    const origin = readAuthConfig(process.env)?.baseURL;
    if (!origin || request.headers.get("origin") !== origin)
      return respond({ error: "FORBIDDEN" }, 403);
    const projectId = z
      .string()
      .uuid()
      .safeParse((await context.params).projectId);
    if (!projectId.success) return respond({ error: "NOT_FOUND" }, 404);
    const value = await body(request);
    const { db } = await import("@/lib/db/client");
    if (request.method === "PUT") {
      const input = buildingLayoutInput.safeParse(value);
      if (!input.success) return respond({ error: "INVALID_INPUT" }, 400);
      return respond(await updateBuildingLayouts(db, user.id, projectId.data, input.data));
    }
    if (update) {
      const input = updateManagedStructure.safeParse(value);
      if (!input.success) return respond({ error: "INVALID_INPUT" }, 400);
      return respond(await updateManagementStructure(db, user.id, projectId.data, input.data));
    }
    const input = createManagedStructure.safeParse(value);
    if (!input.success) return respond({ error: "INVALID_INPUT" }, 400);
    return respond(await createManagementStructure(db, user.id, projectId.data, input.data), 201);
  } catch (error) {
    return error instanceof StructureManagementError
      ? respond({ error: error.code }, error.status)
      : respond({ error: "INTERNAL_ERROR" }, 500);
  }
}
export const POST = (request: Request, context: Context) => write(request, context, false);
export const PATCH = (request: Request, context: Context) => write(request, context, true);

export const PUT = (request: Request, context: Context) => write(request, context, true);
