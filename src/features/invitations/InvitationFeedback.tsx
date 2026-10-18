"use client";
import { useI18n, type TKey } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { SystemFeedback } from "@/components/community/SystemFeedback";
import { CommunitySkeleton } from "@/components/community/CommunityLoading";
import type { ResourceStatus } from "./use-invitation-resource";
export const invitationErrorKey = (code: string): TKey =>
  (
    ({
      APARTMENT_OCCUPIED: "inviteOccupied",
      IDENTITY_UNAVAILABLE: "inviteIdentityUnavailable",
      REQUEST_REVIEWED: "inviteReviewed",
      INVITATION_INACTIVE: "inviteInactive",
      SELF_REVIEW: "inviteSelfReview",
      INVALID_INPUT: "inviteInvalid",
    }) as Record<string, TKey>
  )[code] ?? "inviteUncertain";
export function InvitationFeedback({
  status,
  onRetry,
  signInHref = "/auth",
}: {
  signInHref?: string;
  status: ResourceStatus;
  onRetry: () => void;
}) {
  const { t } = useI18n();
  if (status === "loading") return <CommunitySkeleton variant="form" />;
  if (status === "error") return <SystemFeedback kind="error" onRetry={onRetry} />;
  if (status === "expired")
    return (
      <div className="space-y-3">
        <SystemFeedback kind="private" message={t("managementExpired")} />
        <Button asChild>
          <a href={signInHref}>{t("signIn")}</a>
        </Button>
      </div>
    );
  if (status === "unavailable")
    return <SystemFeedback kind="private" message={t("inviteUnavailable")} onRetry={onRetry} />;
  return null;
}
export function InvitationPagination({
  page,
  hasNext,
  busy,
  onPage,
}: {
  page: number;
  hasNext: boolean;
  busy?: boolean;
  onPage: (page: number) => void;
}) {
  const { t } = useI18n();
  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-2"
      aria-label={t("invitePages")}
    >
      <Button variant="outline" disabled={busy || page <= 1} onClick={() => onPage(page - 1)}>
        {t("directoryPrevious")}
      </Button>
      <span>{t("directoryPage", { n: page })}</span>
      <Button variant="outline" disabled={busy || !hasNext} onClick={() => onPage(page + 1)}>
        {t("directoryNext")}
      </Button>
    </nav>
  );
}
