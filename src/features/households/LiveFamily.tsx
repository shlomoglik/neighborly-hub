"use client";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { usePrivateResource } from "@/features/shared/use-private-resource";
import { usePrivateAction } from "@/features/shared/use-private-action";
import { familyApi } from "./family-api";
import { FamilyWorkspace } from "./FamilyWorkspace";
export function LiveFamily({ id }: { id: string }) {
  return (
    <AppShell>
      <FamilyController key={id} id={id} />
    </AppShell>
  );
}
function FamilyController({ id }: { id: string }) {
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
  const denied = resource.status === "expired" || resource.status === "unavailable";
  const action = usePrivateAction(`${id}:${denied ? resource.status : "active"}`);
  useEffect(() => {
    if (denied) setCreated(null);
  }, [denied]);
  const invalidate = (code: number) => {
    setCreated(null);
    resource.invalidate(code);
  };
  return (
    <FamilyWorkspace
      id={id}
      status={resource.status}
      data={resource.data}
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
