import { staffInput, type StaffInput, type StaffPage } from "@/lib/access/staff-contracts";
export class StaffRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
const path = (id: string) => `/api/management/projects/${encodeURIComponent(id)}/staff`;
async function request<T>(url: string, signal: AbortSignal, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal,
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(init.method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!response.ok) {
    let code = "INTERNAL_ERROR";
    try {
      const body = await response.json();
      if (typeof body.error === "string") code = body.error;
    } catch {
      /* Non-JSON failures remain generic. */
    }
    throw new StaffRequestError(response.status, code);
  }
  return response.json() as Promise<T>;
}
export const staffApi = {
  list: (projectId: string, page: number, signal: AbortSignal) =>
    request<StaffPage>(`${path(projectId)}?page=${page}`, signal),
  add: (projectId: string, input: StaffInput, signal: AbortSignal) =>
    request<{ assignmentId: string }>(path(projectId), signal, {
      method: "POST",
      body: JSON.stringify(staffInput.parse(input)),
    }),
  remove: (projectId: string, assignmentId: string, signal: AbortSignal) =>
    request<{ removed: boolean }>(
      `${path(projectId)}/${encodeURIComponent(assignmentId)}`,
      signal,
      { method: "DELETE" },
    ),
};
export type StaffApi = typeof staffApi;
