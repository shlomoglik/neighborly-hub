import { SignIn } from "@/features/auth/SignIn";
import { readAuthConfig } from "@/lib/auth/config";
export const dynamic = "force-dynamic";
export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <SignIn
      enabled={readAuthConfig(process.env) !== null}
      initialError={Boolean((await searchParams).error)}
    />
  );
}
