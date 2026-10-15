import { requireCurrentUser } from "@/lib/auth/session";
import { LiveDirectory } from "@/features/directory/LiveDirectory";
export const dynamic = "force-dynamic";
export default async function DirectoryPage() {
  await requireCurrentUser();
  return <LiveDirectory />;
}
