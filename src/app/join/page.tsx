import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { MyJoinRequests } from "@/features/invitations/LiveJoin";
export const dynamic = "force-dynamic";
export default async function JoinPage() {
  if (!(await getCurrentUser(await headers()))) redirect("/auth?next=%2Fjoin");
  return <MyJoinRequests />;
}
