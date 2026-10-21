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
      className="community-enter min-w-0 w-full max-w-full disabled:opacity-60"
    >
      <legend className="sr-only">{t("filterBuilding")}</legend>
      <div className="flex max-w-full gap-1 overflow-x-auto overscroll-x-contain rounded-[14px] bg-secondary p-1">
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
            <span className="flex min-h-11 items-center justify-center whitespace-nowrap rounded-[10px] px-3 py-2 text-center text-sm text-muted-foreground transition-[background-color,color,box-shadow] duration-150 peer-checked:bg-card peer-checked:text-foreground peer-checked:shadow-sm peer-focus-visible:outline-2 peer-focus-visible:outline-primary">
              <bdi>{b.name}</bdi>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
