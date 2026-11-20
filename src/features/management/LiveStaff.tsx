"use client";
import { StaffWorkspace } from "./StaffWorkspace";
import { useStaff } from "./use-staff";
export function LiveStaff({ projectId }: { projectId: string }) {
  const staff = useStaff(projectId);
  return <StaffWorkspace projectId={projectId} {...staff} />;
}
