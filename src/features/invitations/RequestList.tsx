"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import type { RequestItem, RequestPage } from "@/lib/access/invitation-contracts";
import { managementHref } from "@/lib/access/management-contracts";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { SystemFeedback } from "@/components/community/SystemFeedback";
import { JoinRequestGuidance } from "./JoinRequestGuidance";
import { InvitationPagination } from "./InvitationFeedback";
export function RequestList({
  data,
  busy,
  onPage,
  onReview,
}: {
  data: RequestPage;
  busy: boolean;
  onPage: (n: number) => void;
  onReview?: (id: string, decision: "approve" | "reject") => Promise<boolean>;
}) {
  const { t, dir } = useI18n();
  const trigger = useRef<HTMLButtonElement | null>(null);
  const [confirm, setConfirm] = useState<{
    row: RequestItem;
    decision: "approve" | "reject";
  } | null>(null);
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">{t(onReview ? "inviteRequests" : "inviteMyRequests")}</h2>
      {!data.requests.length && <SystemFeedback kind="empty" message={t("inviteNoRequests")} />}
      <ul className="space-y-3">
        {data.requests.map((row) => (
          <li key={row.id} className="space-y-2 break-words rounded-2xl border bg-card p-4">
            <h3 className="font-bold">
              <bdi>{row.projectName}</bdi> ·{" "}
              {t(row.kind === "resident" ? "inviteResident" : row.kind)}
            </h3>
            <p>
              <bdi>{row.buildingName}</bdi>{" "}
              {row.apartmentNumber && (
                <>
                  · {t("apartment")} <bdi>{row.apartmentNumber}</bdi>
                </>
              )}
            </p>
            <p>
              <bdi>{row.fullName ?? row.accountName}</bdi> · <bdi>{row.householdName}</bdi>
            </p>
            <p>
              <bdi dir="ltr">{row.accountEmail}</bdi>
            </p>
            <p role="status">
              {t(
                row.status === "pending"
                  ? "invitePending"
                  : row.status === "approved"
                    ? "inviteApproved"
                    : "inviteRejected",
              )}
            </p>
            {onReview ? (
              row.status === "pending" && !row.invitationActive && <p>{t("inviteInactive")}</p>
            ) : (
              <JoinRequestGuidance
                status={row.status}
                kind={row.kind}
                active={row.invitationActive}
              />
            )}
            {onReview && row.canReview && row.status === "pending" && (
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy || !row.invitationActive}
                  onClick={(event) => {
                    trigger.current = event.currentTarget;
                    setConfirm({ row, decision: "approve" });
                  }}
                >
                  {t("inviteApprove")}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={(event) => {
                    trigger.current = event.currentTarget;
                    setConfirm({ row, decision: "reject" });
                  }}
                >
                  {t("inviteReject")}
                </Button>
              </div>
            )}
            {!onReview &&
              row.status === "approved" &&
              row.kind !== "resident" &&
              row.kind !== "household_member" && (
                <Link className="text-primary underline" href={managementHref(row.projectId)}>
                  {t("openProjectManagement")}
                </Link>
              )}
          </li>
        ))}
      </ul>
      <InvitationPagination page={data.page} hasNext={data.hasNext} busy={busy} onPage={onPage} />
      <AlertDialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirm(null);
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
          dir={dir}
          className="max-h-[90dvh] overflow-y-auto"
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(confirm?.decision === "approve" ? "inviteApprove" : "inviteReject")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("inviteReviewConfirm", {
                name: confirm?.row.fullName ?? confirm?.row.accountName ?? "",
                scope: [
                  confirm?.row.projectName,
                  confirm?.row.buildingName,
                  confirm?.row.apartmentNumber,
                ]
                  .filter(Boolean)
                  .join(" · "),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={async (event) => {
                event.preventDefault();
                if (confirm && onReview) {
                  await onReview(confirm.row.id, confirm.decision);
                  setConfirm(null);
                }
              }}
            >
              {t("confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
