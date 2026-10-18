import { privateRequest } from "@/features/shared/private-api";
import type { FamilyPage, FamilyMutation } from "@/lib/access/family-contracts";
import type { InvitationPage, HouseholdInvitationInput } from "@/lib/access/invitation-contracts";
const base = (id: string) => `/api/households/${encodeURIComponent(id)}`;
export const familyApi = {
  members: (id: string, page: number, signal: AbortSignal) =>
    privateRequest<FamilyPage>(`${base(id)}/members?page=${page}`, signal),
  mutate: (id: string, input: FamilyMutation, signal: AbortSignal) =>
    privateRequest<{ id: string }>(`${base(id)}/members`, signal, "PATCH", input),
  invitations: (id: string, page: number, signal: AbortSignal) =>
    privateRequest<InvitationPage>(`${base(id)}/invitations?page=${page}`, signal),
  invite: (id: string, input: HouseholdInvitationInput, signal: AbortSignal) =>
    privateRequest<{ id: string; url: string }>(`${base(id)}/invitations`, signal, "POST", input),
  revoke: (id: string, invitationId: string, signal: AbortSignal) =>
    privateRequest<{ id: string }>(
      `${base(id)}/invitations/${encodeURIComponent(invitationId)}`,
      signal,
      "DELETE",
    ),
};
