import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./server";
export type CurrentUser = { id: string; email: string; name: string };
/** Always verifies the signed cookie and current database session through the auth library. */
export async function getCurrentUser(requestHeaders: Headers): Promise<CurrentUser | null> {
  const auth = await getAuth();
  if (!auth) return null;
  const result = await auth.api.getSession({ headers: requestHeaders });
  if (!result) return null;
  return { id: result.user.id, email: result.user.email, name: result.user.name };
}
export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser(await headers());
  if (!user) redirect("/auth");
  return user;
}
