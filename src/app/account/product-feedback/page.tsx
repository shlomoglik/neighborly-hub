import { requireCurrentUser } from "@/lib/auth/session";
import { ProductFeedback } from "@/features/product-feedback/ProductFeedback";
export const dynamic = "force-dynamic";
export default async function ProductFeedbackPage() {
  await requireCurrentUser();
  return <ProductFeedback />;
}
