"use client";
import { useContext, useEffect, useState } from "react";
import { HouseholdNavigationContext } from "./HouseholdNavigationContext";
import { AppShell } from "@/components/AppShell";
import { usePrivateResource } from "@/features/shared/use-private-resource";
import { usePrivateAction } from "@/features/shared/use-private-action";
import { familyApi } from "./family-api";
import { FamilyWorkspace } from "./FamilyWorkspace";
export function LiveFamily({ id }: { id: string }) {
  const shared = useContext(HouseholdNavigationContext);
  const content = <FamilyController key={id} id={id} />;
  return shared ? content : <AppShell>{content}</AppShell>;
}
function FamilyController({ id }: { id: string }) {
  const shared = useContext(HouseholdNavigationContext);
  const [page, setPage] = useState(1);
  const [invitationPage, setInvitationPage] = useState(1);
  const [created, setCreated] = useState<{ id: string; url: string; email: string } | null>(null);
  const resource = usePrivateResource(`${id}:${page}:${invitationPage}`, async (signal) => {
    const [family, invitations] = await Promise.all([
      familyApi.members(id, page, signal),
      familyApi.invitations(id, invitationPage, signal),
    ]);
    return { family, invitations };
  });
  const status =
    shared?.resource.status === "expired" || shared?.resource.status === "unavailable"
      ? shared.resource.status
      : resource.status;
  const denied = status === "expired" || status === "unavailable";
  const action = usePrivateAction(`${id}:${denied ? status : "active"}`);
  const invalidateNavigation = shared?.resource.invalidate;
  useEffect(() => {
    if (denied) {
      setCreated(null);
      invalidateNavigation?.(status === "expired" ? 401 : 403);
    }
  }, [denied, status, invalidateNavigation]);
  const invalidate = (code: number) => {
    setCreated(null);
    resource.invalidate(code);
  };
  return (
    <FamilyWorkspace
      id={id}
      status={status}
      data={denied ? null : resource.data}
      busy={action.busy}
      error={action.error}
      created={created}
      onRefresh={() => {
        resource.refresh();
        action.clear();
      }}
      onPage={setPage}
      onInvitationPage={setInvitationPage}
      onMutate={async (input) => {
        const result = await action.run(
          (signal) => familyApi.mutate(id, input, signal),
          invalidate,
        );
        if (result) resource.refresh();
        return !!result;
      }}
      onInvite={async (input) => {
        const result = await action.run(
          (signal) => familyApi.invite(id, input, signal),
          invalidate,
        );
        if (!result) return false;
        setCreated({ ...result.value, email: input.recipientEmail ?? "" });
        resource.refresh();
        return true;
      }}
      onRevoke={async (invitationId) => {
        const result = await action.run(
          (signal) => familyApi.revoke(id, invitationId, signal),
          invalidate,
        );
        if (result) {
          if (created?.id === invitationId) setCreated(null);
          resource.refresh();
        }
        return !!result;
      }}
    />
  );
}
