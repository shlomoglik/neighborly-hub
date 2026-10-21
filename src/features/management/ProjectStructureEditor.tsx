"use client";
import { useEffect, useMemo, useState } from "react";
import { Building2, ChevronDown, ChevronUp, GripVertical, Link2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import {
  copyFloor,
  copyBuildingLayout,
  duplicateFloors,
  moveUnit,
  newBuilding,
  newFloor,
  nextUnit,
  unitTypes,
  validateDraft,
  type DraftBuilding,
  type DraftFloor,
  type UnitType,
} from "./project-structure-draft";

const typeStyle = {
  residential: "bg-primary/10 text-primary",
  commercial: "bg-amber-100 text-amber-900",
  parking: "bg-stone-200 text-stone-700",
};
function InlineName({
  value,
  label,
  onChange,
  placeholder,
}: {
  value: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (!editing)
    return (
      <button
        type="button"
        className="min-w-0 truncate rounded px-1 text-start font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={label}
        onClick={() => {
          setDraft(value || placeholder || "");
          setEditing(true);
        }}
      >
        <bdi>{value || placeholder || label}</bdi>
      </button>
    );
  return (
    <Input
      autoFocus
      aria-label={label}
      value={draft}
      maxLength={200}
      className="w-32 min-w-0"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        onChange(draft);
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          onChange(draft);
          setEditing(false);
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setEditing(false);
        }
      }}
    />
  );
}
function TypeSelect({
  value,
  label,
  onChange,
}: {
  value: UnitType;
  label: string;
  onChange: (type: UnitType) => void;
}) {
  const { t } = useI18n();
  return (
    <select
      aria-label={label}
      className={`max-w-36 rounded-full border-0 px-2 py-1 text-xs ${typeStyle[value]}`}
      value={value}
      onChange={(e) => onChange(e.target.value as UnitType)}
    >
      {unitTypes.map((type) => (
        <option key={type} value={type}>
          {t(type)}
        </option>
      ))}
    </select>
  );
}
export type ProjectStructureEditorProps = {
  buildings: DraftBuilding[];
  onChange: (buildings: DraftBuilding[]) => void;
  projectName: string;
  typesOnly?: boolean;
  managed?: boolean;
};
export function ProjectStructureEditor({
  buildings,
  onChange,
  projectName,
  typesOnly = false,
  managed = false,
}: ProjectStructureEditorProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<UnitType | "all">("all");
  const [comparison, setComparison] = useState(false);
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [selected, setSelected] = useState(buildings[0]?.id);
  const [drag, setDrag] = useState<{ building: string; unit: string } | null>(null);
  const [move, setMove] = useState<string | null>(null);
  const [bulk, setBulk] = useState<{ building: string; floor: string } | null>(null);
  const [copies, setCopies] = useState(1);
  const [targets, setTargets] = useState<string[]>([]);
  const update = (id: string, fn: (b: DraftBuilding) => DraftBuilding) =>
    onChange(buildings.map((b) => (b.id === id ? fn(b) : b)));
  const floorUpdate = (bid: string, fid: string, fn: (f: DraftFloor) => DraftFloor) =>
    update(bid, (b) => ({ ...b, floors: b.floors.map((f) => (f.id === fid ? fn(f) : f)) }));
  const count = buildings.reduce(
    (n, b) => n + b.floors.reduce((n, f) => n + f.apartments.length, 0),
    0,
  );
  const levels = Array.from(new Set(buildings.flatMap((b) => b.floors.map((f) => f.number)))).sort(
    (a, b) => b - a,
  );
  const section = buildings.find((b) => b.id === selected) ?? buildings[0];
  const validation = useMemo(() => validateDraft(buildings), [buildings]);
  const valid = validation.success;
  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || validation.success) return;
    console.warn(
      "[ProjectStructureEditor] Invalid layout (field indexes are zero-based):",
      validation.error.issues.map((issue) => ({
        field: issue.path.join("."),
        code: issue.code,
        message: issue.message,
      })),
    );
  }, [validation]);
  const bulkBuilding = buildings.find((b) => b.id === bulk?.building);
  const bulkFloor = bulkBuilding?.floors.find((f) => f.id === bulk?.floor);
  const normalized = search.trim().normalize("NFKC").toLocaleLowerCase();
  const matches = (value: string) =>
    value.normalize("NFKC").toLocaleLowerCase().includes(normalized);
  const visible = buildings.filter(
    (b) =>
      matches(b.name) ||
      b.floors.some(
        (f) =>
          matches(f.name) ||
          matches(String(f.number)) ||
          f.apartments.some((u) => matches(u.number)),
      ),
  );
  return (
    <div className="min-w-0 space-y-4">
      <p className="text-sm text-muted-foreground">{t("editorHint")}</p>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted/50 p-3">
        <Input
          aria-label={t("editorSearch")}
          placeholder={t("editorSearch")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-40 flex-1"
        />
        <div className="flex flex-wrap gap-1" role="group" aria-label={t("editorType")}>
          {(["all", ...unitTypes] as const).map((type) => (
            <Button
              key={type}
              size="sm"
              variant={filter === type ? "default" : "ghost"}
              aria-pressed={filter === type}
              onClick={() => setFilter(type)}
            >
              {t(type === "all" ? "editorAll" : type)}
            </Button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setCollapsed(
              collapsed.length
                ? []
                : buildings.flatMap((b) => [b.id, ...b.floors.map((f) => f.id)]),
            )
          }
        >
          {t(collapsed.length ? "editorExpand" : "editorCollapse")}
        </Button>
        <div className="flex gap-1" role="group" aria-label={t("editorCompare")}>
          <Button
            variant={!comparison ? "default" : "outline"}
            size="sm"
            aria-pressed={!comparison}
            onClick={() => setComparison(false)}
          >
            {t("editorTree")}
          </Button>
          <Button
            variant={comparison ? "default" : "outline"}
            size="sm"
            aria-pressed={comparison}
            onClick={() => setComparison(true)}
          >
            {t("editorCompare")}
          </Button>
        </div>
        {!typesOnly && !managed && (
          <Button
            size="sm"
            disabled={managed || buildings.length >= 100}
            onClick={() => onChange([...buildings, newBuilding()])}
          >
            <Plus aria-hidden className="size-4" />
            {t("addBuilding")}
          </Button>
        )}
      </div>
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="min-w-0 space-y-4">
          {comparison ? (
            <div className="max-w-full overflow-x-auto rounded-2xl border bg-card">
              <table className="w-full border-collapse text-sm">
                <caption className="p-3 text-start font-semibold">{t("editorCompare")}</caption>
                <thead>
                  <tr>
                    <th className="border p-3">{t("editorLevel")}</th>
                    {visible.map((b) => (
                      <th key={b.id} className="min-w-40 border p-3">
                        <bdi>{b.name}</bdi>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {levels.map((level) => (
                    <tr key={level}>
                      <th className="border p-3" dir="ltr">
                        {level}
                      </th>
                      {visible.map((b) => {
                        const f = b.floors.find((f) => f.number === level);
                        return (
                          <td key={b.id} className="border p-3">
                            {f ? (
                              <>
                                <bdi>{f.name || `${t("floor")} ${f.number}`}</bdi>
                                <p className="text-muted-foreground">
                                  {t(f.type)} ·{" "}
                                  {t("editorCount", {
                                    n: f.apartments.filter(
                                      (u) => filter === "all" || u.type === filter,
                                    ).length,
                                  })}
                                </p>
                              </>
                            ) : (
                              "—"
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            visible.map((b) => (
              <article
                key={b.id}
                className="min-w-0 overflow-hidden rounded-3xl border bg-card shadow-warm"
              >
                <header className="flex flex-wrap items-center gap-2 border-b p-4">
                  <button
                    type="button"
                    aria-label={`${t("editorCollapse")} ${t("building")} ${b.name}`}
                    aria-expanded={!collapsed.includes(b.id)}
                    onClick={() =>
                      setCollapsed((v) =>
                        v.includes(b.id) ? v.filter((id) => id !== b.id) : [...v, b.id],
                      )
                    }
                    className="rounded-lg p-2 hover:bg-muted"
                  >
                    <Building2 className="size-5 text-primary" />
                  </button>
                  <InlineName
                    label={t("building")}
                    value={b.name}
                    onChange={(name) => update(b.id, (b) => ({ ...b, name }))}
                  />
                  <span className="text-xs text-muted-foreground">
                    {b.floors.length} {t("floors")} ·{" "}
                    {t("editorCount", { n: b.floors.reduce((n, f) => n + f.apartments.length, 0) })}
                  </span>
                  {!typesOnly && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ms-auto"
                      aria-label={`${t("remove")} ${t("building")} ${b.name}`}
                      disabled={
                        managed ||
                        buildings.length === 1 ||
                        b.floors.some((f) => f.apartments.some((u) => u.linked))
                      }
                      onClick={() => {
                        if (window.confirm(t("editorDelete")))
                          onChange(buildings.filter((x) => x.id !== b.id));
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </header>
                {!collapsed.includes(b.id) && (
                  <div className="space-y-2 p-3">
                    {!typesOnly && (
                      <label className="flex flex-wrap items-center gap-2 text-sm">
                        <span>{t("buildingAddress")}</span>
                        <Input
                          className="min-w-40 flex-1"
                          value={b.address}
                          maxLength={500}
                          autoComplete="street-address"
                          onChange={(e) => update(b.id, (b) => ({ ...b, address: e.target.value }))}
                        />
                      </label>
                    )}
                    {!typesOnly && !managed && buildings.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (window.confirm(t("editorCopyHint")))
                            onChange(
                              buildings.map((target) =>
                                target.id === b.id ? target : copyBuildingLayout(b, target),
                              ),
                            );
                        }}
                      >
                        {t("layoutCopyAll")}
                      </Button>
                    )}
                    {[...b.floors]
                      .sort((a, b) => b.number - a.number)
                      .filter(
                        (f) =>
                          (matches(b.name) ||
                            matches(f.name) ||
                            matches(String(f.number)) ||
                            f.apartments.some((u) => matches(u.number))) &&
                          (filter === "all" ||
                            f.type === filter ||
                            f.apartments.some((u) => u.type === filter)),
                      )
                      .map((f) => (
                        <section
                          key={f.id}
                          className={`min-w-0 space-y-2 rounded-2xl border bg-background/60 p-3 ${drag?.building === b.id ? "border-dashed border-primary" : "border-border/70"}`}
                          onDragOver={(e) => {
                            if (drag?.building === b.id) e.preventDefault();
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (drag?.building === b.id)
                              update(b.id, (b) => moveUnit(b, drag.unit, f.id));
                            setDrag(null);
                          }}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              className="rounded p-1 hover:bg-muted"
                              aria-label={`${t("floor")} ${f.number}`}
                              aria-expanded={!collapsed.includes(f.id)}
                              onClick={() =>
                                setCollapsed((v) =>
                                  v.includes(f.id) ? v.filter((id) => id !== f.id) : [...v, f.id],
                                )
                              }
                            >
                              <ChevronDown
                                className={`size-4 ${collapsed.includes(f.id) ? "-rotate-90" : ""}`}
                              />
                            </button>
                            <Input
                              type="number"
                              aria-label={`${t("editorLevel")} ${b.name} ${f.number}`}
                              className="h-8 w-20"
                              min={-1000}
                              max={1000}
                              value={f.number}
                              disabled={typesOnly}
                              onChange={(e) =>
                                floorUpdate(b.id, f.id, (f) => ({
                                  ...f,
                                  number: Number(e.target.value),
                                }))
                              }
                            />
                            <InlineName
                              label={`${t("editorFloorName")} ${b.name} ${f.number}`}
                              placeholder={`${t("floor")} ${f.number}`}
                              value={f.name}
                              onChange={(name) => floorUpdate(b.id, f.id, (f) => ({ ...f, name }))}
                            />
                            <TypeSelect
                              label={`${t("editorType")} ${b.name} ${f.number}`}
                              value={f.type}
                              onChange={(type) => floorUpdate(b.id, f.id, (f) => ({ ...f, type }))}
                            />
                            <span className="text-xs text-muted-foreground">
                              {t("editorCount", { n: f.apartments.length })}
                            </span>
                            {!typesOnly && (
                              <div className="ms-auto flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setBulk({ building: b.id, floor: f.id });
                                    setCopies(1);
                                    setTargets([]);
                                  }}
                                >
                                  {t("editorDuplicate")}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`${t("remove")} ${t("floor")} ${f.number}`}
                                  disabled={
                                    b.floors.length === 1 || f.apartments.some((u) => u.linked)
                                  }
                                  onClick={() => {
                                    if (window.confirm(t("editorDelete")))
                                      update(b.id, (b) => ({
                                        ...b,
                                        floors: b.floors.filter((x) => x.id !== f.id),
                                      }));
                                  }}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                          {!collapsed.includes(f.id) && (
                            <>
                              {!f.apartments.length && (
                                <p
                                  className={`rounded-xl border border-dashed p-4 text-sm ${typeStyle[f.type]}`}
                                >
                                  {t("editorEmpty")}
                                </p>
                              )}
                              <div className="flex flex-wrap gap-2">
                                {f.apartments
                                  .filter(
                                    (u) =>
                                      (filter === "all" || u.type === filter) &&
                                      (matches(b.name) ||
                                        matches(f.name) ||
                                        matches(String(f.number)) ||
                                        matches(u.number)),
                                  )
                                  .map((u) => {
                                    const index = f.apartments.findIndex((x) => x.id === u.id);
                                    return (
                                      <div
                                        key={u.id}
                                        className="min-w-0 max-w-full rounded-xl border bg-card p-2"
                                        onDragOver={(e) => {
                                          if (drag?.building === b.id) e.preventDefault();
                                        }}
                                        onDrop={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          if (drag?.building === b.id)
                                            update(b.id, (b) => moveUnit(b, drag.unit, f.id, u.id));
                                          setDrag(null);
                                        }}
                                      >
                                        <div className="flex items-center gap-1">
                                          {!typesOnly && (
                                            <button
                                              type="button"
                                              draggable
                                              aria-label={`${t("editorMoveTo")} ${u.number}`}
                                              onClick={() => setMove(move === u.id ? null : u.id)}
                                              onDragStart={(e) => {
                                                e.dataTransfer.setData("text/plain", u.id);
                                                e.dataTransfer.effectAllowed = "move";
                                                setDrag({ building: b.id, unit: u.id });
                                              }}
                                              onDragEnd={() => setDrag(null)}
                                              className="cursor-grab rounded p-1 text-muted-foreground hover:bg-muted"
                                            >
                                              <GripVertical className="size-4" />
                                            </button>
                                          )}
                                          <span
                                            className={`size-2 shrink-0 rounded-full ${u.type === "residential" ? "bg-primary" : u.type === "commercial" ? "bg-amber-500" : "bg-stone-500"}`}
                                            aria-hidden
                                          />
                                          <span className="text-xs text-muted-foreground" dir="ltr">
                                            #{index + 1}
                                          </span>
                                          <InlineName
                                            label={`${t("editorUnitName")} ${b.name} ${u.number}`}
                                            value={u.number}
                                            onChange={(number) =>
                                              floorUpdate(b.id, f.id, (f) => ({
                                                ...f,
                                                apartments: f.apartments.map((x) =>
                                                  x.id === u.id ? { ...x, number } : x,
                                                ),
                                              }))
                                            }
                                          />
                                          {u.linked && (
                                            <Link2
                                              className="size-3"
                                              aria-label={t("editorLinked")}
                                            />
                                          )}
                                        </div>
                                        {(typesOnly || move === u.id) && (
                                          <div className="mt-2 flex flex-wrap items-center gap-1">
                                            <TypeSelect
                                              value={u.type}
                                              label={`${t("editorType")} ${u.number}`}
                                              onChange={(type) =>
                                                floorUpdate(b.id, f.id, (f) => ({
                                                  ...f,
                                                  apartments: f.apartments.map((x) =>
                                                    x.id === u.id ? { ...x, type } : x,
                                                  ),
                                                }))
                                              }
                                            />
                                            {!typesOnly && (
                                              <>
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  disabled={index === 0}
                                                  aria-label={`${t("editorBefore")} ${u.number}`}
                                                  onClick={() =>
                                                    update(b.id, (b) =>
                                                      moveUnit(
                                                        b,
                                                        u.id,
                                                        f.id,
                                                        f.apartments[index - 1]?.id,
                                                      ),
                                                    )
                                                  }
                                                >
                                                  <ChevronUp className="size-4" />
                                                </Button>
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  disabled={index === f.apartments.length - 1}
                                                  aria-label={`${t("editorAfter")} ${u.number}`}
                                                  onClick={() =>
                                                    update(b.id, (b) =>
                                                      moveUnit(
                                                        b,
                                                        u.id,
                                                        f.id,
                                                        f.apartments[index + 2]?.id,
                                                      ),
                                                    )
                                                  }
                                                >
                                                  <ChevronDown className="size-4" />
                                                </Button>
                                                <select
                                                  className="max-w-40 rounded border p-1 text-xs"
                                                  aria-label={`${t("editorMoveTo")} ${u.number}`}
                                                  value={f.id}
                                                  onChange={(e) =>
                                                    update(b.id, (b) =>
                                                      moveUnit(b, u.id, e.target.value),
                                                    )
                                                  }
                                                >
                                                  {b.floors.map((f) => (
                                                    <option key={f.id} value={f.id}>
                                                      {f.name || `${t("floor")} ${f.number}`}
                                                    </option>
                                                  ))}
                                                </select>
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  aria-label={`${t("remove")} ${u.number}`}
                                                  disabled={u.linked}
                                                  title={u.linked ? t("editorLinked") : undefined}
                                                  onClick={() =>
                                                    floorUpdate(b.id, f.id, (f) => ({
                                                      ...f,
                                                      apartments: f.apartments.filter(
                                                        (x) => x.id !== u.id,
                                                      ),
                                                    }))
                                                  }
                                                >
                                                  <Trash2 className="size-4" />
                                                </Button>
                                              </>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                {!typesOnly && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="self-start border-dashed"
                                    disabled={f.apartments.length >= 200}
                                    aria-label={`${t("editorAddUnit")} ${b.name} ${f.number}`}
                                    onClick={() =>
                                      floorUpdate(b.id, f.id, (f) => ({
                                        ...f,
                                        apartments: [...f.apartments, nextUnit(b, f)],
                                      }))
                                    }
                                  >
                                    <Plus className="size-4" />
                                    {t("editorAddUnit")}
                                  </Button>
                                )}
                              </div>
                            </>
                          )}
                        </section>
                      ))}
                    {!typesOnly && (
                      <Button
                        variant="outline"
                        className="w-full border-dashed"
                        disabled={b.floors.length >= 200}
                        onClick={() =>
                          update(b.id, (b) => ({
                            ...b,
                            floors: [
                              ...b.floors,
                              newFloor(Math.max(...b.floors.map((f) => f.number)) + 1),
                            ],
                          }))
                        }
                      >
                        <Plus className="size-4" />
                        {t("editorAddFloor")}
                      </Button>
                    )}
                  </div>
                )}
              </article>
            ))
          )}
          {!visible.length && <p role="status">{t("editorNoMatches")}</p>}
        </div>
        <aside className="min-w-0 space-y-4 xl:sticky xl:top-20">
          <section className="space-y-4 rounded-3xl bg-card p-5 shadow-warm">
            <h3 className="text-sm text-muted-foreground">{t("editorSummary")}</h3>
            <p className="font-semibold">
              <bdi>{projectName}</bdi>
            </p>
            <dl className="grid grid-cols-3 gap-2">
              {[
                [buildings.length, t("buildings")],
                [buildings.reduce((n, b) => n + b.floors.length, 0), t("floors")],
                [count, t("units")],
              ].map(([n, label]) => (
                <div key={label} className="rounded-xl bg-muted p-2">
                  <dd className="text-2xl font-semibold">{n}</dd>
                  <dt className="text-xs">{label}</dt>
                </div>
              ))}
            </dl>
            {unitTypes.map((type) => {
              const n = buildings.reduce(
                (n, b) =>
                  n +
                  b.floors.reduce(
                    (n, f) => n + f.apartments.filter((u) => u.type === type).length,
                    0,
                  ),
                0,
              );
              return (
                <div key={type} className="space-y-1 text-sm">
                  <div className="flex justify-between gap-2">
                    <span>
                      {t(type)} · {n}
                    </span>
                    <span>{count ? Math.round((n / count) * 100) : 0}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded bg-muted">
                    <div
                      className={`h-full ${type === "residential" ? "bg-primary" : type === "commercial" ? "bg-amber-400" : "bg-stone-400"}`}
                      style={{ width: `${count ? (n / count) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </section>
          <details open className="rounded-3xl bg-card p-5 shadow-warm">
            <summary className="cursor-pointer font-semibold">{t("editorSection")}</summary>
            <select
              aria-label={t("editorSection")}
              className="my-3 w-full rounded border bg-background p-2"
              value={section?.id ?? ""}
              onChange={(e) => setSelected(e.target.value)}
            >
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name || t("building")}
                </option>
              ))}
            </select>
            <div className="space-y-2">
              {section &&
                [...section.floors]
                  .sort((a, b) => b.number - a.number)
                  .map((f) => (
                    <div key={f.id} className="flex items-center gap-2 text-xs">
                      <span className="w-8 shrink-0" dir="ltr">
                        {f.number}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        <bdi>{f.name || t(f.type)}</bdi>
                      </span>
                      <span className={`rounded px-2 py-1 ${typeStyle[f.type]}`}>
                        {f.apartments.length}
                      </span>
                    </div>
                  ))}
            </div>
          </details>
          <section className="space-y-2 rounded-3xl bg-card p-5 shadow-warm">
            <h3 className="font-semibold">{t("editorChecks")}</h3>
            <p
              className={`rounded-xl p-3 text-sm ${valid ? "bg-primary/10" : "bg-destructive/10 text-destructive"}`}
              role={valid ? undefined : "alert"}
            >
              {t(valid ? "editorValid" : "editorInvalid")}
            </p>
          </section>
        </aside>
      </div>
      <Dialog
        open={!!bulk}
        onOpenChange={(open) => {
          if (!open) setBulk(null);
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t("editorDuplicate")} · <bdi>{bulkFloor?.name || bulkFloor?.number}</bdi>
            </DialogTitle>
            <DialogDescription>{t("editorCopyHint")}</DialogDescription>
          </DialogHeader>
          <label className="space-y-2">
            <span>{t("editorCopies")}</span>
            <Input
              type="number"
              min={1}
              max={Math.max(0, 200 - (bulkBuilding?.floors.length ?? 0))}
              value={copies}
              onChange={(e) => setCopies(Number(e.target.value))}
            />
          </label>
          <p>{t("editorCount", { n: (bulkFloor?.apartments.length ?? 0) * copies })}</p>
          <Button
            disabled={
              !Number.isInteger(copies) ||
              copies < 1 ||
              copies + (bulkBuilding?.floors.length ?? 0) > 200
            }
            onClick={() => {
              if (bulk) update(bulk.building, (b) => duplicateFloors(b, bulk.floor, copies));
              setBulk(null);
            }}
          >
            {t("editorApply")}
          </Button>
          <fieldset className="space-y-2 border-t pt-3">
            <legend>{t("editorCopyTargets")}</legend>
            {bulkBuilding?.floors
              .filter((f) => f.id !== bulk?.floor)
              .map((f) => (
                <label key={f.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={targets.includes(f.id)}
                    onChange={(e) =>
                      setTargets((v) =>
                        e.target.checked ? [...v, f.id] : v.filter((id) => id !== f.id),
                      )
                    }
                  />
                  <bdi>{f.name || `${t("floor")} ${f.number}`}</bdi>
                  <span className="text-xs text-muted-foreground">
                    {t("editorCount", { n: f.apartments.length })}
                  </span>
                </label>
              ))}
          </fieldset>
          <p className="text-sm text-muted-foreground">
            {t("editorCount", { n: targets.length * (bulkFloor?.apartments.length ?? 0) })}
          </p>
          <Button
            disabled={!targets.length}
            onClick={() => {
              if (bulk) update(bulk.building, (b) => copyFloor(b, bulk.floor, targets));
              setBulk(null);
            }}
          >
            {t("editorApply")}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
