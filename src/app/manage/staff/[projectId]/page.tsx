import { notFound } from "next/navigation";
import { z } from "zod";
import { requireCurrentUser } from "@/lib/auth/session";
import { canCreateProject } from "@/lib/access/project-setup";
import { LiveStaff } from "@/features/management/LiveStaff";
export const dynamic = "force-dynamic";
export default async function StaffPage({ params }: { params: Promise<{ projectId: string }> }) {
  const user = await requireCurrentUser();
  const { projectId } = await params;
  if (!z.string().uuid().safeParse(projectId).success) notFound();
  const { db } = await import("@/lib/db/client");
  if (!(await canCreateProject(db, user.id))) notFound();
  return <LiveStaff key={projectId} projectId={projectId} />;
}
