"use client";
export type ApartmentState = "occupied" | "pending" | "vacant" | "absent-owner";
export type ApartmentTileModel = { id: string; number: string; floor: number; label?: string; status: ApartmentState };
const statusText: Record<ApartmentState, string> = { occupied: "מאוכלסת", pending: "ממתינה לאישור", vacant: "פנויה", "absent-owner": "בעלים לא מתגוררים" };
export function ApartmentMap({ apartments, selectedId, onSelect }: { apartments: readonly ApartmentTileModel[]; selectedId?: string; onSelect?: (id: string) => void }) {
 const floors = [...new Set(apartments.map(a => a.floor))].sort((a,b) => b-a);
 return <div className="space-y-4">{floors.map(floor => <section key={floor} aria-label={`קומה ${floor}`} className="grid grid-cols-[5rem_1fr] items-start gap-3"><h3 className="pt-3 text-sm text-muted-foreground">קומה {floor}</h3><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{apartments.filter(a => a.floor === floor).map(a => <button key={a.id} type="button" aria-pressed={selectedId === a.id} onClick={() => onSelect?.(a.id)} className={`min-h-20 rounded-xl border p-2 text-start focus-visible:outline-2 focus-visible:outline-primary ${selectedId === a.id ? "border-primary bg-primary/10" : a.status === "pending" ? "border-warning bg-warning/10" : "border-border bg-card"}`}><span className="block font-semibold tabular-nums">{a.number}</span><span className="block truncate text-xs">{a.label || statusText[a.status]}</span><span className="block text-xs text-muted-foreground">{statusText[a.status]}</span></button>)}</div></section>)}</div>;
}
