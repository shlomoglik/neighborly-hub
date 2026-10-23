import { ResetPassword } from "@/features/auth/ResetPassword";
export const dynamic = "force-dynamic";
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const params = await searchParams;
  return <ResetPassword token={params.error ? undefined : params.token} />;
}
