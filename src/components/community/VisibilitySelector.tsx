"use client";
import { useId } from "react";
import { LockKeyhole, Building2, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
export type Visibility = "admins" | "building" | "complex";
export const visibilityOptions = [
  { value: "admins", label: "vis_managers", Icon: LockKeyhole },
  { value: "building", label: "vis_building", Icon: Building2 },
  { value: "complex", label: "vis_project", Icon: Users },
] as const;
export function VisibilitySelector({
  value,
  onChange,
  allowComplex = true,
  disabled = false,
  label,
}: {
  value: Visibility;
  onChange: (value: Visibility) => void;
  allowComplex?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  const { t } = useI18n();
  const name = useId();
  return (
    <fieldset
      disabled={disabled}
      className="community-enter community-interactive min-w-0 space-y-2"
    >
      <legend className="mb-2 text-sm font-medium">{label ?? t("visibilityQuestion")}</legend>
      <div
        className={`community-interactive grid gap-2 ${allowComplex ? "grid-cols-3" : "grid-cols-2"}`}
      >
        {visibilityOptions
          .filter((o) => allowComplex || o.value !== "complex")
          .map(({ value: option, label: key, Icon }) => (
            <label key={option} className="min-w-0 cursor-pointer">
              <input
                className="peer sr-only"
                type="radio"
                name={name}
                checked={value === option}
                value={option}
                onChange={() => onChange(option)}
              />
              <span className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border bg-card px-2 py-3 text-center text-xs transition-colors duration-150 peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-primary peer-focus-visible:outline-2 peer-focus-visible:outline-primary peer-disabled:opacity-50">
                <Icon aria-hidden="true" className="size-5 shrink-0" />
                {t(key)}
              </span>
            </label>
          ))}
      </div>
      {!allowComplex && <p className="text-xs text-muted-foreground">{t("privacyPolicy")}</p>}
    </fieldset>
  );
}
