"use client";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { usePrivateResource } from "@/features/shared/use-private-resource";
import { usePrivateAction } from "@/features/shared/use-private-action";
import { HouseholdWorkspace } from "./HouseholdWorkspace";
import { householdApi } from "./household-api";
export function HouseholdDetails({ id }: { id: string }) {
  return (
    <AppShell>
      <LiveHousehold key={id} id={id} />
    </AppShell>
  );
}
function LiveHousehold({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const resource = usePrivateResource(`${id}:${page}`, (signal) =>
    householdApi.detail(id, page, signal),
  );
  const action = usePrivateAction(
    `${resource.key}:${resource.status === "expired" || resource.status === "unavailable" ? resource.status : ""}`,
  );
  return (
    <HouseholdWorkspace
      status={resource.status}
      data={resource.data}
      busy={action.busy}
      error={action.error}
      onPage={setPage}
      onRefresh={resource.refresh}
      onSave={async (input) => {
        const result = await action.run(
          (signal) => householdApi.update(id, input, signal),
          resource.invalidate,
        );
        if (!result) return false;
        resource.refresh();
        return true;
      }}
    />
  );
}
