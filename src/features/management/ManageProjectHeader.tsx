"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { managementHref, type ManagementHierarchy } from "@/lib/access/management-contracts";
import { invitationAdminHref } from "@/lib/access/invitation-contracts";
import { staffHref } from "@/lib/access/staff-contracts";

export type ManageProjectTab = "structure" | "staff" | "invitations";

export function ManageProjectHeader({
  project,
  active,
  canManageStaff,
  pendingCount,
  showProjectsBack = false,
}: {
  project: Pick<ManagementHierarchy, "id" | "name" | "city" | "counts">;
  active: ManageProjectTab;
  canManageStaff: boolean;
  pendingCount?: number;
  showProjectsBack?: boolean;
}) {
  const { t } = useI18n();
  const tabs = [
    { id: "structure" as const, href: managementHref(project.id), label: t("editorTitle") },
    ...(canManageStaff
      ? [{ id: "staff" as const, href: staffHref(project.id), label: t("staffManagement") }]
      : []),
    {
      id: "invitations" as const,
      href: invitationAdminHref(project.id),
      label: t("managementInvitationsTab"),
    },
  ];
  return (
    <div className="min-w-0 space-y-3">
      {showProjectsBack && (
        <Link
          href="/manage"
          className="inline-flex text-sm text-muted-foreground hover:text-foreground"
        >
          {t("projectsBreadcrumb")} <span aria-hidden>›</span>
        </Link>
      )}
      <header className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 tabIndex={-1} className="font-heading text-2xl font-normal sm:text-3xl">
            <bdi>{project.name}</bdi>
          </h1>
          <p role="status" className="text-sm text-muted-foreground">
            {project.city && (
              <>
                <bdi>{project.city}</bdi> ·{" "}
              </>
            )}
            {t("managementCountsCompact", project.counts)}
          </p>
        </div>
      </header>
      <nav
        aria-label={t("managementSections")}
        className="max-w-full snap-x snap-mandatory overflow-x-auto border-b border-border/60"
      >
        <div className="flex w-max min-w-full gap-5">
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              aria-current={active === tab.id ? "page" : undefined}
              className={`relative flex min-h-11 shrink-0 snap-start items-center gap-2 whitespace-nowrap px-1 text-sm font-medium ${active === tab.id ? "text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              {tab.label}
              {tab.id === "invitations" && !!pendingCount && (
                <span className="min-w-5 rounded-full bg-warning/25 px-1.5 py-0.5 text-center text-xs tabular-nums text-foreground">
                  {pendingCount}
                </span>
              )}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
