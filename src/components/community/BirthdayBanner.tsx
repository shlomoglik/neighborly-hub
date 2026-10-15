"use client";
import { Cake } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "../ui/button";
export function BirthdayBanner({
  count,
  children,
  onOpen,
}: {
  count: number;
  children?: React.ReactNode;
  onOpen: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="community-enter community-interactive flex flex-wrap items-center gap-3 rounded-xl bg-warning/15 p-4">
      <Cake aria-hidden="true" className="size-5" />
      <p className="min-w-0 flex-1">
        <span className="font-semibold">
          {t("birthdaysShort")} · {count}
        </span>
        {children && <span className="block text-sm">{children}</span>}
      </p>
      <Button variant="ghost" onClick={onOpen}>
        {t("viewDetails")}
      </Button>
    </div>
  );
}
