"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n/context";
import { feedbackInput, type FeedbackInput } from "@/lib/access/product-feedback-contracts";
import { privateRequest, PrivateRequestError } from "@/features/shared/private-api";

export function ProductFeedback() {
  const { t, dir } = useI18n();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"saved" | "failed" | "invalid" | "auth" | null>(null);
  const submission = useRef<FeedbackInput | null>(null);
  const inFlight = useRef(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || status === "saved") return;
    if (!submission.current) {
      const input = feedbackInput.safeParse({ submissionId: crypto.randomUUID(), message });
      if (!input.success) {
        setStatus("invalid");
        return;
      }
      submission.current = input.data;
    }
    inFlight.current = true;
    setBusy(true);
    setStatus(null);
    try {
      await privateRequest<{ id: string }>(
        "/api/product-feedback",
        AbortSignal.timeout(20000),
        "POST",
        submission.current,
      );
      setStatus("saved");
      setMessage("");
      submission.current = null;
    } catch (error) {
      setStatus(error instanceof PrivateRequestError && error.status === 401 ? "auth" : "failed");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <AppShell activePath="/account">
      <section dir={dir} className="mx-auto max-w-lg space-y-4">
        <Link href="/account" className="inline-flex min-h-11 items-center text-primary underline">
          {t("authAccount")}
        </Link>
        <h1 className="text-2xl">{t("productFeedbackTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("productFeedbackPrivacy")}</p>
        {status === "saved" ? (
          <div className="space-y-4">
            <p role="status">{t("productFeedbackSuccess")}</p>
            <Button onClick={() => setStatus(null)}>{t("productFeedbackNew")}</Button>
          </div>
        ) : (
          <form onSubmit={submit} aria-busy={busy} className="space-y-4">
            <label className="block space-y-2">
              <span>{t("productFeedbackMessage")}</span>
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                readOnly={busy || Boolean(submission.current)}
                required
                maxLength={2000}
                rows={7}
                aria-describedby="feedback-hint"
                aria-invalid={status === "invalid"}
              />
            </label>
            <p id="feedback-hint" className="text-sm text-muted-foreground">
              {t("productFeedbackHint")}
            </p>
            {status && (
              <p role="alert" className="text-destructive">
                {t(
                  status === "invalid"
                    ? "productFeedbackInvalid"
                    : status === "auth"
                      ? "productFeedbackAuth"
                      : "productFeedbackFailed",
                )}
              </p>
            )}
            {status === "auth" && (
              <Link
                href="/auth"
                target="_blank"
                className="inline-flex min-h-11 items-center text-primary underline"
              >
                {t("productFeedbackSignIn")}
              </Link>
            )}
            <Button
              type="submit"
              loading={busy}
              disabled={!message.trim()}
              className="w-full sm:w-auto"
            >
              {t(
                busy
                  ? "productFeedbackSending"
                  : submission.current
                    ? "productFeedbackRetry"
                    : "productFeedbackSend",
              )}
            </Button>
          </form>
        )}
      </section>
    </AppShell>
  );
}
