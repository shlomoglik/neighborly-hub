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
import { visualProjectInput } from "@/lib/access/visual-structure-contracts";

type Building = ManagementHierarchy["buildings"][number];
type Entry = {
  original: Building;
  initial: DraftBuilding;
  draft: DraftBuilding;
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
  return { original, initial: draft, draft };
}
const isDirty = (entry: Entry) => JSON.stringify(entry.draft) !== JSON.stringify(entry.initial);

/** One draft session and atomic save for all changed buildings in the project. */
export function ManagedStructureEditor({
  data,
  mode,
  buildingIds,
  refreshing,
  onSaved,
  onAccessLost,
  onDirtyChange,
  onBusyChange,
  onBuildingChange,
}: {
  data: ManagementHierarchy;
  mode: "view" | "edit";
  buildingIds: string[];
  refreshing: boolean;
  onSaved: () => void;
  onAccessLost: (status: number) => void;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
  onBuildingChange: (ids: string[]) => void;
}) {
  const { t, dir } = useI18n();
  const [entries, setEntries] = useState<Entry[]>(() =>
    data.buildings.map((b) => entryFor(b, t("building"), t("floor"), mode === "edit")),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TKey | null>(null);
  const [waiting, setWaiting] = useState<{ source: ManagementHierarchy } | null>(null);
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
  const authorized = entries.filter((entry) =>
    data.buildings.some((b) => b.id === entry.original.id),
  );
  const changed = authorized.filter(isDirty);
  const dirty = mode === "edit" && changed.length > 0;
  const payload = visualProjectInput.safeParse({
    action: "saveProjectStructure",
    buildings: changed.map((entry) => ({
      ...entry.draft,
      expectedVersion: entry.original.version,
      floors: entry.draft.floors.map((f) => ({
        ...f,
        name: f.name || undefined,
        apartments: f.apartments.map(({ linked: _linked, ...u }) => u),
      })),
    })),
  });
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
      const next = data.buildings.map((b) => {
        const existing = current.find((entry) => entry.original.id === b.id);
        return !existing || refreshed ? entryFor(b, t("building"), t("floor")) : existing;
      });
      return next.length === current.length && next.every((entry, i) => entry === current[i])
        ? current
        : next;
    });
    if (refreshed) {
      setWaiting(null);
      setError(null);
    }
  }, [data, buildingIds, refreshing, waiting, t, mode]);
  const reload = () => {
    setWaiting({ source: data });
    onSaved();
  };
  const cancel = () => {
    setEntries(data.buildings.map((b) => entryFor(b, t("building"), t("floor"))));
    // An uncertain request must be revalidated before another write.
    if (error) reload();
  };
  async function save() {
    if (
      mode !== "edit" ||
      pending.current ||
      blocked ||
      error ||
      !dirty ||
      !payload.success ||
      !validateDraft(changed.map((entry) => entry.draft)).success
    )
      return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    try {
      await privateRequest(
        `/api/management/projects/${encodeURIComponent(data.id)}/structure`,
        controller.signal,
        "PUT",
        payload.data,
      );
      if (!controller.signal.aborted) reload();
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
              : code === "DUPLICATE_STRUCTURE"
                ? "structureDuplicate"
                : status === 400
                  ? "structureInvalid"
                  : "structureUncertain";
        setError(error);
      }
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <section dir={dir} className="min-w-0 space-y-4" aria-label={t("editorTitle")}>
      {mode === "edit" && (
        <p className="text-sm text-muted-foreground">{t("managementStructureHint")}</p>
      )}
      <fieldset disabled={blocked || !!error} className="min-w-0">
        <ProjectStructureEditor
          mode={mode}
          buildings={selected.map((entry) => entry.draft)}
          onChange={(buildings) => {
            if (mode !== "edit") return;
            const next = withDefaultNames(buildings, t("building"), t("floor"));
            setEntries((current) =>
              current.map((entry) => ({
                ...entry,
                draft: next.find((b) => b.id === entry.original.id) ?? entry.draft,
              })),
            );
          }}
          projectName={data.name}
          buildingOptions={data.buildings}
          selectedBuildingIds={buildingIds}
          onBuildingSelectionChange={onBuildingChange}
          buildingSelectionDisabled={blocked}
        />
      </fieldset>
      {mode === "edit" && (
        <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 space-y-3 rounded-xl border bg-background p-4 shadow-sm lg:bottom-4">
          {error && (
            <div
              role="alert"
              className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3"
            >
              <p>{t(error)}</p>
              <Button variant="outline" disabled={blocked} onClick={reload}>
                {t("refreshManagement")}
              </Button>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {dirty && (
              <p role="status" className="me-auto text-sm text-muted-foreground">
                {t("managementStructureUnsaved", { count: changed.length })}
              </p>
            )}
            <Button variant="outline" disabled={blocked || (!dirty && !error)} onClick={cancel}>
              {t("cancel")}
            </Button>
            <Button
              loading={busy}
              disabled={
                blocked ||
                !!error ||
                !dirty ||
                !payload.success ||
                !validateDraft(changed.map((entry) => entry.draft)).success
              }
              onClick={save}
            >
              {t("save")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
