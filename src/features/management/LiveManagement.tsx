"use client";
import { AppShell } from "@/components/AppShell";
import { ManagementWorkspace } from "./ManagementWorkspace";
import { useManagement } from "./use-management";
export function LiveManagement({ projectId }: { projectId: string }) {
  const workspace = useManagement(projectId);
  return (
    <AppShell>
      <ManagementWorkspace {...workspace} />
    </AppShell>
  );
}
