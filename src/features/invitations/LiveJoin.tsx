"use client";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { invitationApi } from "./invitation-api";
import { useInvitationResource } from "./use-invitation-resource";
import { useInvitationAction } from "./use-invitation-action";
import { JoinInvitation } from "./JoinInvitation";
import { RequestList } from "./RequestList";
import { InvitationFeedback } from "./InvitationFeedback";
import { Button } from "@/components/ui/button";
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
        <h1 className="text-2xl font-bold">{t("inviteMyRequests")}</h1>
        <Button
          variant="outline"
          disabled={resource.status === "loading"}
          onClick={resource.refresh}
        >
          {t("refreshManagement")}
        </Button>
        <p>{t("inviteNeedLink")}</p>
        <InvitationFeedback status={resource.status} onRetry={resource.refresh} />
        {resource.status === "ready" && resource.data && (
          <RequestList data={resource.data} busy={false} onPage={setPage} />
        )}
      </div>
    </AppShell>
  );
}
