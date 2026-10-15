"use client";
import { useId } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { VisibilitySelector, type Visibility } from "./VisibilitySelector";
export type EditableContact = { value: string; visibility: Visibility };
export type MemberDraft = {
  name: string;
  child: boolean;
  relation?: string;
  birthDate?: string;
  phone: EditableContact;
  email: EditableContact;
  birthdayPublic: boolean;
};
export function emptyMember(child = false): MemberDraft {
  return {
    name: "",
    child,
    phone: { value: "", visibility: child ? "admins" : "building" },
    email: { value: "", visibility: child ? "admins" : "building" },
    birthdayPublic: false,
  };
}
export function ContactField({
  kind,
  value,
  onChange,
  allowComplex = true,
  error,
  disabled = false,
}: {
  kind: "phone" | "email";
  value: EditableContact;
  onChange: (v: EditableContact) => void;
  allowComplex?: boolean;
  error?: string;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const id = useId();
  return (
    <fieldset
      disabled={disabled}
      className="community-interactive min-w-0 space-y-3 rounded-xl border p-3"
    >
      <legend className="px-1 text-sm font-medium">{t(kind)}</legend>
      <Label htmlFor={id} className="sr-only">
        {t(kind)}
      </Label>
      <Input
        id={id}
        type={kind === "phone" ? "tel" : "email"}
        dir="ltr"
        value={value.value}
        onChange={(e) => onChange({ ...value, value: e.target.value })}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <VisibilitySelector
        value={value.visibility}
        onChange={(visibility) => onChange({ ...value, visibility })}
        allowComplex={allowComplex}
      />
    </fieldset>
  );
}
export function MemberEditor({
  value,
  onChange,
  onRemove,
  allowComplex = true,
  disabled = false,
  errors,
}: {
  value: MemberDraft;
  onChange: (v: MemberDraft) => void;
  onRemove?: () => void;
  allowComplex?: boolean;
  disabled?: boolean;
  errors?: Partial<Record<"name" | "phone" | "email", string>>;
}) {
  const { t } = useI18n();
  const id = useId();
  return (
    <fieldset
      disabled={disabled}
      className="community-enter community-interactive space-y-4 rounded-2xl border bg-card p-4"
    >
      <legend className="px-2 font-semibold">{t("family")}</legend>
      <div className="space-y-2">
        <Label htmlFor={`${id}-name`}>{t("fullName")}</Label>
        <Input
          id={`${id}-name`}
          dir="auto"
          required
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          aria-invalid={!!errors?.name}
          aria-describedby={errors?.name ? `${id}-error` : undefined}
        />
        {errors?.name && (
          <p role="alert" id={`${id}-error`}>
            {errors.name}
          </p>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${id}-relation`}>{t("relation")}</Label>
          <Input
            id={`${id}-relation`}
            dir="auto"
            value={value.relation ?? ""}
            onChange={(e) => onChange({ ...value, relation: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${id}-birth`}>{t("birthDate")}</Label>
          <Input
            id={`${id}-birth`}
            type="date"
            dir="ltr"
            value={value.birthDate ?? ""}
            onChange={(e) => onChange({ ...value, birthDate: e.target.value })}
          />
        </div>
      </div>
      <Label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          checked={value.child}
          onChange={(e) =>
            onChange({
              ...value,
              child: e.target.checked,
              ...(e.target.checked
                ? {
                    phone: { ...value.phone, visibility: "admins" },
                    email: { ...value.email, visibility: "admins" },
                  }
                : {}),
            })
          }
        />
        {t("child")}
      </Label>
      <div className="grid gap-4 lg:grid-cols-2">
        <ContactField
          kind="phone"
          value={value.phone}
          onChange={(phone) => onChange({ ...value, phone })}
          allowComplex={allowComplex}
          error={errors?.phone}
        />
        <ContactField
          kind="email"
          value={value.email}
          onChange={(email) => onChange({ ...value, email })}
          allowComplex={allowComplex}
          error={errors?.email}
        />
      </div>
      <Label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          checked={value.birthdayPublic}
          onChange={(e) => onChange({ ...value, birthdayPublic: e.target.checked })}
        />
        {t("birthdayPublic")}
      </Label>
      {onRemove && (
        <Button type="button" variant="outline" onClick={onRemove}>
          {t("remove")}
        </Button>
      )}
    </fieldset>
  );
}
