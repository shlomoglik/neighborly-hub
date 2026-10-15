"use client";
import { useId } from "react";
import { useI18n } from "@/lib/i18n/context";
export function BuildingSelector({
  buildings,
  value,
  onChange,
  includeAll = true,
}: {
  buildings: readonly { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
  includeAll?: boolean;
}) {
  const { t } = useI18n();
  const name = useId();
  return (
    <fieldset className="community-enter community-interactive">
      <legend className="sr-only">{t("filterBuilding")}</legend>
      <div className="flex flex-wrap gap-2">
        {[...(includeAll ? [{ id: "", name: t("allBuildings") }] : []), ...buildings].map((b) => (
          <label key={b.id} className="min-w-0 flex-1 cursor-pointer">
            <input
              className="peer sr-only"
              type="radio"
              name={name}
              value={b.id}
              checked={value === b.id}
              onChange={() => onChange(b.id)}
            />
            <span className="flex min-h-11 items-center justify-center rounded-xl border px-3 py-2 text-center text-sm transition-colors duration-150 peer-checked:border-primary peer-checked:bg-primary/10 peer-focus-visible:outline-2 peer-focus-visible:outline-primary">
              <bdi>{b.name}</bdi>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
