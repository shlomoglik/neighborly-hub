"use client";
import { useI18n } from "@/lib/i18n/context";
import { FamilyAvatar } from "../FamilyAvatar";
import { Badge } from "../ui/badge";
import { ContactAction } from "./ContactAction";
export type HouseholdSummary = {
  id: string;
  familyName: string;
  building: string;
  apartment: string;
  phone?: string;
  phoneVisible?: boolean;
  isMine?: boolean;
  birthdayLabel?: string;
};
export function HouseholdRow({
  household,
  selected = false,
  onSelect,
}: {
  household: HouseholdSummary;
  selected?: boolean;
  onSelect?: (id: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div
      className={`community-enter community-interactive flex flex-wrap min-h-20 items-center gap-3 rounded-xl border p-3 ${selected ? "border-primary bg-primary/5" : "bg-card"}`}
    >
      <FamilyAvatar name={household.familyName} size={48} />
      <button
        type="button"
        onClick={() => onSelect?.(household.id)}
        aria-pressed={selected}
        className="community-interactive min-w-0 flex-1 text-start"
      >
        <span className="block font-semibold">
          <bdi>{household.familyName}</bdi>
        </span>
        <span className="text-sm text-muted-foreground">
          {t("building")} <bdi dir="ltr">{household.building}</bdi> · {t("apartment")}{" "}
          <bdi dir="ltr">{household.apartment}</bdi>
        </span>
        <span className="mt-1 flex flex-wrap gap-1">
          {household.isMine && <Badge variant="secondary">{t("myHome")}</Badge>}
          {household.birthdayLabel && <Badge variant="outline">🎂 {household.birthdayLabel}</Badge>}
        </span>
      </button>
      <ContactAction
        kind="phone"
        value={household.phone}
        visible={household.phoneVisible ?? false}
      />
    </div>
  );
}
