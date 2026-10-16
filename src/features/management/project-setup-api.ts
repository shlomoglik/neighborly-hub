import {
  projectSetupInput,
  projectSetupResult,
  type ProjectSetupInput,
} from "@/lib/db/project-setup-input";

export class ProjectSetupRequestError extends Error {
  constructor(public status: number) {
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
  if (!response.ok) throw new ProjectSetupRequestError(response.status);
  return projectSetupResult.parse(await response.json());
}
