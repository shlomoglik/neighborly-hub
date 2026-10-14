import { HouseholdDetails } from "@/features/households/HouseholdDetails";
export default async function HouseholdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <HouseholdDetails id={id}/>;
}
