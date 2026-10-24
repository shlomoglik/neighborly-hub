"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/context";
import { authClient } from "./client";
import { setAccountPassword } from "./set-password";

export function PasswordForm({
  mode,
  token,
}: {
  mode: "set" | "change" | "reset";
  token?: string;
}) {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [current, setCurrent] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"failed" | "mismatch" | "saved" | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (password !== confirm) {
      setStatus("mismatch");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const success =
        mode === "set"
          ? await setAccountPassword(password)
          : !(
              mode === "change"
                ? await authClient.changePassword({
                    currentPassword: current,
                    newPassword: password,
                    revokeOtherSessions: true,
                  })
                : await authClient.resetPassword({ newPassword: password, token })
            ).error;
      setStatus(success ? "saved" : "failed");
      if (success) {
        setPassword("");
        setConfirm("");
        setCurrent("");
      }
    } catch {
      setStatus("failed");
    } finally {
      setBusy(false);
    }
  }
  if (status === "saved")
    return (
      <div role="status" className="space-y-3">
        <p>{t("authPasswordSaved")}</p>
        <Link href="/auth" className="text-primary underline">
          {t("signIn")}
        </Link>
      </div>
    );
  return (
    <form onSubmit={submit} className="space-y-3">
      <h2 className="text-lg">{t(mode === "set" ? "authSetPassword" : "newPassword")}</h2>
      {mode === "set" && (
        <p className="text-sm text-muted-foreground">{t("authSetPasswordIntro")}</p>
      )}
      <fieldset disabled={busy} className="space-y-3">
        {mode === "change" && (
          <label className="block space-y-1">
            <span>{t("authCurrentPassword")}</span>
            <Input
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
              maxLength={128}
            />
          </label>
        )}
        <label className="block space-y-1">
          <span>{t("newPassword")}</span>
          <Input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={12}
            maxLength={128}
            aria-describedby="password-hint"
          />
        </label>
        <p id="password-hint" className="text-sm text-muted-foreground">
          {t("authPasswordHint")}
        </p>
        <label className="block space-y-1">
          <span>{t("authConfirmPassword")}</span>
          <Input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={12}
            maxLength={128}
          />
        </label>
        <Button type="submit" loading={busy}>
          {t("save")}
        </Button>
      </fieldset>
      {status && (
        <p role="alert" className="text-destructive">
          {t(status === "mismatch" ? "authPasswordMismatch" : "authPasswordFailed")}
        </p>
      )}
    </form>
  );
}
