"use client";
import { AppShell } from "@/components/AppShell";
import { StaffWorkspace } from "./StaffWorkspace";
import { useStaff } from "./use-staff";
import { useManagement } from "./use-management";
import { ManageProjectHeader } from "./ManageProjectHeader";
export function LiveStaff({ projectId }: { projectId: string }) {
  const staff = useStaff(projectId);
  const management = useManagement(projectId);
  return (
    <AppShell wide>
      <div className="space-y-6">
        {management.status === "ready" && management.data && (
          <ManageProjectHeader
            project={management.data}
            active="staff"
            canManageStaff
            showProjectsBack={(management.discovery?.projects.length ?? 0) > 1}
          />
        )}
        <StaffWorkspace projectId={projectId} {...staff} />
      </div>
    </AppShell>
  );
}
