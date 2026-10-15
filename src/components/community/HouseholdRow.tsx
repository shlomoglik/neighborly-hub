import { FamilyAvatar } from "../FamilyAvatar";
import { Badge } from "../ui/badge";
import { ContactAction } from "./ContactAction";
export type HouseholdSummary = { id: string; familyName: string; building: string; apartment: string; phone?: string; phoneVisible?: boolean; isMine?: boolean; birthdayLabel?: string };
export function HouseholdRow({ household, selected = false, onSelect }: { household: HouseholdSummary; selected?: boolean; onSelect?: (id: string) => void }) {
 return <div className={`flex min-h-20 items-center gap-3 rounded-xl border p-3 ${selected ? "border-primary bg-primary/5" : "bg-card"}`}><FamilyAvatar name={household.familyName} size={48}/><button type="button" onClick={() => onSelect?.(household.id)} aria-pressed={selected} className="min-w-0 flex-1 text-start"><span className="block font-semibold">{household.familyName}</span><span className="text-sm text-muted-foreground">בניין {household.building} · דירה {household.apartment}</span><span className="mt-1 flex flex-wrap gap-1">{household.isMine && <Badge variant="secondary">הבית שלך</Badge>}{household.birthdayLabel && <Badge variant="outline">🎂 {household.birthdayLabel}</Badge>}</span></button><ContactAction kind="phone" value={household.phone} visible={household.phoneVisible ?? false}/></div>;
}
