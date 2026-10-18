import { requireCurrentUser } from "@/lib/auth/session";
import { HouseholdDetails } from "@/features/households/HouseholdDetails";
export const dynamic = "force-dynamic";
export default async function HouseholdPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCurrentUser();
  const { id } = await params;
  return <HouseholdDetails id={id} />;
}
