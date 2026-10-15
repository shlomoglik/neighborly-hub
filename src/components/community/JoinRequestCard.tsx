"use client";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "../ui/button";
import { StatusBadge } from "./StatusBadge";
export type JoinRequest = {
  id: string;
  familyName: string;
  building: string;
  apartment: string;
  conflictWith?: string;
};
export function JoinRequestCard({
  request,
  busy = false,
  onApprove,
  onReject,
}: {
  request: JoinRequest;
  busy?: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const { t } = useI18n();
  return (
    <article
      aria-busy={busy}
      className="community-enter community-interactive space-y-3 rounded-2xl border bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">
            <bdi>{request.familyName}</bdi>
          </h3>
          <p className="text-sm text-muted-foreground">
            {t("building")} <bdi dir="ltr">{request.building}</bdi> · {t("apartment")}{" "}
            <bdi dir="ltr">{request.apartment}</bdi>
          </p>
        </div>
        <StatusBadge status="pending" />
      </div>
      {request.conflictWith && (
        <p role="alert" className="rounded-lg bg-warning/15 p-3 text-sm">
          {t("conflictWarning", { name: request.conflictWith })}
        </p>
      )}
      <div className="flex gap-2">
        <Button loading={busy} onClick={() => onApprove(request.id)}>
          {busy ? t("loading") : t("approve")}
        </Button>
        <Button disabled={busy} variant="outline" onClick={() => onReject(request.id)}>
          {t("reject")}
        </Button>
      </div>
    </article>
  );
}
