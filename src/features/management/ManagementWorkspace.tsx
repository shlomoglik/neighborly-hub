"use client";
import Link from "next/link";
import { invitationAdminHref } from "@/lib/access/invitation-contracts";
import type { StructureEditTarget } from "@/lib/access/structure-management-contracts";
import { staffHref } from "@/lib/access/staff-contracts";
import { useEffect, useRef } from "react";
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
  onEdit?: (target: StructureEditTarget) => void;
  editingBusy?: boolean;
  onLayout?: (buildingId: string) => void;
};
/** Pure presentation; stories never mount the live request coordinator. */
export function ManagementWorkspace(p: ManagementWorkspaceProps) {
  const { t } = useI18n();
  const { discovery, data, status } = p;
  const heading = useRef<HTMLHeadingElement>(null);
  const buildingControls = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<"building" | "heading" | null>(null);
  useEffect(() => {
    if (status === "loading" || !restoreFocus.current) return;
    const target =
      restoreFocus.current === "building" && status === "ready"
        ? buildingControls.current?.querySelector<HTMLInputElement>("input:checked")
        : null;
    (target ?? heading.current)?.focus();
    restoreFocus.current = null;
  }, [status, data]);
  const refresh = () => {
    restoreFocus.current = "heading";
    p.onRefresh();
  };
  const changePage = (page: number) => {
    restoreFocus.current = "heading";
    p.onPageChange(page);
  };
  const changeBuilding = (id: string) => {
    restoreFocus.current = "building";
    p.onBuildingChange(id);
  };
  return (
    <section className="space-y-5" aria-label={t("manage")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold">
          {t("manage")}
        </h1>
        <Button
          variant="outline"
          onClick={refresh}
          disabled={status === "loading" || p.editingBusy}
        >
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
              onClick={() => changePage(discovery.page - 1)}
            >
              {t("directoryPrevious")}
            </Button>
            <span>{t("directoryPage", { n: discovery.page })}</span>
            <Button
              variant="outline"
              disabled={!discovery.hasNext}
              onClick={() => changePage(discovery.page + 1)}
            >
              {t("directoryNext")}
            </Button>
          </div>
        </nav>
      )}
      {status === "loading" && <CommunitySkeleton variant="map" />}
      {status === "error" && <SystemFeedback kind="error" onRetry={refresh} />}
      {status === "empty" && <SystemFeedback kind="empty" message={t("managementEmpty")} />}
      {status === "forbidden" && (
        <SystemFeedback kind="private" message={t("managementForbidden")} onRetry={refresh} />
      )}
      {status === "unavailable" && (
        <div className="space-y-3">
          <SystemFeedback kind="private" message={t("managementUnavailable")} onRetry={refresh} />
          <Button variant="outline" onClick={() => changeBuilding("")}>
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
            <Button variant="outline" asChild>
              <Link href={invitationAdminHref(data.id)}>{t("inviteManagement")}</Link>
            </Button>
            {discovery?.canCreateProject && (
              <Button variant="outline" asChild>
                <Link href={staffHref(data.id)}>{t("staffManagement")}</Link>
              </Button>
            )}
          </header>
          {p.onEdit && data.canAddBuilding && (
            <Button
              disabled={p.editingBusy}
              onClick={() => p.onEdit?.({ mode: "create", entity: "building" })}
            >
              {t("addBuilding")}
            </Button>
          )}
          <div ref={buildingControls}>
            <BuildingSelector
              buildings={data.buildings}
              value={p.buildingId}
              onChange={changeBuilding}
            />
          </div>
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
                {b.address && (
                  <p className="text-sm text-muted-foreground">
                    <bdi>{b.address}</bdi>
                  </p>
                )}
                {p.onEdit && (
                  <div className="flex flex-wrap gap-2">
                    {p.onLayout && (
                      <Button
                        variant="outline"
                        disabled={p.editingBusy}
                        onClick={() => p.onLayout?.(b.id)}
                      >
                        {t("layoutEdit")}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      disabled={p.editingBusy}
                      onClick={() =>
                        p.onEdit?.({
                          mode: "update",
                          entity: "building",
                          id: b.id,
                          expected: b.name,
                          address: b.address,
                        })
                      }
                    >
                      {t("structureRenameBuilding")}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={p.editingBusy}
                      onClick={() =>
                        p.onEdit?.({ mode: "create", entity: "floor", buildingId: b.id })
                      }
                    >
                      {t("structureAddFloor")}
                    </Button>
                  </div>
                )}
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
                    {p.onEdit && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="ghost"
                          disabled={p.editingBusy}
                          aria-label={t("structureEditFloorLabel", {
                            n: f.number,
                            building: b.name,
                          })}
                          onClick={() =>
                            p.onEdit?.({
                              mode: "update",
                              entity: "floor",
                              id: f.id,
                              expected: f.number,
                            })
                          }
                        >
                          {t("structureEditFloor")}
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={p.editingBusy}
                          aria-label={t("structureAddApartmentLabel", {
                            n: f.number,
                            building: b.name,
                          })}
                          onClick={() =>
                            p.onEdit?.({ mode: "create", entity: "apartment", floorId: f.id })
                          }
                        >
                          {t("structureAddApartment")}
                        </Button>
                      </div>
                    )}
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
                            {p.onEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={p.editingBusy}
                                aria-label={t("structureEditApartmentLabel", {
                                  n: a.number,
                                  building: b.name,
                                })}
                                onClick={() =>
                                  p.onEdit?.({
                                    mode: "update",
                                    entity: "apartment",
                                    id: a.id,
                                    expected: a.number,
                                  })
                                }
                              >
                                {t("structureEdit")}
                              </Button>
                            )}
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
