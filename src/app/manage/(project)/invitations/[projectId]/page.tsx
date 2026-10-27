import { notFound } from "next/navigation";
import { z } from "zod";
import { requireCurrentUser } from "@/lib/auth/session";
import { LiveInvitations } from "@/features/invitations/LiveInvitations";
export const dynamic = "force-dynamic";
export default async function InvitationsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  await requireCurrentUser();
  const { projectId } = await params;
  if (!z.string().uuid().safeParse(projectId).success) notFound();
  return <LiveInvitations key={projectId} projectId={projectId} />;
}
