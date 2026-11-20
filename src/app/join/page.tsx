import { redirect } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth/session";
export const dynamic = "force-dynamic";
export default async function JoinPage() {
  await requireCurrentUser();
  redirect("/account#join-requests");
}
