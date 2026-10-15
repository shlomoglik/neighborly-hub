"use client";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { pluralText } from "@/lib/i18n/dictionary";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { StatusBadge, type ResidentStatus } from "../community/StatusBadge";

export type DirectoryEntry = {
  id: string;
  name: string;
  building: string;
  apartment: string;
  status?: ResidentStatus;
};
export type DirectoryFilterState = { query: string; building: string; status: string };
export type DirectoryFiltersProps = {
  entries: readonly DirectoryEntry[];
  value?: DirectoryFilterState;
  onChange?: (value: DirectoryFilterState) => void;
  onSelect?: (entry: DirectoryEntry) => void;
};
export function DirectoryFilters({ entries, value, onChange, onSelect }: DirectoryFiltersProps) {
  const { t, lang } = useI18n();
  const [local, setLocal] = useState<DirectoryFilterState>({ query: "", building: "", status: "" });
  const state = value ?? local;
  const change = (next: DirectoryFilterState) => {
    if (value === undefined) setLocal(next);
    onChange?.(next);
  };
  const buildings = useMemo(
    () =>
      [...new Set(entries.map((e) => e.building))].sort(
        new Intl.Collator(lang, { numeric: true }).compare,
      ),
    [entries, lang],
  );
  const filtered = entries
    .filter(
      (e) =>
        (!state.building || e.building === state.building) &&
        (!state.status || e.status === state.status) &&
        [e.name, e.building, e.apartment].some((v) =>
          v.toLocaleLowerCase(lang).includes(state.query.trim().toLocaleLowerCase(lang)),
        ),
    )
    .sort((a, b) => new Intl.Collator(lang).compare(a.name, b.name));
  return (
    <section className="space-y-4" aria-label={t("filterResidents")}>
      <div className="flex flex-wrap gap-2">
        <Input
          className="min-h-11 min-w-0 basis-48 flex-1"
          aria-label={t("search")}
          placeholder={t("search")}
          value={state.query}
          onChange={(e) => change({ ...state, query: e.target.value })}
        />
        <select
          aria-label={t("filterBuilding")}
          className="min-h-11 max-w-full rounded-md border bg-card px-3"
          value={state.building}
          onChange={(e) => change({ ...state, building: e.target.value })}
        >
          <option value="">{t("allBuildings")}</option>
          {buildings.map((b) => (
            <option key={b} value={b}>
              {t("building")} {b}
            </option>
          ))}
        </select>
        <select
          aria-label={t("ownershipQ")}
          className="min-h-11 max-w-full rounded-md border bg-card px-3"
          value={state.status}
          onChange={(e) => change({ ...state, status: e.target.value })}
        >
          <option value="">{t("ownershipQ")}</option>
          <option value="owner-resident">{t("owner_resident")}</option>
          <option value="tenant">{t("tenant")}</option>
          <option value="owner-absent">{t("owner_non_resident")}</option>
        </select>
        <Button
          variant="outline"
          onClick={() => change({ query: "", building: "", status: "" })}
          disabled={!state.query && !state.building && !state.status}
        >
          {t("clear")}
        </Button>
      </div>
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {pluralText(lang, "results", filtered.length)}
      </p>
      {filtered.length === 0 ? (
        <p role="status" className="rounded-xl border p-6 text-center">
          {t("noResults")}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3"
            >
              <div className="min-w-0">
                <p className="break-words font-medium">
                  <bdi>{e.name}</bdi>
                </p>
                <Badge variant="secondary">
                  {t("building")} <bdi dir="ltr">{e.building}</bdi> · {t("apartment")}{" "}
                  <bdi dir="ltr">{e.apartment}</bdi>
                </Badge>
                {e.status && <StatusBadge status={e.status} />}
              </div>
              <Button variant="outline" onClick={() => onSelect?.(e)}>
                {t("viewDetails")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
