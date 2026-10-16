"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import {
  managementHref,
  type ManagementHierarchy,
  type ManagementProjects,
} from "@/lib/access/management-contracts";
import { Button } from "@/components/ui/button";
import { BuildingSelector } from "@/components/community/BuildingSelector";
import { CommunitySkeleton } from "@/components/community/CommunityLoading";
import { SystemFeedback } from "@/components/community/SystemFeedback";
import type { ManagementStatus } from "./use-management";
export type ManagementWorkspaceProps = {
  status: ManagementStatus;
  discovery: ManagementProjects | null;
  data: ManagementHierarchy | null;
  selectedProjectId: string;
  buildingId: string;
  onBuildingChange: (id: string) => void;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
};
/** Pure presentation; stories never mount the live request coordinator. */
export function ManagementWorkspace(p: ManagementWorkspaceProps) {
  const { t } = useI18n();
  const { discovery, data, status } = p;
  return (
    <section className="space-y-5" aria-label={t("manage")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("manage")}</h1>
        <Button variant="outline" onClick={p.onRefresh} disabled={status === "loading"}>
          {t("refreshManagement")}
        </Button>
        {discovery?.canCreateProject && (
          <Button asChild>
            <Link href="/manage/setup">{t("newProject")}</Link>
          </Button>
        )}
      </div>
      {discovery && (
        <nav aria-label={t("chooseProject")} className="space-y-3 rounded-2xl border bg-card p-4">
          <h2 className="font-bold">{t("chooseProject")}</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {discovery.projects.map((project) => (
              <li key={project.id}>
                <Link
                  href={managementHref(project.id)}
                  aria-current={p.selectedProjectId === project.id ? "page" : undefined}
                  className={`community-interactive block rounded-xl border p-3 focus-visible:outline-2 focus-visible:outline-primary ${p.selectedProjectId === project.id ? "border-primary bg-primary/10" : "hover:bg-muted"}`}
                >
                  <span className="block font-semibold">
                    <bdi>{project.name}</bdi>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    <bdi>{project.city}</bdi>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="outline"
              disabled={discovery.page <= 1}
              onClick={() => p.onPageChange(discovery.page - 1)}
            >
              {t("directoryPrevious")}
            </Button>
            <span>{t("directoryPage", { n: discovery.page })}</span>
            <Button
              variant="outline"
              disabled={!discovery.hasNext}
              onClick={() => p.onPageChange(discovery.page + 1)}
            >
              {t("directoryNext")}
            </Button>
          </div>
        </nav>
      )}
      {status === "loading" && <CommunitySkeleton variant="map" />}
      {status === "error" && <SystemFeedback kind="error" onRetry={p.onRefresh} />}
      {status === "empty" && <SystemFeedback kind="empty" message={t("managementEmpty")} />}
      {status === "forbidden" && (
        <SystemFeedback kind="private" message={t("managementForbidden")} onRetry={p.onRefresh} />
      )}
      {status === "unavailable" && (
        <div className="space-y-3">
          <SystemFeedback
            kind="private"
            message={t("managementUnavailable")}
            onRetry={p.onRefresh}
          />
          <Button variant="outline" onClick={() => p.onBuildingChange("")}>
            {t("allBuildings")}
          </Button>
          <Link href="/manage" className="block text-primary underline">
            {t("chooseProject")}
          </Link>
        </div>
      )}
      {status === "expired" && (
        <div className="space-y-3">
          <SystemFeedback kind="private" message={t("managementExpired")} />
          <Button asChild>
            <a href="/auth">{t("signIn")}</a>
          </Button>
        </div>
      )}
      {status === "ready" && !data && <SystemFeedback kind="empty" message={t("chooseProject")} />}
      {status === "ready" && data && (
        <div className="community-enter space-y-4">
          <header className="space-y-2">
            <h2 className="text-xl font-bold">
              <bdi>{data.name}</bdi>
            </h2>
            <p>
              <bdi>{data.city}</bdi>
            </p>
            <p role="status" className="text-sm text-muted-foreground">
              {t("managementCounts", data.counts)}
            </p>
            <p className="text-sm text-muted-foreground">{t("managementStructureHint")}</p>
          </header>
          <BuildingSelector
            buildings={data.buildings}
            value={p.buildingId}
            onChange={p.onBuildingChange}
          />
          {!data.buildings.length && (
            <SystemFeedback kind="empty" message={t("managementNoBuildings")} />
          )}
          {data.buildings
            .filter((b) => !p.buildingId || b.id === p.buildingId)
            .map((b) => (
              <section
                key={b.id}
                aria-label={`${t("building")} ${b.name}`}
                className="space-y-4 rounded-2xl border bg-card p-4"
              >
                <h3 className="font-bold">
                  {t("building")} <bdi>{b.name}</bdi>
                </h3>
                {!b.floors.length && (
                  <SystemFeedback kind="empty" message={t("managementNoFloors")} />
                )}
                {b.floors.map((f) => (
                  <section
                    key={f.id}
                    aria-label={`${t("floor")} ${f.number}`}
                    className="space-y-2"
                  >
                    <h4 className="text-sm font-medium">
                      {t("floor")} {f.number}
                    </h4>
                    {!f.apartments.length ? (
                      <p className="text-sm text-muted-foreground">{t("managementNoApartments")}</p>
                    ) : (
                      <ul
                        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                        aria-label={t("apartments")}
                      >
                        {f.apartments.map((a) => (
                          <li key={a.id} className="min-w-0 rounded-xl border bg-muted/30 p-3">
                            <span className="text-xs text-muted-foreground">{t("apartment")}</span>
                            <bdi className="block break-words font-semibold tabular-nums">
                              {a.number}
                            </bdi>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))}
              </section>
            ))}
        </div>
      )}
    </section>
  );
}
