"use client";
import { usePathname } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { ManageProjectHeader, type ManageProjectTab } from "./ManageProjectHeader";
import { useManagement } from "./use-management";
import {
  PendingInvitationCountContext,
  ProjectManagementContext,
} from "./ProjectManagementContext";

export function ProjectManagementLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [, , section, projectId = ""] = pathname.split("/");
  const active: ManageProjectTab =
    section === "staff" ? "staff" : section === "invitations" ? "invitations" : "structure";
  const workspace = useManagement(projectId);
  const [pending, setPending] = useState<{ projectId: string; count: number } | null>(null);
  const onPendingCount = useCallback(
    (count: number) => setPending({ projectId, count }),
    [projectId],
  );
  return (
    <AppShell wide>
      <ProjectManagementContext.Provider value={workspace}>
        <PendingInvitationCountContext.Provider value={onPendingCount}>
          <div className="min-w-0 space-y-6">
            {workspace.data && (
              <ManageProjectHeader
                project={workspace.data}
                active={active}
                canManageStaff={!!workspace.discovery?.canCreateProject}
                pendingCount={pending?.projectId === projectId ? pending.count : undefined}
              />
            )}
            <div className="min-w-0">{children}</div>
          </div>
        </PendingInvitationCountContext.Provider>
      </ProjectManagementContext.Provider>
    </AppShell>
  );
}
