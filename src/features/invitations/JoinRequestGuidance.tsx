"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import type { InvitationKind, RequestItem } from "@/lib/access/invitation-contracts";

/** Applicant guidance only; saved server status remains the authority for access. */
export function JoinRequestGuidance({
  status,
  kind,
  active,
}: {
  status: RequestItem["status"];
  kind: InvitationKind;
  active: boolean;
}) {
  const { t } = useI18n();
  const resident = kind === "resident" || kind === "household_member";
  if (status === "approved" && !resident) return null;
  return (
    <div className="space-y-3 text-sm">
      <p>
        {t(
          status === "pending"
            ? active
              ? "joinPendingNext"
              : "joinInactiveNext"
            : status === "rejected"
              ? "joinRejectedNext"
              : "joinApprovedNext",
        )}
      </p>
      {status === "approved" && resident && (
        <div className="flex flex-wrap gap-x-5 gap-y-3">
          <Link href="/directory" className="text-primary underline">
            {t("openBook")}
          </Link>
          <Link href="/household" className="text-primary underline">
            {t("homeMyContacts")}
          </Link>
        </div>
      )}
    </div>
  );
}
