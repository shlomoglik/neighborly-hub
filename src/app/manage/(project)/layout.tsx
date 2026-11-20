import type { ReactNode } from "react";
import { ProjectManagementLayout } from "@/features/management/ProjectManagementLayout";

export default function Layout({ children }: { children: ReactNode }) {
  return <ProjectManagementLayout>{children}</ProjectManagementLayout>;
}
