"use server";

import { headers } from "next/headers";
import { getAuth } from "@/lib/auth/server";

/** Next server actions enforce same-origin POSTs. Adding a password requires recent authentication. */
export async function setAccountPassword(newPassword: string): Promise<boolean> {
  if (typeof newPassword !== "string" || newPassword.length < 12 || newPassword.length > 128)
    return false;
  try {
    const auth = await getAuth();
    if (!auth) return false;
    const requestHeaders = await headers();
    const session = await auth.api.getSession({ headers: requestHeaders });
    if (!session?.user.emailVerified) return false;
    const age = Date.now() - new Date(session.session.createdAt).getTime();
    if (!Number.isFinite(age) || age < 0 || age > 5 * 60 * 1000) return false;
    await auth.api.setPassword({ body: { newPassword }, headers: requestHeaders });
    return true;
  } catch {
    return false;
  }
}
