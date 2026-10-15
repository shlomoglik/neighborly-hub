"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { authClient } from "./client";
export function SignOut() {
  const { t } = useI18n();
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  async function signOut() {
    setBusy(true);
    setFailed(false);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setFailed(true);
        setBusy(false);
        return;
      }
      router.replace("/auth");
      router.refresh();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      <Button variant="outline" loading={busy} onClick={signOut}>
        {t("signOut")}
      </Button>
      {failed && (
        <p role="alert" className="text-destructive">
          {t("authSignOutFailed")}
        </p>
      )}
    </div>
  );
}
