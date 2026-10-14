"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FamilyAvatar } from "@/components/FamilyAvatar";

const households = [
  { id: "1", name: "משפחת כהן", building: "בניין 1", apartment: 12, floor: 3 },
  { id: "2", name: "משפחת לוי", building: "בניין 1", apartment: 8, floor: 2 },
  { id: "3", name: "משפחת מזרחי", building: "בניין 2", apartment: 21, floor: 5 },
];

export function DirectoryPreview() {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => households.filter((h) =>
    [h.name, h.building, String(h.apartment)].some((value) => value.includes(query.trim()))
  ), [query]);

  return (
    <main className="mx-auto min-h-screen max-w-2xl space-y-4 bg-background p-5 text-foreground">
      <h1 className="text-2xl font-bold">ספר השכנים</h1>
      <div className="relative">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="h-11 rounded-xl bg-card ps-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש משפחה או דירה" />
      </div>
      <ul className="space-y-2.5">
        {filtered.map((h) => <li key={h.id} className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-warm">
          <FamilyAvatar name={h.name} />
          <div><div className="font-semibold">{h.name}</div><div className="text-xs text-muted-foreground">{h.building} · דירה {h.apartment} · קומה {h.floor}</div></div>
        </li>)}
      </ul>
      {filtered.length === 0 && <p className="text-muted-foreground">לא נמצאו תוצאות</p>}
      <p className="text-xs text-muted-foreground">תצוגת פיתוח עם נתוני דוגמה בלבד</p>
    </main>
  );
}
