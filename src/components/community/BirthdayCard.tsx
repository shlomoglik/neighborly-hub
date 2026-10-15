"use client";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "../ui/button";
export function BirthdayCard({
  name,
  when,
  age,
  date,
  onGreet,
}: {
  name: string;
  when: string;
  age?: number;
  /** Next occurrence, never a full birth date. */
  date?: Date;
  onGreet?: () => void;
}) {
  const { t, lang } = useI18n();
  return (
    <article className="community-enter community-interactive flex flex-wrap items-center gap-4 rounded-2xl border border-warning/40 bg-warning/10 p-4">
      <span aria-hidden="true" className="text-3xl">
        🎂
      </span>
      {date && (
        <time
          dateTime={date.toISOString().slice(0, 10)}
          className="shrink-0 rounded-xl bg-card p-3 text-center tabular-nums"
        >
          {new Intl.DateTimeFormat(lang, {
            day: "numeric",
            month: "short",
            timeZone: "UTC",
          }).format(date)}
        </time>
      )}
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold">
          <bdi>{name}</bdi>
        </h3>
        <p className="text-sm text-muted-foreground">
          {when}
          {age === undefined ? "" : ` · ${t("turns", { n: age })}`}
        </p>
      </div>
      {onGreet && (
        <Button variant="outline" onClick={onGreet}>
          {t("greet")}
        </Button>
      )}
    </article>
  );
}
