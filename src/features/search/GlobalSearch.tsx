"use client";
import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MemberRow } from "@/components/community/MemberRow";
import { SystemFeedback } from "@/components/community/SystemFeedback";
import { CommunitySkeleton } from "@/components/community/CommunityLoading";
import { useI18n } from "@/lib/i18n/context";
import type { GlobalSearchPage } from "@/lib/access/search-contracts";
import { privateRequest } from "@/features/shared/private-api";
import { usePrivateResource } from "@/features/shared/use-private-resource";

export function GlobalSearch() {
  const { t } = useI18n();
  const [input, setInput] = useState("");
  const [search, setSearch] = useState({ query: "", page: 1 });
  const active = search.query.length >= 2 && input.trim() === search.query;
  const resource = usePrivateResource(JSON.stringify([search, active]), (signal) =>
    active
      ? privateRequest<GlobalSearchPage>(
          `/api/search?${new URLSearchParams({ query: search.query, page: String(search.page) })}`,
          signal,
        )
      : Promise.resolve<GlobalSearchPage>({ residents: [], page: 1, hasNext: false }),
  );
  return (
    <AppShell>
      <section className="space-y-5" aria-label={t("globalSearch")}>
        <h1 className="text-2xl font-bold">{t("globalSearch")}</h1>
        <p className="text-sm text-muted-foreground">{t("globalSearchHint")}</p>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setSearch({ query: input.trim(), page: 1 });
            resource.refresh();
          }}
        >
          <Input
            aria-label={t("globalSearchHint")}
            maxLength={100}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button type="submit" disabled={input.trim().length < 2}>
            {t("search")}
          </Button>
        </form>
        {!active && <p role="status">{t("globalSearchStart")}</p>}
        {active && resource.status === "loading" && <CommunitySkeleton variant="directory" />}
        {active && resource.status === "error" && (
          <SystemFeedback kind="error" onRetry={resource.refresh} />
        )}
        {active && resource.status === "unavailable" && (
          <SystemFeedback kind="private" onRetry={resource.refresh} />
        )}
        {resource.status === "expired" && (
          <div className="space-y-3">
            <SystemFeedback kind="private" message={t("directorySessionExpired")} />
            <Button asChild>
              <a href="/auth">{t("signIn")}</a>
            </Button>
          </div>
        )}
        {active && resource.status === "ready" && resource.data && (
          <div className="community-enter space-y-4">
            <p role="status">{t("directoryPage", { n: resource.data.page })}</p>
            {!resource.data.residents.length ? (
              <SystemFeedback kind="empty" />
            ) : (
              <ul className="space-y-3">
                {resource.data.residents.map((resident) => (
                  <li key={`${resident.householdId}:${resident.personId}`}>
                    <MemberRow
                      member={{
                        id: resident.personId,
                        name: resident.name,
                        relation: `${resident.projectName} · ${resident.householdName} · ${t("building")} ${resident.buildingName} · ${t("apartment")} ${resident.apartment}`,
                        contacts: resident.contacts.map((contact) => ({
                          ...contact,
                          visible: true,
                        })),
                      }}
                    />
                    <Link
                      href={`/household/${resident.householdId}`}
                      className="inline-flex min-h-11 items-center px-4 text-primary underline"
                    >
                      {t("homeOpen")}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <nav aria-label={t("directoryPagination")} className="flex justify-between gap-3">
              <Button
                variant="outline"
                disabled={search.page <= 1}
                onClick={() => setSearch({ ...search, page: search.page - 1 })}
              >
                {t("directoryPrevious")}
              </Button>
              <Button
                variant="outline"
                disabled={!resource.data.hasNext}
                onClick={() => setSearch({ ...search, page: search.page + 1 })}
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
