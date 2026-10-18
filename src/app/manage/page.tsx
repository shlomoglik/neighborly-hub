import { LiveManagement } from "@/features/management/LiveManagement";
import { requireCurrentUser } from "@/lib/auth/session";
export const dynamic = "force-dynamic";
export default async function ManagePage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string | string[] }>;
}) {
  await requireCurrentUser();
  const { project } = await searchParams;
  return (
    <LiveManagement
      key={typeof project === "string" ? project : ""}
      projectId={typeof project === "string" ? project : project ? "invalid" : ""}
    />
  );
}
