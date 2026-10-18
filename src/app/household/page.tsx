import { requireCurrentUser } from "@/lib/auth/session";
import { MyHouseholds } from "@/features/households/MyHouseholds";
export const dynamic = "force-dynamic";
export default async function MyHouseholdPage() {
  await requireCurrentUser();
  return <MyHouseholds />;
}
