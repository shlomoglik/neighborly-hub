"use client";
import { useId } from "react";
import { useI18n } from "@/lib/i18n/context";
type BuildingSelectorProps = {
  buildings: readonly { id: string; name: string }[];
  includeAll?: boolean;
  disabled?: boolean;
} & (
  | { multiple: true; value: string[]; onChange: (ids: string[]) => void }
  | { multiple?: false; value: string; onChange: (id: string) => void }
);

export function BuildingSelector(props: BuildingSelectorProps) {
  const { buildings, value, includeAll = true, disabled = false } = props;
  const { t } = useI18n();
  const name = useId();
  return (
    <fieldset
      disabled={disabled}
      className="community-enter community-interactive min-w-0 w-full max-w-full disabled:opacity-60"
    >
      <legend className="sr-only">{t("filterBuilding")}</legend>
      <div className="flex gap-2 overflow-x-auto overscroll-x-contain p-1">
        {[...(includeAll ? [{ id: "", name: t("allBuildings") }] : []), ...buildings].map((b) => (
          <label key={b.id} className="relative shrink-0 cursor-pointer">
            <input
              className="peer sr-only"
              type={props.multiple ? "checkbox" : "radio"}
              name={name}
              value={b.id}
              checked={
                props.multiple
                  ? b.id
                    ? props.value.includes(b.id)
                    : !props.value.length
                  : value === b.id
              }
              onChange={() => {
                if (props.multiple) {
                  props.onChange(
                    !b.id
                      ? []
                      : props.value.includes(b.id)
                        ? props.value.filter((id) => id !== b.id)
                        : [...props.value, b.id],
                  );
                } else props.onChange(b.id);
              }}
            />
            <span className="flex min-h-11 items-center justify-center rounded-xl border px-3 py-2 whitespace-nowrap text-center text-sm transition-colors duration-150 peer-checked:border-primary peer-checked:bg-primary/10 peer-focus-visible:outline-2 peer-focus-visible:outline-primary">
              <bdi>{b.name}</bdi>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
