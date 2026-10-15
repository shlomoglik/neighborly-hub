"use client";
import { useMemo, useState } from "react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

export type DirectoryEntry = { id: string; name: string; building: string; apartment: string };
export type DirectoryFiltersProps = {
  entries: readonly DirectoryEntry[];
  onSelect?: (entry: DirectoryEntry) => void;
};
export function DirectoryFilters({ entries, onSelect }: DirectoryFiltersProps) {
  const [query, setQuery] = useState("");
  const [building, setBuilding] = useState("");
  const buildings = useMemo(() => [...new Set(entries.map((entry) => entry.building))].sort(), [entries]);
  const filtered = useMemo(() => entries.filter((entry) =>
    (!building || entry.building === building) &&
    [entry.name, entry.building, entry.apartment].some((value) => value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  ), [entries, building, query]);
  return <section className="space-y-4" aria-label="סינון דיירים">
    <div className="flex flex-wrap gap-2">
      <Input className="min-w-48 flex-1" aria-label="חיפוש דיירים" placeholder="חיפוש לפי שם, בניין או דירה" value={query} onChange={(event) => setQuery(event.target.value)} />
      <select aria-label="סינון לפי בניין" className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={building} onChange={(event) => setBuilding(event.target.value)}>
        <option value="">כל הבניינים</option>{buildings.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <Button variant="outline" onClick={() => { setQuery(""); setBuilding(""); }} disabled={!query && !building}>ניקוי</Button>
    </div>
    <p aria-live="polite" className="text-sm text-muted-foreground">{filtered.length} תוצאות</p>
    {filtered.length === 0 ? <p role="status" className="rounded-lg border p-6 text-center">לא נמצאו דיירים מתאימים</p> :
      <ul className="space-y-2">{filtered.map((entry) => <li key={entry.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
        <div><p className="font-medium">{entry.name}</p><Badge variant="secondary">בניין {entry.building} · דירה {entry.apartment}</Badge></div>
        <Button variant="outline" size="sm" onClick={() => onSelect?.(entry)}>בחירה</Button>
      </li>)}</ul>}
  </section>;
}
