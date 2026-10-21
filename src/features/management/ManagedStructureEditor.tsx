"use client";
import { useEffect, useRef, useState } from "react";
import type { ManagementHierarchy } from "@/lib/access/management-contracts";
import { Button } from "@/components/ui/button";
import { useI18n, type TKey } from "@/lib/i18n";
import { privateRequest, PrivateRequestError } from "@/features/shared/private-api";
import { ProjectStructureEditor } from "./ProjectStructureEditor";
import {
  newFloor,
  validateDraft,
  withDefaultNames,
  type DraftBuilding,
} from "./project-structure-draft";
import { unitType } from "@/lib/db/project-structure-input";
import { visualBuildingInput } from "@/lib/access/visual-structure-contracts";

type Building = ManagementHierarchy["buildings"][number];
type Entry = {
  original: Building;
  initial: DraftBuilding;
  draft: DraftBuilding;
  error: TKey | null;
};
function entryFor(
  original: Building,
  buildingLabel: string,
  floorLabel: string,
  editable = true,
): Entry {
  const [draft] = withDefaultNames(
    [
      {
        id: original.id,
        name: original.name,
        address: original.address ?? "",
        floors: original.floors.length
          ? original.floors.map((f) => ({
              id: f.id,
              number: f.number,
              name: f.name ?? "",
              type: unitType.catch("residential").parse(f.type),
              apartments: [...f.apartments]
                .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
                .map((u) => ({
                  id: u.id,
                  number: u.number,
                  type: unitType.catch("residential").parse(u.type),
                  linked: u.linked ?? false,
                })),
            }))
          : editable
            ? [newFloor(0)]
            : [],
      },
    ],
    buildingLabel,
    floorLabel,
  );
  return { original, initial: draft, draft, error: null };
}
const isDirty = (entry: Entry) => JSON.stringify(entry.draft) !== JSON.stringify(entry.initial);

/** One project editor with independent, version-checked building saves. */
export function ManagedStructureEditor({
  data,
  mode,
  buildingIds,
  refreshing,
  onSaved,
  onAccessLost,
  onDirtyChange,
  onBusyChange,
}: {
  data: ManagementHierarchy;
  mode: "view" | "edit";
  buildingIds: string[];
  refreshing: boolean;
  onSaved: () => void;
  onAccessLost: (status: number) => void;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const { t, dir } = useI18n();
  const [entries, setEntries] = useState<Entry[]>(() =>
    data.buildings
      .filter((b) => !buildingIds.length || buildingIds.includes(b.id))
      .map((b) => entryFor(b, t("building"), t("floor"), mode === "edit")),
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const busy = busyId !== null;
  const [waiting, setWaiting] = useState<{ id: string; source: ManagementHierarchy } | null>(null);
  const pending = useRef<AbortController | null>(null);
  // Filter revoked buildings during render, before effects can run.
  const viewEntries =
    mode === "view"
      ? data.buildings.map((b) => entryFor(b, t("building"), t("floor"), false))
      : entries;
  const selected = viewEntries.filter(
    (entry) =>
      (!buildingIds.length || buildingIds.includes(entry.original.id)) &&
      data.buildings.some((b) => b.id === entry.original.id),
  );
  const dirty = selected.some(isDirty);
  const blocked = busy || refreshing || !!waiting;
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    onBusyChange(busy || !!waiting);
  }, [busy, waiting, onBusyChange]);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    if (mode === "view") return;
    const refreshed = waiting && !refreshing && data !== waiting.source;
    setEntries((current) => {
      const next = data.buildings
        .filter((b) => !buildingIds.length || buildingIds.includes(b.id))
        .map((b) => {
          const existing = current.find((entry) => entry.original.id === b.id);
          return !existing || (refreshed && waiting.id === b.id)
            ? entryFor(b, t("building"), t("floor"))
            : existing;
        });
      return next.length === current.length && next.every((entry, i) => entry === current[i])
        ? current
        : next;
    });
    if (refreshed) setWaiting(null);
  }, [data, buildingIds, refreshing, waiting, t, mode]);
  const reload = (id: string) => {
    setWaiting({ id, source: data });
    onSaved();
  };
  const cancel = (id: string) => {
    const original = data.buildings.find((b) => b.id === id);
    if (original)
      setEntries((current) =>
        current.map((entry) =>
          entry.original.id === id ? entryFor(original, t("building"), t("floor")) : entry,
        ),
      );
  };
  async function save(entry: Entry) {
    if (mode !== "edit" || pending.current || blocked || entry.error || !isDirty(entry)) return;
    const b = entry.draft;
    const parsed = visualBuildingInput.safeParse({
      ...b,
      expectedVersion: entry.original.version,
      floors: b.floors.map((f) => ({
        ...f,
        name: f.name || undefined,
        apartments: f.apartments.map(({ linked: _linked, ...u }) => u),
      })),
    });
    if (!parsed.success) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusyId(b.id);
    try {
      await privateRequest(
        `/api/management/projects/${encodeURIComponent(data.id)}/structure`,
        controller.signal,
        "PUT",
        parsed.data,
      );
      if (!controller.signal.aborted) reload(b.id);
    } catch (cause) {
      if (controller.signal.aborted) return;
      const status = cause instanceof PrivateRequestError ? cause.status : 0;
      const code = cause instanceof PrivateRequestError ? cause.code : "";
      if ([401, 403, 404].includes(status)) onAccessLost(status);
      else {
        const error: TKey =
          code === "LINKED_APARTMENTS"
            ? "layoutLinked"
            : code === "STALE_STRUCTURE"
              ? "structureStale"
              : status === 400
                ? "structureInvalid"
                : "structureUncertain";
        setEntries((current) =>
          current.map((item) => (item.original.id === b.id ? { ...item, error } : item)),
        );
      }
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusyId(null);
    }
  }
  return (
    <section dir={dir} className="min-w-0 space-y-4" aria-label={t("editorTitle")}>
      <p className="text-sm text-muted-foreground">
        {t(mode === "edit" ? "managementStructureHint" : "managementViewHint")}
      </p>
      <fieldset disabled={blocked} className="min-w-0">
        <ProjectStructureEditor
          mode={mode}
          buildings={selected.map((entry) => entry.draft)}
          onChange={(buildings) => {
            if (mode !== "edit") return;
            const next = withDefaultNames(buildings, t("building"), t("floor"));
            setEntries((current) =>
              current.map((entry) => ({
                ...entry,
                draft: entry.error
                  ? entry.draft
                  : (next.find((b) => b.id === entry.original.id) ?? entry.draft),
              })),
            );
          }}
          projectName={data.name}
          disabledBuildings={selected
            .filter((entry) => entry.error)
            .map((entry) => entry.original.id)}
          buildingActions={(id) => {
            const entry = selected.find((entry) => entry.original.id === id)!;
            return (
              <div className="space-y-3 border-t p-4">
                {entry.error && (
                  <div
                    role="alert"
                    className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3"
                  >
                    <p>{t(entry.error)}</p>
                    <Button variant="outline" disabled={blocked} onClick={() => reload(id)}>
                      {t("refreshManagement")}
                    </Button>
                  </div>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" disabled={blocked} onClick={() => cancel(id)}>
                    {t("cancel")}
                  </Button>
                  <Button
                    loading={busyId === id}
                    disabled={
                      blocked ||
                      !!entry.error ||
                      !validateDraft([entry.draft]).success ||
                      !isDirty(entry)
                    }
                    onClick={() => save(entry)}
                  >
                    {t("save")}
                  </Button>
                </div>
              </div>
            );
          }}
        />
      </fieldset>
    </section>
  );
}
