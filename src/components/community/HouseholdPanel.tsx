"use client";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/context";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "../ui/sheet";
import { FamilyAvatar } from "../FamilyAvatar";
import { Button } from "../ui/button";
import { StatusBadge, type ResidentStatus } from "./StatusBadge";
import { MemberRow, type MemberView } from "./MemberRow";
export function HouseholdDetailsContent({
  name,
  building,
  apartment,
  members,
  onEdit,
  status,
  floor,
}: {
  name: string;
  building: string;
  apartment: string;
  members: readonly MemberView[];
  onEdit?: (id: string) => void;
  status?: ResidentStatus;
  floor?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="community-interactive space-y-4">
      <div className="flex items-center gap-3">
        <FamilyAvatar name={name} />
        <div className="min-w-0">
          <h2 className="break-words text-xl font-semibold">
            <bdi>{name}</bdi>
          </h2>
          <p>
            {t("building")} <bdi dir="ltr">{building}</bdi> · {t("apartment")}{" "}
            <bdi dir="ltr">{apartment}</bdi>
            {floor !== undefined && (
              <>
                {" "}
                · {t("floor")} <bdi dir="ltr">{floor}</bdi>
              </>
            )}
          </p>
          {status && <StatusBadge status={status} />}
        </div>
      </div>
      {members.map((member) => (
        <MemberRow key={member.id} member={member} onEdit={onEdit} />
      ))}
    </div>
  );
}
// Width is presentation state only; the caller owns selection and fetched data.
export function HouseholdPanel({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const { t, dir } = useI18n();
  const compact = useIsMobile(1024);
  if (!compact)
    return open ? (
      <aside
        aria-label={t("details")}
        className="w-[360px] shrink-0 space-y-4 rounded-2xl border bg-card p-4"
      >
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          {t("close")}
        </Button>
        {children}
      </aside>
    ) : null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={dir === "rtl" ? "left" : "right"}
        dir={dir}
        className="w-full overflow-y-auto sm:w-[360px]"
        closeLabel={t("close")}
      >
        <SheetTitle>{t("details")}</SheetTitle>
        <SheetDescription className="sr-only">{t("family")}</SheetDescription>
        <div className="mt-6">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
