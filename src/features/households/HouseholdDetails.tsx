"use client";
import { useContext } from "react";
import { AppShell } from "@/components/AppShell";
import { useHouseholdWorkspace } from "./use-household-workspace";
import { HouseholdNavigationContext } from "./HouseholdNavigationContext";
import { usePrivateAction } from "@/features/shared/use-private-action";
import { HouseholdWorkspace } from "./HouseholdWorkspace";
import { householdApi } from "./household-api";
export function HouseholdDetails({ id }: { id: string }) {
  const shared = useContext(HouseholdNavigationContext);
  return shared ? (
    <LiveHousehold id={id} workspace={shared} />
  ) : (
    <StandaloneHousehold key={id} id={id} />
  );
}
function StandaloneHousehold({ id }: { id: string }) {
  const workspace = useHouseholdWorkspace(id);
  return (
    <AppShell>
      <LiveHousehold id={id} workspace={workspace} />
    </AppShell>
  );
}
function LiveHousehold({
  id,
  workspace,
}: {
  id: string;
  workspace: ReturnType<typeof useHouseholdWorkspace>;
}) {
  const { resource, onPage } = workspace;
  const action = usePrivateAction(
    `${resource.key}:${resource.status === "expired" || resource.status === "unavailable" ? resource.status : ""}`,
  );
  return (
    <HouseholdWorkspace
      status={resource.status}
      data={resource.data}
      busy={action.busy}
      error={action.error}
      onPage={onPage}
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
