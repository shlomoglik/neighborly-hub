"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Cake, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FamilyAvatar } from "@/components/FamilyAvatar";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { households, buildings } from "@/lib/mock-data";

export function DirectoryPreview() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [building, setBuilding] = useState("all");
  const filtered = useMemo(
    () =>
      households.filter(
        (h) =>
          (building === "all" || h.building === building) &&
          [h.name, h.building, String(h.apartment), ...h.contacts.map((c) => c.name)].some(
            (value) => value.toLowerCase().includes(query.trim().toLowerCase()),
          ),
      ),
    [query, building],
  );
  return (
    <AppShell>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{t("appName")}</h1>
        <section className="rounded-3xl bg-hero p-4 shadow-warm">
          <h2 className="mb-3 flex items-center gap-2 font-bold">
            <Cake className="h-5 w-5 text-primary" />
            {t("birthdays")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("noBirthdays")}</p>
        </section>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-11 rounded-xl bg-card ps-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search")}
            />
          </div>
          <select
            aria-label={t("building")}
            className="h-11 w-36 rounded-xl border border-input bg-card px-2"
            value={building}
            onChange={(e) => setBuilding(e.target.value)}
          >
            <option value="all">{t("allBuildings")}</option>
            {buildings.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <ul className="space-y-2.5">
          {filtered.map((h) => (
            <li key={h.id}>
              <Link
                href={`/household/${h.id}`}
                className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-warm"
              >
                <FamilyAvatar name={h.name} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{h.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {h.building} · {t("apartment")} {h.apartment} · {t("floor")} {h.floor}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        {filtered.length === 0 && <p className="text-muted-foreground">{t("noResults")}</p>}
        <p className="text-xs text-muted-foreground">{t("loading")} — Demo / Mock Data</p>
      </div>
    </AppShell>
  );
}
