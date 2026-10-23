import { PasswordForm } from "@/features/auth/PasswordForm";
import { getAuth } from "@/lib/auth/server";
import { headers } from "next/headers";
import { requireCurrentUser } from "@/lib/auth/session";
import { translate, DEFAULT_LANG, isLang, LANG_COOKIE } from "@/lib/i18n/dictionary";
import { cookies } from "next/headers";
import Link from "next/link";
import { SignOut } from "@/features/auth/SignOut";
export const dynamic = "force-dynamic";
export default async function AccountPage() {
  const user = await requireCurrentUser();
  const auth = await getAuth();
  const accounts = await auth?.api.listUserAccounts({ headers: await headers() });
  const hasPassword = accounts?.some((account) => account.providerId === "credential") ?? false;
  const cookie = (await cookies()).get(LANG_COOKIE)?.value;
  const lang = isLang(cookie) ? cookie : DEFAULT_LANG;
  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 py-8">
      <h1 className="text-2xl">{translate(lang, "authAccount")}</h1>
      <div className="space-y-3 rounded-2xl border bg-card p-6">
        <p>
          <bdi>{user.name}</bdi>
        </p>
        <p>
          <bdi dir="ltr">{user.email}</bdi>
        </p>
        <p className="text-sm text-muted-foreground">{translate(lang, "authAccessNotice")}</p>
        <Link
          href="/directory"
          className="inline-flex min-h-11 items-center text-primary underline"
        >
          {translate(lang, "openBook")}
        </Link>
        <Link
          href="/household"
          className="inline-flex min-h-11 items-center text-primary underline"
        >
          {translate(lang, "homeMine")}
        </Link>
        <PasswordForm mode={hasPassword ? "change" : "set"} />
        <SignOut />
      </div>
    </main>
  );
}
