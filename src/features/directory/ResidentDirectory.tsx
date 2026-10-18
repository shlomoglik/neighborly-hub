"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MemberRow } from "@/components/community/MemberRow";
import { SystemFeedback } from "@/components/community/SystemFeedback";
import { CommunitySkeleton } from "@/components/community/CommunityLoading";
import type { DirectoryPage, DirectoryProject, DirectoryQuery } from "@/lib/access/contracts";
import type { DirectoryStatus } from "./use-directory";
export type ResidentDirectoryProps = {
  status: DirectoryStatus;
  projects: DirectoryProject[];
  selectedProjectId: string;
  query: DirectoryQuery;
  data: DirectoryPage | null;
  onProjectChange: (id: string) => void;
  onQueryChange: (value: string) => void;
  onBuildingChange: (id: string) => void;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
};
/** Presentation only: data and callbacks carry no database or fetch operations. */
export function ResidentDirectory(props: ResidentDirectoryProps) {
  const { t } = useI18n();
  const { status, projects, query, data } = props;
  const heading = useRef<HTMLHeadingElement>(null);
  const focusAfterPage = useRef(false);
  useEffect(() => {
    if (status !== "loading" && focusAfterPage.current) {
      heading.current?.focus();
      focusAfterPage.current = false;
    }
  }, [status, data]);
  const changePage = (page: number) => {
    focusAfterPage.current = true;
    props.onPageChange(page);
  };
  const selected = projects.find((p) => p.id === props.selectedProjectId);
  return (
    <section className="space-y-5" aria-label={t("directory")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold">
          {t("directory")}
        </h1>
        <Button variant="outline" disabled={status === "loading"} onClick={props.onRefresh}>
          {t("refreshDirectory")}
        </Button>
      </div>
      {projects.length > 0 && (
        <div className="community-enter space-y-3 rounded-2xl border bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              <span>{t("project")}</span>
              <select
                className="min-h-11 w-full rounded-xl border bg-card px-3"
                value={selected?.id ?? ""}
                onChange={(e) => props.onProjectChange(e.target.value)}
              >
                <option value="" disabled>
                  {t("chooseProject")}
                </option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm font-medium">
              <span>{t("filterBuilding")}</span>
              <select
                className="min-h-11 w-full rounded-xl border bg-card px-3"
                value={query.buildingId}
                onChange={(e) => props.onBuildingChange(e.target.value)}
                disabled={!selected}
              >
                <option value="">{t("allBuildings")}</option>
                {selected?.buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block space-y-2 text-sm font-medium">
            <span>{t("search")}</span>
            <Input
              maxLength={100}
              className="min-h-11"
              value={query.query}
              placeholder={t("search")}
              onChange={(e) => props.onQueryChange(e.target.value)}
            />
          </label>
        </div>
      )}
      {status === "loading" && <CommunitySkeleton variant="directory" />}
      {status === "error" && <SystemFeedback kind="error" onRetry={props.onRefresh} />}
      {status === "unlinked" && (
        <SystemFeedback kind="private" message={t("directoryUnlinked")} onRetry={props.onRefresh} />
      )}
      {status === "forbidden" && (
        <SystemFeedback
          kind="private"
          message={t("directoryAccessChanged")}
          onRetry={props.onRefresh}
        />
      )}
      {status === "expired" && (
        <div className="space-y-3">
          <SystemFeedback kind="private" message={t("directorySessionExpired")} />
          <Button asChild>
            <a href="/auth">{t("signIn")}</a>
          </Button>
        </div>
      )}
      {status === "ready" && data && (
        <div className="community-enter space-y-4">
          <p role="status" className="text-sm text-muted-foreground">
            {t("directoryPage", { n: data.page })}
          </p>
          {data.residents.length === 0 ? (
            <SystemFeedback kind="empty" />
          ) : (
            <ul className="space-y-3" aria-label={t("directory")}>
              {data.residents.map((resident) => (
                <li key={`${resident.householdId}:${resident.personId}`}>
                  <MemberRow
                    member={{
                      id: resident.personId,
                      name: resident.name,
                      relation: `${resident.householdName} · ${t("building")} ${resident.buildingName} · ${t("apartment")} ${resident.apartment}`,
                      contacts: resident.contacts.map((c) => ({
                        kind: c.kind,
                        visible: true,
                        value: c.value,
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
          <nav
            aria-label={t("directoryPagination")}
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <Button
              variant="outline"
              disabled={data.page <= 1}
              onClick={() => changePage(data.page - 1)}
            >
              {t("directoryPrevious")}
            </Button>
            <Button
              variant="outline"
              disabled={!data.hasNext}
              onClick={() => changePage(data.page + 1)}
            >
              {t("directoryNext")}
            </Button>
          </nav>
        </div>
      )}
    </section>
  );
}
