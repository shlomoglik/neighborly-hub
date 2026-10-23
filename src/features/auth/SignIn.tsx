"use client";
import Link from "next/link";
import { authReturnPath } from "./return-path";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { useState, type FormEvent } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { LangSwitcher } from "@/components/LangSwitcher";
import { authClient } from "./client";
export function SignIn({
  enabled,
  googleEnabled = true,
  emailDeliveryEnabled = false,
  initialError = false,
  returnTo,
}: {
  enabled: boolean;
  googleEnabled?: boolean;
  emailDeliveryEnabled?: boolean;
  initialError?: boolean;
  returnTo?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [mode, setMode] = useState<"signIn" | "signUp" | "forgot">("signIn");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(initialError);
  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !enabled) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const email = String(values.get("email")).trim().toLowerCase();
    const password = String(values.get("password") ?? "");
    setBusy(true);
    setFailed(false);
    setSent(false);
    try {
      const result =
        mode === "forgot"
          ? await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" })
          : mode === "signUp"
            ? await authClient.signUp.email({
                email,
                password,
                name: String(values.get("name")).trim(),
                callbackURL: authReturnPath(returnTo),
              })
            : await authClient.signIn.email({ email, password });
      if (result.error) {
        setFailed(true);
        return;
      }
      form.reset();
      if (mode === "signIn") {
        router.replace(authReturnPath(returnTo));
        router.refresh();
      } else {
        setSent(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  function switchMode(next: typeof mode) {
    setMode(next);
    setFailed(false);
    setSent(false);
  }
  async function signIn() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: authReturnPath(returnTo),
        errorCallbackURL:
          returnTo && authReturnPath(returnTo) !== "/directory"
            ? `/auth?error=sign-in&next=${encodeURIComponent(authReturnPath(returnTo))}`
            : "/auth?error=sign-in",
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
            {t(mode)}
          </h1>
          <p className="text-sm text-muted-foreground">{t("authIntro")}</p>
          {!enabled && <p role="status">{t("authUnavailable")}</p>}
          {failed && (
            <p role="alert" className="text-destructive">
              {t("authFailed")}
            </p>
          )}
          {enabled && (
            <>
              <form key={mode} onSubmit={submitEmail} className="space-y-3">
                <fieldset disabled={busy} className="space-y-3">
                  {mode === "signUp" && (
                    <label className="block space-y-1">
                      <span>{t("fullName")}</span>
                      <Input name="name" autoComplete="name" required maxLength={100} />
                    </label>
                  )}
                  <label className="block space-y-1">
                    <span>{t("email")}</span>
                    <Input
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      maxLength={254}
                      dir="ltr"
                    />
                  </label>
                  {mode !== "forgot" && (
                    <label className="block space-y-1">
                      <span>{t("password")}</span>
                      <Input
                        name="password"
                        type="password"
                        autoComplete={mode === "signUp" ? "new-password" : "current-password"}
                        required
                        minLength={mode === "signUp" ? 12 : undefined}
                        maxLength={128}
                        dir="ltr"
                      />
                    </label>
                  )}
                  {mode === "signUp" && (
                    <p className="text-sm text-muted-foreground">{t("authPasswordHelp")}</p>
                  )}
                  <Button type="submit" loading={busy} className="w-full">
                    {t(mode === "forgot" ? "authSendReset" : mode)}
                  </Button>
                </fieldset>
              </form>
              {sent && (
                <p role="status">{t(mode === "forgot" ? "authResetNotice" : "authVerifyNotice")}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {mode !== "signIn" && (
                  <Button
                    type="button"
                    variant="link"
                    disabled={busy}
                    onClick={() => switchMode("signIn")}
                  >
                    {t("signIn")}
                  </Button>
                )}
                {emailDeliveryEnabled && mode !== "signUp" && (
                  <Button
                    type="button"
                    variant="link"
                    disabled={busy}
                    onClick={() => switchMode("signUp")}
                  >
                    {t("signUp")}
                  </Button>
                )}
                {emailDeliveryEnabled && mode !== "forgot" && (
                  <Button
                    type="button"
                    variant="link"
                    disabled={busy}
                    onClick={() => switchMode("forgot")}
                  >
                    {t("forgot")}
                  </Button>
                )}
              </div>
              {!emailDeliveryEnabled && (
                <p className="text-sm text-muted-foreground">{t("authEmailSetupNotice")}</p>
              )}
            </>
          )}
          {googleEnabled && (
            <Button
              type="button"
              className="w-full"
              disabled={!enabled || busy}
              loading={busy}
              onClick={signIn}
            >
              {busy ? t("loading") : t("google")}
            </Button>
          )}
          <p className="text-sm text-muted-foreground">{t("authAccessNotice")}</p>
        </section>
      </div>
    </div>
  );
}
