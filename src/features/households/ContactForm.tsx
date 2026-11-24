"use client";

import { useId, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VisibilitySelector, type Visibility } from "@/components/community/VisibilitySelector";
import { contactValue, type ContactFields } from "@/lib/access/household-contracts";

const visibility: Record<ContactFields["visibility"], Visibility> = {
  managers: "admins",
  building: "building",
  project: "complex",
};
const contactVisibility: Record<Visibility, ContactFields["visibility"]> = {
  admins: "managers",
  building: "building",
  complex: "project",
};
export const toVisibility = (value: ContactFields["visibility"]) => visibility[value];

export function ContactForm({
  value,
  busy,
  canSave,
  adding,
  feedback,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: ContactFields;
  busy: boolean;
  canSave: boolean;
  adding: boolean;
  feedback: ReactNode;
  onChange: (patch: Partial<ContactFields>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const errorId = useId();
  const invalid =
    Boolean(value.value) &&
    !contactValue.safeParse({
      kind: value.kind,
      value: value.value,
    }).success;

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (canSave && !busy) onSubmit();
      }}
    >
      <fieldset disabled={busy} className="min-w-0 space-y-3">
        <legend className="mb-2 text-sm font-medium">
          {t(adding ? "homeAddContact" : "homeContactEditor")}
        </legend>
        <label className="block space-y-2 text-sm">
          <span>{t("homeContactKind")}</span>
          <select
            className="min-h-11 w-full rounded-xl border bg-card px-3"
            value={value.kind}
            onChange={(event) =>
              onChange({ kind: event.target.value === "phone" ? "phone" : "email" })
            }
          >
            <option value="phone">{t("phone")}</option>
            <option value="email">{t("email")}</option>
          </select>
        </label>
        <label className="block space-y-2 text-sm">
          <span>{t(value.kind)}</span>
          <Input
            autoFocus
            required
            dir="ltr"
            type={value.kind === "email" ? "email" : "tel"}
            autoComplete={value.kind === "email" ? "email" : "tel"}
            inputMode={value.kind === "email" ? "email" : "tel"}
            maxLength={value.kind === "email" ? 254 : 40}
            value={value.value}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? errorId : undefined}
            onChange={(event) => onChange({ value: event.target.value })}
          />
        </label>
        {invalid && (
          <p id={errorId} role="alert" className="text-sm text-destructive">
            {t("homeInvalid")}
          </p>
        )}
        <label className="block space-y-2 text-sm">
          <span>{t("homeContactLabel")}</span>
          <Input
            maxLength={50}
            value={value.label ?? ""}
            onChange={(event) => onChange({ label: event.target.value || null })}
          />
        </label>
        <VisibilitySelector
          value={toVisibility(value.visibility)}
          onChange={(next) => onChange({ visibility: contactVisibility[next] })}
        />
        {feedback}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!canSave}>
            {t(busy ? "saving" : "save")}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("cancel")}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
