"use client";
import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { usePrivateResource } from "@/features/shared/use-private-resource";
import { HouseholdFeedback } from "./HouseholdWorkspace";
import { householdApi } from "./household-api";
export function MyHouseholds() {
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const resource = usePrivateResource(String(page), (signal) => householdApi.mine(page, signal));
  return (
    <AppShell>
      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">{t("homeMine")}</h1>
          <Button
            variant="outline"
            disabled={resource.status === "loading"}
            onClick={resource.refresh}
          >
            {t("refreshDirectory")}
          </Button>
        </div>
        <HouseholdFeedback status={resource.status} onRefresh={resource.refresh} />
        {resource.status === "ready" && resource.data && (
          <div className="community-enter space-y-4">
            {resource.data.households.length === 0 && <p>{t("homeNone")}</p>}
            <ul className="space-y-3">
              {resource.data.households.map((h) => (
                <li key={h.id}>
                  <Link
                    href={`/household/${h.id}`}
                    className="community-interactive block space-y-2 rounded-2xl border bg-card p-4 transition-colors hover:bg-secondary"
                  >
                    <h2 className="font-semibold">
                      <bdi>{h.name}</bdi>
                    </h2>
                    <p>
                      <bdi>
                        {h.project} · {h.building} · {h.apartment}
                      </bdi>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
            <nav className="flex items-center justify-between gap-2" aria-label={t("homePages")}>
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                {t("directoryPrevious")}
              </Button>
              <span>{t("directoryPage", { n: page })}</span>
              <Button
                variant="outline"
                disabled={!resource.data.hasNext}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("directoryNext")}
              </Button>
            </nav>
          </div>
        )}
      </section>
    </AppShell>
  );
}
