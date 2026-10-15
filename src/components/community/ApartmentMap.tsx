"use client";
import { useI18n } from "@/lib/i18n/context";
export type ApartmentState = "occupied" | "pending" | "vacant" | "absent-owner";
export type ApartmentTileModel = {
  id: string;
  number: string;
  floor: number;
  label?: string;
  status: ApartmentState;
};

export function ApartmentMap({
  apartments,
  selectedId,
  onSelect,
}: {
  apartments: readonly ApartmentTileModel[];
  selectedId?: string;
  onSelect?: (id: string) => void;
}) {
  const { t } = useI18n();
  const statusText = {
    occupied: t("occupied"),
    pending: t("pending"),
    vacant: t("vacant"),
    "absent-owner": t("owner_non_resident"),
  };
  const floors = [...new Set(apartments.map((a) => a.floor))].sort((a, b) => b - a);
  return (
    <div className="community-enter community-interactive space-y-4">
      {floors.map((floor) => (
        <section
          key={floor}
          aria-label={`${t("floor")} ${floor}`}
          className="grid grid-cols-[5rem_1fr] items-start gap-3"
        >
          <h3 className="pt-3 text-sm text-muted-foreground">
            {t("floor")} {floor}
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {apartments
              .filter((a) => a.floor === floor)
              .map((a) => (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={selectedId === a.id}
                  onClick={() => onSelect?.(a.id)}
                  className={`community-interactive min-h-20 rounded-xl border p-2 text-start focus-visible:outline-2 focus-visible:outline-primary ${selectedId === a.id ? "border-primary bg-primary/10" : a.status === "pending" ? "border-warning bg-warning/10" : a.status === "vacant" ? "border-dashed border-border bg-card" : a.status === "absent-owner" ? "border-double border-4 border-border bg-card" : "border-border bg-card"}`}
                >
                  <span className="block font-semibold tabular-nums">
                    <bdi dir="ltr">{a.number}</bdi>
                  </span>
                  <span className="block break-words text-xs">
                    <bdi>{a.label || statusText[a.status]}</bdi>
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {statusText[a.status]}
                  </span>
                </button>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
