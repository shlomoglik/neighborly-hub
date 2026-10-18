import { privateRequest } from "@/features/shared/private-api";
import type {
  HouseholdDetail,
  HouseholdList,
  HouseholdMutation,
} from "@/lib/access/household-contracts";
export const householdApi = {
  mine: (page: number, signal: AbortSignal) =>
    privateRequest<HouseholdList>(`/api/households?page=${page}`, signal),
  detail: (id: string, page: number, signal: AbortSignal) =>
    privateRequest<HouseholdDetail>(
      `/api/households/${encodeURIComponent(id)}?page=${page}`,
      signal,
    ),
  update: (id: string, input: HouseholdMutation, signal: AbortSignal) =>
    privateRequest<{ id: string }>(
      `/api/households/${encodeURIComponent(id)}`,
      signal,
      "PATCH",
      input,
    ),
};
