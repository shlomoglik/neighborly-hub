import { LiveManagement } from "@/features/management/LiveManagement";
import { requireCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { managementHref } from "@/lib/access/management-contracts";
export const dynamic = "force-dynamic";
export default async function ManagePage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string | string[] }>;
}) {
  await requireCurrentUser();
  const { project } = await searchParams;
  if (typeof project === "string") redirect(managementHref(project));
  if (project) redirect("/manage");
  return <LiveManagement projectId="" />;
}
