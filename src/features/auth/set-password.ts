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
    // Better Auth additionally requires a fresh session and refuses to replace an existing password.
    await auth.api.setPassword({ headers: requestHeaders, body: { newPassword: password } });
    return true;
  } catch {
    return false;
  }
}
