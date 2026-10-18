import { requireCurrentUser } from "@/lib/auth/session";
import { LiveFamily } from "@/features/households/LiveFamily";
export const dynamic = "force-dynamic";
export default async function FamilyPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCurrentUser();
  const { id } = await params;
  return <LiveFamily id={id} />;
}
