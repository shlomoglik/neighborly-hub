"use client";
import { useState } from "react";
import { usePrivateResource } from "@/features/shared/use-private-resource";
import { householdApi } from "./household-api";

export function useHouseholdWorkspace(id: string) {
  const [page, setPage] = useState(1);
  // Pagination refreshes the content while retaining this household's navigation metadata.
  const resource = usePrivateResource(id, (signal) => householdApi.detail(id, page, signal), {
    keepDataOnRefresh: true,
  });
  return {
    resource,
    onPage: (next: number) => {
      setPage(next);
      resource.refresh();
    },
  };
}
