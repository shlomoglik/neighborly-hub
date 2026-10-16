import { ProjectSetupWizard } from "@/features/management/ProjectSetupWizard";
import { requireCurrentUser } from "@/lib/auth/session";
import { canCreateProject } from "@/lib/access/project-setup";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export default async function ProjectSetupPage() {
  const user = await requireCurrentUser();
  const { db } = await import("@/lib/db/client");
  if (!(await canCreateProject(db, user.id))) notFound();
  return <ProjectSetupWizard />;
}
