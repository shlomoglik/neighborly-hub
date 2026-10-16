import type { ManagementHierarchy, ManagementProjects } from "@/lib/access/management-contracts";
export class ManagementRequestError extends Error {
  constructor(public status: number) {
    super("Management request failed");
  }
}
async function read<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    signal,
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new ManagementRequestError(response.status);
  return response.json() as Promise<T>;
}
export const managementApi = {
  projects: (page: number, signal: AbortSignal) =>
    read<ManagementProjects>(`/api/management/projects?page=${page}`, signal),
  hierarchy: (projectId: string, signal: AbortSignal) =>
    read<ManagementHierarchy>(`/api/management/projects/${encodeURIComponent(projectId)}`, signal),
};
export type ManagementApi = typeof managementApi;
