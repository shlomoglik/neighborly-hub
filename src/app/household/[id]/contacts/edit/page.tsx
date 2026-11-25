import { HouseholdContactEditor } from "@/features/households/HouseholdContactEditor";

export default async function ContactEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HouseholdContactEditor id={id} />;
}
