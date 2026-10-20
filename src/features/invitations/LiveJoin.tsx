"use client";
import { RefreshButton } from "@/components/community/RefreshButton";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { invitationApi } from "./invitation-api";
import { useInvitationResource } from "./use-invitation-resource";
import { useInvitationAction } from "./use-invitation-action";
import { JoinInvitation } from "./JoinInvitation";
import { RequestList } from "./RequestList";
import { InvitationFeedback } from "./InvitationFeedback";
import { useI18n } from "@/lib/i18n";
export function LiveJoin({ token }: { token: string }) {
  const [page, setPage] = useState(1);
  const resource = useInvitationResource(JSON.stringify([token, page]), (signal) =>
    invitationApi.context(token, page, signal),
  );
  const action = useInvitationAction(token);
  return (
    <AppShell>
      <JoinInvitation
        signInHref={`/auth?next=${encodeURIComponent(`/join/${token}`)}`}
        status={resource.status}
        data={resource.data}
        busy={action.busy}
        error={action.error}
        onRefresh={() => {
          action.clear();
          resource.refresh();
        }}
        onPage={setPage}
        onSubmit={async (input) => {
          if (
            await action.run(
              (signal) => invitationApi.submit(token, input, signal),
              resource.invalidate,
            )
          )
            resource.refresh();
        }}
      />
    </AppShell>
  );
}
export function MyJoinRequests() {
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const resource = useInvitationResource(`my-requests:${page}`, (signal) =>
    invitationApi.mine(page, signal),
  );
  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{t("inviteMyRequests")}</h1>
          <div className="ms-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2">
            <RefreshButton
              disabled={resource.status === "loading"}
              onClick={resource.refresh}
              label={t("refreshManagement")}
            />
          </div>
        </div>
        <p>{t("inviteNeedLink")}</p>
        <InvitationFeedback status={resource.status} onRetry={resource.refresh} />
        {resource.status === "ready" && resource.data && (
          <RequestList data={resource.data} busy={false} onPage={setPage} />
        )}
      </div>
    </AppShell>
  );
}
