"use client";
import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { LangSwitcher } from "@/components/LangSwitcher";
import { authClient } from "./client";
export function SignIn({
  enabled,
  initialError = false,
}: {
  enabled: boolean;
  initialError?: boolean;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(initialError);
  async function signIn() {
    setBusy(true);
    setFailed(false);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/directory",
        errorCallbackURL: "/auth?error=sign-in",
      });
      if (result.error) {
        setFailed(true);
        setBusy(false);
      }
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-md">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="font-heading text-xl">
            {t("appName")}
          </Link>
          <LangSwitcher />
        </header>
        <section
          aria-labelledby="sign-in-title"
          className="community-enter mt-10 space-y-4 rounded-2xl border bg-card p-6"
        >
          <h1 id="sign-in-title" className="text-2xl">
            {t("signIn")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("authIntro")}</p>
          {!enabled && <p role="status">{t("authUnavailable")}</p>}
          {failed && (
            <p role="alert" className="text-destructive">
              {t("authFailed")}
            </p>
          )}
          <Button
            type="button"
            className="w-full"
            disabled={!enabled}
            loading={busy}
            onClick={signIn}
          >
            {busy ? t("loading") : t("google")}
          </Button>
          <p className="text-sm text-muted-foreground">{t("authAccessNotice")}</p>
        </section>
      </div>
    </div>
  );
}
