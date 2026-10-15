import { redirect } from "next/navigation";
// Only Google sign-in is enabled. Password management belongs to the identity provider.
export default function ResetPasswordPage() {
  redirect("/auth");
}
