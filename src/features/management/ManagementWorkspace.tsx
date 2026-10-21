"use client";
import Link from "next/link";
import { useRef, useEffect, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import {
  managementHref,
  type ManagementHierarchy,
  type ManagementProjects,
} from "@/lib/access/management-contracts";
import { invitationAdminHref } from "@/lib/access/invitation-contracts";
import { staffHref } from "@/lib/access/staff-contracts";
import type { StructureEditTarget } from "@/lib/access/structure-management-contracts";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { BuildingSelector } from "@/components/community/BuildingSelector";
import { RefreshButton } from "@/components/community/RefreshButton";
import { CommunitySkeleton } from "@/components/community/CommunityLoading";
import { SystemFeedback } from "@/components/community/SystemFeedback";
import type { ManagementStatus } from "./use-management";

export type ManagementWorkspaceProps = {
  status: ManagementStatus;
  discovery: ManagementProjects | null;
  data: ManagementHierarchy | null;
  selectedProjectId: string;
  buildingIds: string[];
  onBuildingChange: (ids: string[]) => void;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
  onEdit?: (target: StructureEditTarget) => void;
  editingBusy?: boolean;
  mode?: "view" | "edit";
  onModeChange?: (mode: "view" | "edit") => void;
  structure?: ReactNode;
};

/** Pure navigation and page presentation; the shared editor owns structure rendering. */
export function ManagementWorkspace(p: ManagementWorkspaceProps) {
  const { t } = useI18n();
  const { data, discovery, status } = p;
  const detail = !!p.selectedProjectId;
  const heading = useRef<HTMLHeadingElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (status !== "loading" && restoreFocus.current) {
      heading.current?.focus();
      restoreFocus.current = false;
    }
  }, [status]);
  const refresh = () => {
    restoreFocus.current = true;
    p.onRefresh();
  };
  return (
    <section className="min-w-0 space-y-5" aria-label={t("manage")}>
      {detail && (
        <Breadcrumb aria-label={t("managementBreadcrumb")}>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/manage">{t("manage")}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="rtl:rotate-180" />
            <BreadcrumbItem>
              <BreadcrumbPage>
                <bdi>{data?.name ?? t("project")}</bdi>
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      )}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold">
            <bdi>{data?.name ?? t("manage")}</bdi>
          </h1>
          {data && (
            <>
              <p className="text-muted-foreground">
                <bdi>{data.city}</bdi>
              </p>
              <p role="status" className="text-sm text-muted-foreground">
                {t("managementCounts", data.counts)}
              </p>
            </>
          )}
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-2">
          <RefreshButton
            onClick={refresh}
            disabled={status === "loading" || p.editingBusy}
            label={t("refreshManagement")}
          />
          {!detail && discovery?.canCreateProject && (
            <Button asChild>
              <Link href="/manage/setup">{t("newProject")}</Link>
            </Button>
          )}
          {data && (
            <>
              <Button variant="outline" asChild>
                <Link href={invitationAdminHref(data.id)}>{t("inviteManagement")}</Link>
              </Button>
              {discovery?.canCreateProject && (
                <Button variant="outline" asChild>
                  <Link href={staffHref(data.id)}>{t("staffManagement")}</Link>
                </Button>
              )}
            </>
          )}
        </div>
      </header>
      {!detail && discovery && (
        <nav aria-label={t("chooseProject")} className="space-y-4">
          <h2 className="font-semibold">{t("chooseProject")}</h2>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {discovery.projects.map((project) => (
              <li key={project.id}>
                <Link
                  href={managementHref(project.id)}
                  className="community-interactive block space-y-2 rounded-2xl border bg-card p-5 shadow-warm transition-colors hover:border-primary hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <span className="block text-lg font-semibold">
                    <bdi>{project.name}</bdi>
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    <bdi>{project.city}</bdi>
                  </span>
                  <span className="block text-sm font-medium text-primary">
                    {t("managementOpenProject")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {(discovery.hasNext || discovery.page > 1) && (
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
          )}
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
          {p.buildingIds.length > 0 && (
            <Button variant="outline" onClick={() => p.onBuildingChange([])}>
              {t("allBuildings")}
            </Button>
          )}
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
      {status === "ready" && data && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{t("editorTitle")}</h2>
            <div className="flex flex-wrap justify-end gap-2">
              {p.onModeChange && (
                <Button
                  variant={p.mode === "edit" ? "outline" : "default"}
                  disabled={p.editingBusy}
                  onClick={() => p.onModeChange?.(p.mode === "edit" ? "view" : "edit")}
                >
                  {t(p.mode === "edit" ? "managementViewStructure" : "managementEditStructure")}
                </Button>
              )}
              {p.mode === "edit" && p.onEdit && data.canAddBuilding && (
                <Button
                  variant="outline"
                  disabled={p.editingBusy}
                  onClick={() => p.onEdit?.({ mode: "create", entity: "building" })}
                >
                  {t("addBuilding")}
                </Button>
              )}
            </div>
          </div>
          {data.buildings.length > 1 && (
            <BuildingSelector
              buildings={data.buildings}
              multiple
              value={p.buildingIds}
              onChange={p.onBuildingChange}
              disabled={p.editingBusy}
            />
          )}
          {!data.buildings.length && (
            <SystemFeedback kind="empty" message={t("managementNoBuildings")} />
          )}
        </div>
      )}
      {(status === "ready" || status === "loading") && p.structure}
    </section>
  );
}
