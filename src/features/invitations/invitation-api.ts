import type {
  InvitationInput,
  InvitationPage,
  RequestPage,
  JoinContext,
  JoinInput,
} from "@/lib/access/invitation-contracts";
export class InvitationRequestError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
async function read<T>(
  url: string,
  signal: AbortSignal,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(url, {
    method,
    signal,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    let code = "INTERNAL_ERROR";
    try {
      const data = await response.json();
      if (typeof data.error === "string") code = data.error;
    } catch {
      /* Generic non-JSON failure. */
    }
    throw new InvitationRequestError(response.status, code);
  }
  return response.json() as Promise<T>;
}
const project = (id: string) => `/api/management/projects/${encodeURIComponent(id)}`;
export const invitationApi = {
  invitations: (id: string, page: number, signal: AbortSignal) =>
    read<InvitationPage>(`${project(id)}/invitations?page=${page}`, signal),
  requests: (id: string, page: number, signal: AbortSignal) =>
    read<RequestPage>(`${project(id)}/join-requests?page=${page}`, signal),
  create: (id: string, input: InvitationInput, signal: AbortSignal) =>
    read<{ id: string; url: string }>(`${project(id)}/invitations`, signal, "POST", input),
  revoke: (id: string, invitationId: string, signal: AbortSignal) =>
    read(`${project(id)}/invitations/${encodeURIComponent(invitationId)}`, signal, "DELETE"),
  review: (id: string, requestId: string, decision: "approve" | "reject", signal: AbortSignal) =>
    read(`${project(id)}/join-requests/${encodeURIComponent(requestId)}`, signal, "POST", {
      decision,
    }),
  context: (token: string, page: number, signal: AbortSignal) =>
    read<JoinContext>(`/api/join/${encodeURIComponent(token)}?page=${page}`, signal),
  submit: (token: string, input: JoinInput, signal: AbortSignal) =>
    read(`/api/join/${encodeURIComponent(token)}`, signal, "POST", input),
  mine: (page: number, signal: AbortSignal) =>
    read<RequestPage>(`/api/join/requests?page=${page}`, signal),
};
