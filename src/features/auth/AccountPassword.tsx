"use client";

import { useState, type FormEvent } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "./client";
import { setAccountPassword } from "./password-action";

export function AccountPassword({ hasPassword }: { hasPassword: boolean }) {
  const { t } = useI18n();
  const [configured, setConfigured] = useState(hasPassword);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"saved" | "failed" | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setStatus(null);
    try {
      const newPassword = String(values.get("newPassword"));
      const success = configured
        ? !(
            await authClient.changePassword({
              newPassword,
              currentPassword: String(values.get("currentPassword")),
              revokeOtherSessions: true,
            })
          ).error
        : await setAccountPassword(newPassword);
      setStatus(success ? "saved" : "failed");
      if (success) {
        setConfigured(true);
        form.reset();
      }
    } catch {
      setStatus("failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border bg-card p-6">
      <h2 className="text-lg">{t(configured ? "authChangePassword" : "authSetPassword")}</h2>
      <p className="text-sm text-muted-foreground">{t("authPasswordHelp")}</p>
      <fieldset disabled={busy} className="space-y-3">
        {configured && (
          <label className="block space-y-1">
            <span>{t("password")}</span>
            <Input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
              dir="ltr"
            />
          </label>
        )}
        <label className="block space-y-1">
          <span>{t("newPassword")}</span>
          <Input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
            dir="ltr"
          />
        </label>
        <Button type="submit" loading={busy}>
          {t("save")}
        </Button>
      </fieldset>
      {status && (
        <p role={status === "failed" ? "alert" : "status"}>
          {t(status === "saved" ? "authPasswordSaved" : "authPasswordFailed")}
        </p>
      )}
    </form>
  );
}
