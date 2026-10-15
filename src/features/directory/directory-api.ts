import type { DirectoryPage, DirectoryProject, DirectoryQuery } from "@/lib/access/contracts";
export type DirectoryApi = {
  projects: (signal: AbortSignal) => Promise<DirectoryProject[]>;
  residents: (
    projectId: string,
    query: DirectoryQuery,
    signal: AbortSignal,
  ) => Promise<DirectoryPage>;
};
export class DirectoryRequestError extends Error {
  constructor(public status: number) {
    super("Directory request failed");
  }
}
async function read<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    signal,
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new DirectoryRequestError(response.status);
  return response.json() as Promise<T>;
}
export const directoryApi: DirectoryApi = {
  projects: async (signal) =>
    (await read<{ projects: DirectoryProject[] }>("/api/directory/projects", signal)).projects,
  residents: (projectId, query, signal) =>
    read(
      `/api/projects/${encodeURIComponent(projectId)}/directory?${new URLSearchParams({ query: query.query, buildingId: query.buildingId, page: String(query.page) })}`,
      signal,
    ),
};
