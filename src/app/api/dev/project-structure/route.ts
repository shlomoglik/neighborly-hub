import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { projectStructureInput } from "@/lib/db/project-structure-input";

// Node.js is required for the PostgreSQL driver.
export const runtime = "nodejs";

// Always process requests dynamically, without route caching.
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return new Response(null, { status: 404 });
  }

  let input;
  try {
    input = projectStructureInput.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Invalid request", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const { createProjectStructure } = await import("@/lib/db/project-structure");
    const result = await createProjectStructure(input);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Project structure creation failed", error);
    return NextResponse.json({ error: "Project structure creation failed" }, { status: 409 });
  }
}
