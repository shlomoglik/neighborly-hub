"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { useHouseholdWorkspace } from "./use-household-workspace";
import { HouseholdNavigationContext } from "./HouseholdNavigationContext";
import { HouseholdHeader } from "./HouseholdHeader";
export function HouseholdLayout({ id, children }: { id: string; children: ReactNode }) {
  const workspace = useHouseholdWorkspace(id);
  const family = usePathname().endsWith("/members");
  return (
    <AppShell>
      <HouseholdNavigationContext.Provider value={workspace}>
        <div className="min-w-0 space-y-6">
          {workspace.resource.data && (
            <HouseholdHeader household={workspace.resource.data} family={family} />
          )}
          <div className="min-w-0">{children}</div>
        </div>
      </HouseholdNavigationContext.Provider>
    </AppShell>
  );
}
