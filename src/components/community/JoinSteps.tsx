"use client";
import { useI18n } from "@/lib/i18n/context";
const steps = ["stepDetails", "stepMembers", "stepReview"] as const;
export function JoinSteps({
  current,
  onStep,
}: {
  current: 0 | 1 | 2;
  onStep?: (step: 0 | 1 | 2) => void;
}) {
  const { t } = useI18n();
  return (
    <nav aria-label={t("joinSteps")}>
      <ol className="community-enter community-interactive flex gap-2">
        {steps.map((key, i) => (
          <li key={key} className="min-w-0 flex-1">
            <button
              type="button"
              disabled={!onStep || i > current}
              onClick={() => onStep?.(i as 0 | 1 | 2)}
              aria-current={current === i ? "step" : undefined}
              className={`community-interactive min-h-11 w-full border-b-4 px-2 py-3 text-sm disabled:cursor-default ${i <= current ? "border-primary" : "border-border text-muted-foreground"}`}
            >
              <span aria-hidden="true">{i + 1}. </span>
              {t(key)}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
