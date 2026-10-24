"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/context";
import { authClient } from "./client";

export function LoginMethods({
  hasGoogle,
  hasPassword,
  googleEnabled,
  emailVerified,
  emailDeliveryEnabled,
  email,
  initialError,
}: {
  hasGoogle: boolean;
  hasPassword: boolean;
  googleEnabled: boolean;
  emailVerified: boolean;
  emailDeliveryEnabled: boolean;
  email: string;
  initialError: boolean;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(initialError);
  const [sent, setSent] = useState(false);
  async function connect() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const result = await authClient.linkSocial({
        provider: "google",
        callbackURL: "/account",
        errorCallbackURL: "/account?error=link",
        loginHint: email,
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
  async function verify() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    setSent(false);
    try {
      const result = await authClient.sendVerificationEmail({ email, callbackURL: "/account" });
      if (result.error) setFailed(true);
      else setSent(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-labelledby="login-methods-title"
      className="space-y-3 rounded-2xl border bg-card p-6"
    >
      <h2 id="login-methods-title" className="text-lg">
        {t("authLoginMethods")}
      </h2>
      <ul className="space-y-2">
        <li>
          {t("authGoogleMethod")}: {t(hasGoogle ? "authMethodConnected" : "authMethodNotConnected")}
        </li>
        <li>
          {t("authPasswordMethod")}:{" "}
          {t(hasPassword ? "authMethodConnected" : "authMethodNotConnected")}
        </li>
      </ul>
      <p className="text-sm text-muted-foreground">{t("authLinkHelp")}</p>
      {!emailVerified && (
        <>
          <p role="status">{t("authLinkVerifyRequired")}</p>
          {emailDeliveryEnabled && (
            <Button variant="outline" loading={busy} onClick={verify}>
              {t("authSendVerification")}
            </Button>
          )}
        </>
      )}
      {googleEnabled && !hasGoogle && emailVerified && (
        <Button variant="outline" loading={busy} onClick={connect}>
          {t("authConnectGoogle")}
        </Button>
      )}
      {failed && <p role="alert">{t("authLinkFailed")}</p>}
      {sent && <p role="status">{t("authVerificationRequested")}</p>}
    </section>
  );
}
