"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { authClient } from "./client";

export function ResetPassword({ token }: { token?: string }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || busy) return;
    const form = event.currentTarget;
    const newPassword = String(new FormData(form).get("password"));
    setBusy(true);
    setFailed(false);
    try {
      const result = await authClient.resetPassword({ token, newPassword });
      if (result.error) setFailed(true);
      else {
        form.reset();
        setSaved(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-8">
      <h1 className="text-2xl">{t("newPassword")}</h1>
      {!token || failed ? <p role="alert">{t("authResetFailed")}</p> : null}
      {saved ? (
        <p role="status">{t("authPasswordSaved")}</p>
      ) : (
        token && (
          <form onSubmit={submit} className="space-y-3">
            <label className="block space-y-1">
              <span>{t("newPassword")}</span>
              <Input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                required
                disabled={busy}
                dir="ltr"
              />
            </label>
            <p className="text-sm text-muted-foreground">{t("authPasswordHelp")}</p>
            <Button type="submit" loading={busy}>
              {t("save")}
            </Button>
          </form>
        )
      )}
      <Link href="/auth" className="inline-flex min-h-11 items-center text-primary underline">
        {t("signIn")}
      </Link>
    </main>
  );
}
