"use client";
import { useI18n } from "@/lib/i18n/context";
import { AlertCircle, LockKeyhole, SearchX, WifiOff, Check, LoaderCircle } from "lucide-react";
import { Button } from "../ui/button";
export function SystemFeedback({
  kind,
  message,
  onRetry,
  onUndo,
}: {
  kind: "empty" | "error" | "offline" | "private" | "success" | "loading";
  message?: string;
  onRetry?: () => void;
  onUndo?: () => void;
}) {
  const { t } = useI18n();
  const Icon = {
    empty: SearchX,
    error: AlertCircle,
    offline: WifiOff,
    private: LockKeyhole,
    success: Check,
    loading: LoaderCircle,
  }[kind];
  const defaults = {
    empty: t("noResults"),
    error: t("loadError"),
    offline: t("staleData"),
    private: t("privateDetails"),
    success: t("successMessage"),
    loading: t("loading"),
  };
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className="community-enter community-interactive flex flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center"
    >
      <Icon aria-hidden="true" className="size-6 text-muted-foreground" />
      <p>{message ?? defaults[kind]}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          {t("retry")}
        </Button>
      )}
      {onUndo && (
        <Button variant="ghost" onClick={onUndo}>
          {t("undo")}
        </Button>
      )}
    </div>
  );
}
