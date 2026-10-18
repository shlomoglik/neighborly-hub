import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { tokenSchema } from "@/lib/access/invitation-contracts";
import { LiveJoin } from "@/features/invitations/LiveJoin";
export const dynamic = "force-dynamic";
export default async function JoinInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!tokenSchema.safeParse(token).success) notFound();
  if (!(await getCurrentUser(await headers())))
    redirect(`/auth?next=${encodeURIComponent(`/join/${token}`)}`);
  return <LiveJoin key={token} token={token} />;
}
