import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireCurrentUser } from "@/lib/auth/session";
import { HouseholdLayout } from "@/features/households/HouseholdLayout";
export default async function Layout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  await requireCurrentUser();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  return (
    <HouseholdLayout key={id} id={id}>
      {children}
    </HouseholdLayout>
  );
}
