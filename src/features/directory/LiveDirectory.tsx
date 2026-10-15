"use client";
import { AppShell } from "@/components/AppShell";
import { ResidentDirectory } from "./ResidentDirectory";
import { useDirectory } from "./use-directory";
export function LiveDirectory() {
  const directory = useDirectory();
  return (
    <AppShell>
      <ResidentDirectory {...directory} />
    </AppShell>
  );
}
