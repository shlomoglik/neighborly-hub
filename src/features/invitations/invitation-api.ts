import type { StaffInput, StaffRecipient } from "@/lib/access/staff-contracts";
import type {
  InvitationInput,
  InvitationPage,
  RequestPage,
  JoinContext,
  JoinInput,
} from "@/lib/access/invitation-contracts";
import { PrivateRequestError, privateRequest as read } from "@/features/shared/private-api";
export { PrivateRequestError as InvitationRequestError };
const project = (id: string) => `/api/management/projects/${encodeURIComponent(id)}`;
export const invitationApi = {
  inspectRecipient: (id: string, input: StaffInput, signal: AbortSignal) =>
    read<StaffRecipient>(`${project(id)}/staff/recipient`, signal, "POST", input),
  renew: (id: string, invitationId: string, signal: AbortSignal) =>
    read<{ id: string; url: string }>(
      `${project(id)}/invitations/${encodeURIComponent(invitationId)}`,
      signal,
      "POST",
    ),
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
