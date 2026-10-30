"use client";

import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";

const values = ["Privacy", "People", "Independence", "Simplicity"] as const;

export function Vision() {
  const { t } = useI18n();
  return (
    <AppShell>
      <article className="space-y-10 py-4 sm:py-8" aria-labelledby="vision-heading">
        <header className="space-y-4 rounded-2xl bg-secondary p-6 sm:p-10">
          <p className="text-sm font-medium text-muted-foreground">{t("visionTitle")}</p>
          <h1 id="vision-heading" className="text-3xl sm:text-4xl">
            {t("visionHero")}
          </h1>
          <p className="text-lg leading-relaxed">{t("visionIntro")}</p>
          <p className="leading-relaxed">{t("visionHomeBody")}</p>
        </header>
        <section className="space-y-3" aria-labelledby="vision-directory">
          <h2 id="vision-directory" className="text-2xl">
            {t("visionDirectoryTitle")}
          </h2>
          <p className="leading-relaxed text-muted-foreground">{t("visionDirectoryBody")}</p>
        </section>
        <section className="space-y-3" aria-labelledby="vision-growth">
          <h2 id="vision-growth" className="text-2xl">
            {t("visionGrowthTitle")}
          </h2>
          <p className="leading-relaxed text-muted-foreground">{t("visionGrowthBody")}</p>
        </section>
        <section className="space-y-4" aria-labelledby="vision-values">
          <h2 id="vision-values" className="text-2xl">
            {t("visionValuesTitle")}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {values.map((value) => (
              <li key={value} className="space-y-2 rounded-2xl border bg-card p-5">
                <h3 className="text-lg">{t(`vision${value}Title`)}</h3>
                <p className="leading-relaxed text-muted-foreground">{t(`vision${value}Body`)}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-3" aria-labelledby="vision-pilot">
          <h2 id="vision-pilot" className="text-2xl">
            {t("visionPilotTitle")}
          </h2>
          <p className="leading-relaxed text-muted-foreground">{t("visionPilotBody")}</p>
        </section>
        <footer className="border-t pt-6 text-center font-heading text-lg">
          {t("visionClosing")}
        </footer>
      </article>
    </AppShell>
  );
}
