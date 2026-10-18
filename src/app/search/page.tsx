import { requireCurrentUser } from "@/lib/auth/session";
import { GlobalSearch } from "@/features/search/GlobalSearch";
export const dynamic = "force-dynamic";
export default async function SearchPage() {
  await requireCurrentUser();
  return <GlobalSearch />;
}
