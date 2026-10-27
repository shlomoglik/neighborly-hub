"use client";
import { useContext, useEffect, useState } from "react";
import { managementApi } from "@/features/management/management-api";
import { directoryApi } from "@/features/directory/directory-api";
import type { InvitationInput } from "@/lib/access/invitation-contracts";
import { invitationApi } from "./invitation-api";
import { useInvitationResource } from "./use-invitation-resource";
import { useInvitationAction } from "./use-invitation-action";
import { PendingInvitationCountContext } from "@/features/management/ProjectManagementContext";
import { InvitationWorkspace } from "./InvitationWorkspace";
export function LiveInvitations({ projectId }: { projectId: string }) {
  const [ipage, setIpage] = useState(1);
  const [rpage, setRpage] = useState(1);
  const [search, setSearch] = useState("");
  const [created, setCreated] = useState<{
    id: string;
    url: string;
    email: string;
    kind: InvitationInput["kind"];
    buildingId: string | null;
  } | null>(null);
  const resource = useInvitationResource(
    JSON.stringify([projectId, ipage, rpage]),
    async (signal) => {
      const [hierarchy, invitations, requests] = await Promise.all([
        managementApi.hierarchy(projectId, signal),
        invitationApi.invitations(projectId, ipage, signal),
        invitationApi.requests(projectId, rpage, signal),
      ]);
      return { hierarchy, invitations, requests };
    },
  );
  const onPendingCount = useContext(PendingInvitationCountContext);
  const pendingCount =
    resource.status === "ready" && resource.data
      ? resource.data.requests.requests.filter((request) => request.status === "pending").length
      : null;
  useEffect(() => {
    if (pendingCount !== null) onPendingCount?.(pendingCount);
  }, [pendingCount, onPendingCount]);
  const action = useInvitationAction(projectId);
  const contacts = useInvitationResource(
    JSON.stringify([projectId, created?.id, search]),
    async (signal) => {
      if (!created || !search.trim()) return [];
      const page = await directoryApi.residents(
        projectId,
        { query: search, buildingId: created.buildingId ?? "", page: 1 },
        signal,
      );
      return page.residents.flatMap((r) =>
        r.contacts.filter((c) => c.kind === "phone").map((c) => ({ name: r.name, phone: c.value })),
      );
    },
  );
  return (
    <div className="space-y-6">
      <InvitationWorkspace
        projectId={projectId}
        status={resource.status}
        data={resource.data}
        busy={action.busy}
        error={action.error}
        created={created}
        contacts={contacts.data ?? []}
        contactSearch={{
          value: search,
          onChange: setSearch,
          loading: contacts.status === "loading",
          error: ["error", "expired", "unavailable"].includes(contacts.status),
        }}
        onRefresh={() => {
          resource.refresh();
          action.clear();
        }}
        onInvitationPage={setIpage}
        onRequestPage={setRpage}
        onCreate={async (input) => {
          const result = await action.run(
            (signal) => invitationApi.create(projectId, input, signal),
            (code) => {
              setCreated(null);
              resource.invalidate(code);
            },
          );
          if (!result) return false;
          setCreated({
            ...result.value,
            email: input.recipientEmail ?? "",
            kind: input.kind,
            buildingId: input.kind === "project_manager" ? null : input.buildingId,
          });
          resource.refresh();
          return true;
        }}
        onRevoke={async (id) => {
          if (
            await action.run(
              (signal) => invitationApi.revoke(projectId, id, signal),
              (code) => {
                setCreated(null);
                resource.invalidate(code);
              },
            )
          ) {
            if (created?.id === id) setCreated(null);
            resource.refresh();
          }
        }}
        onReview={async (id, decision) => {
          const result = await action.run(
            (signal) => invitationApi.review(projectId, id, decision, signal),
            (code) => {
              setCreated(null);
              resource.invalidate(code);
            },
          );
          if (result) resource.refresh();
          return !!result;
        }}
      />
    </div>
  );
}
