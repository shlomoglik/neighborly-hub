import Link from "next/link";
import { PasswordForm } from "@/features/auth/PasswordForm";
import { readAuthConfig } from "@/lib/auth/config";
import { translate, DEFAULT_LANG, isLang, LANG_COOKIE } from "@/lib/i18n/dictionary";
import { cookies } from "next/headers";
export const dynamic = "force-dynamic";
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  const cookie = (await cookies()).get(LANG_COOKIE)?.value;
  const lang = isLang(cookie) ? cookie : DEFAULT_LANG;
  const enabled = Boolean(readAuthConfig(process.env)?.mail);
  return (
    <main className="mx-auto max-w-md space-y-4 px-4 py-8">
      {enabled && token && !error ? (
        <PasswordForm mode="reset" token={token} />
      ) : (
        <p role="alert">{translate(lang, "authResetInvalid")}</p>
      )}
      <Link href="/auth" className="text-primary underline">
        {translate(lang, "signIn")}
      </Link>
    </main>
  );
}
