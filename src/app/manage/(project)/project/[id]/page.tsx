import { notFound } from "next/navigation";
import { z } from "zod";
import { requireCurrentUser } from "@/lib/auth/session";
import { LiveManagement } from "@/features/management/LiveManagement";

export const dynamic = "force-dynamic";

export default async function ManagementProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCurrentUser();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  return <LiveManagement key={id} projectId={id} />;
}
