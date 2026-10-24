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
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(initialError);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !enabled) return;
    setBusy(true);
    setFailed(false);
    setSent(false);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const destination = authReturnPath(returnTo);
      const result =
        mode === "signup"
          ? await authClient.signUp.email({
              email: normalizedEmail,
              password,
              name: name.trim(),
              callbackURL: `/auth?next=${encodeURIComponent(destination)}`,
            })
          : mode === "forgot"
            ? await authClient.requestPasswordReset({
                email: normalizedEmail,
                redirectTo: "/reset-password",
              })
            : await authClient.signIn.email({ email: normalizedEmail, password });
      if (result.error) setFailed(true);
      else if (mode === "login") {
        router.replace(destination);
        router.refresh();
      } else {
        setSent(true);
        setPassword("");
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  function changeMode(next: typeof mode) {
    setMode(next);
    setFailed(false);
    setSent(false);
    setPassword("");
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
            {t("signIn")}
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
              <form onSubmit={submit} className="space-y-3">
                <fieldset disabled={busy} className="space-y-3">
                  {mode === "signup" && (
                    <label className="block space-y-1">
                      <span>{t("fullName")}</span>
                      <Input
                        autoComplete="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        maxLength={200}
                      />
                    </label>
                  )}
                  <label className="block space-y-1">
                    <span>{t("email")}</span>
                    <Input
                      type="email"
                      autoComplete="username"
                      dir="ltr"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      maxLength={254}
                    />
                  </label>
                  {mode !== "forgot" && (
                    <label className="block space-y-1">
                      <span>{t("password")}</span>
                      <Input
                        type="password"
                        autoComplete={mode === "signup" ? "new-password" : "current-password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={mode === "signup" ? 12 : undefined}
                        maxLength={128}
                        aria-describedby={mode === "signup" ? "signup-password-hint" : undefined}
                      />
                    </label>
                  )}
                  {mode === "signup" && (
                    <p id="signup-password-hint" className="text-sm text-muted-foreground">
                      {t("authPasswordHint")}
                    </p>
                  )}
                  <Button type="submit" className="w-full" loading={busy}>
                    {t(mode === "login" ? "signIn" : mode === "signup" ? "signUp" : "forgot")}
                  </Button>
                </fieldset>
              </form>
              {sent && (
                <p role="status">{t(mode === "signup" ? "authVerifySent" : "authResetSent")}</p>
              )}
              {emailDeliveryEnabled && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="link"
                    disabled={busy}
                    onClick={() => changeMode(mode === "login" ? "signup" : "login")}
                  >
                    {t(mode === "login" ? "signUp" : "signIn")}
                  </Button>
                  {mode === "login" && (
                    <Button
                      type="button"
                      variant="link"
                      disabled={busy}
                      onClick={() => changeMode("forgot")}
                    >
                      {t("forgot")}
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
          {googleEnabled && (
            <Button
              type="button"
              className="w-full"
              variant="outline"
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
