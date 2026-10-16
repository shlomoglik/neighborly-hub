"use client";
import { AppShell } from "@/components/AppShell";
import { StaffWorkspace } from "./StaffWorkspace";
import { useStaff } from "./use-staff";
export function LiveStaff({ projectId }: { projectId: string }) {
  const staff = useStaff(projectId);
  return (
    <AppShell>
      <StaffWorkspace projectId={projectId} {...staff} />
    </AppShell>
  );
}
