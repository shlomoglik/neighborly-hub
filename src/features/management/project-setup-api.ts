import {
  projectSetupInput,
  projectSetupResult,
  type ProjectSetupInput,
} from "@/lib/db/project-setup-input";
import { z } from "zod";
import { publicErrorReasons, type PublicErrorReason } from "@/lib/error-diagnostics";

const setupFailure = z.object({
  error: z.literal("SETUP_FAILED"),
  reason: z.enum(publicErrorReasons),
});

export class ProjectSetupRequestError extends Error {
  constructor(
    public status: number,
    public reason?: PublicErrorReason,
  ) {
    super("Project setup request failed");
  }
}
export async function createProject(input: ProjectSetupInput) {
  const response = await fetch("/api/projects/setup", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(projectSetupInput.parse(input)),
  });
  if (!response.ok) {
    const failure =
      response.status === 500
        ? setupFailure.safeParse(await response.json().catch(() => null))
        : null;
    throw new ProjectSetupRequestError(
      response.status,
      failure?.success ? failure.data.reason : undefined,
    );
  }
  return projectSetupResult.parse(await response.json());
}
