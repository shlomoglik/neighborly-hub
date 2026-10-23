import { SignIn } from "@/features/auth/SignIn";
import { readAuthConfig } from "@/lib/auth/config";
export const dynamic = "force-dynamic";
export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const config = readAuthConfig(process.env);
  return (
    <SignIn
      enabled={config !== null}
      googleEnabled={Boolean(config?.googleClientId)}
      emailDeliveryEnabled={Boolean(config?.emailDelivery)}
      initialError={Boolean(params.error)}
      returnTo={params.next}
    />
  );
}
