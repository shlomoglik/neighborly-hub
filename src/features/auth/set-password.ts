"use server";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth/server";
import { z } from "zod";

export async function setAccountPassword(password: string): Promise<boolean> {
  if (!z.string().min(12).max(128).safeParse(password).success) return false;
  try {
    const auth = await getAuth();
    if (!auth) return false;
    const requestHeaders = await headers();
    const session = await auth.api.getSession({ headers: requestHeaders });
    if (!session?.user.emailVerified) return false;
    const age = Date.now() - new Date(session.session.createdAt).getTime();
    if (!Number.isFinite(age) || age < 0 || age > 5 * 60 * 1000) return false;
    // Better Auth refuses to replace an existing password.
    await auth.api.setPassword({ headers: requestHeaders, body: { newPassword: password } });
    return true;
  } catch {
    return false;
  }
}
