import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { createStructure, deleteStructure, updateStructure } from "@/lib/db/structure-input";
import { logger } from "@/lib/logging";

// Node.js is required for the PostgreSQL driver.
export const runtime = "nodejs";

// Always process requests dynamically, without route caching.
export const dynamic = "force-dynamic";

function disabled() {
  return process.env.NODE_ENV !== "development";
}

function errorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Invalid request", issues: error.issues }, { status: 400 });
  }
  logger.error("dev.structure.failed", error);
  return NextResponse.json({ error: "Structure operation failed" }, { status: 409 });
}

export async function POST(request: NextRequest) {
  if (disabled()) return new Response(null, { status: 404 });
  try {
    const input = createStructure.parse(await request.json());
    const { createStructureRecord } = await import("@/lib/db/structure-crud");
    return NextResponse.json(await createStructureRecord(input), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  if (disabled()) return new Response(null, { status: 404 });
  try {
    const input = updateStructure.parse(await request.json());
    const { updateStructureRecord } = await import("@/lib/db/structure-crud");
    const record = await updateStructureRecord(input);
    return record ? NextResponse.json(record) : new Response(null, { status: 404 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  if (disabled()) return new Response(null, { status: 404 });
  try {
    const input = deleteStructure.parse(await request.json());
    const { deleteStructureRecord } = await import("@/lib/db/structure-crud");
    const record = await deleteStructureRecord(input);
    return record ? NextResponse.json(record) : new Response(null, { status: 404 });
  } catch (error) {
    return errorResponse(error);
  }
}
