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
export function ManagedStructureEditor({
  data,
  initialId,
  refreshing,
  onClose,
  onSaved,
  onReload,
  onAccessLost,
  onDirtyChange,
  onBusyChange,
}: {
  data: ManagementHierarchy;
  initialId: string;
  refreshing: boolean;
  onClose: () => void;
  onSaved: () => void;
  onReload: () => void;
  onAccessLost: (status: number) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { t, dir } = useI18n();
  const original = data.buildings.find((b) => b.id === initialId)!;
  const [buildings, setBuildingsState] = useState<DraftBuilding[]>(() =>
    withDefaultNames(
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
            : [newFloor(0)],
        },
      ],
      t("building"),
      t("floor"),
    ),
  );
  const setBuildings = (next: DraftBuilding[]) =>
    setBuildingsState(withDefaultNames(next, t("building"), t("floor")));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TKey | null>(null);
  const pending = useRef<AbortController | null>(null);
  const initialDraft = useRef(buildings);
  const dirty = JSON.stringify(buildings) !== JSON.stringify(initialDraft.current);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);
  useEffect(() => () => pending.current?.abort(), []);
  async function save() {
    if (pending.current || refreshing || error) return;
    const b = buildings[0];
    const parsed = visualBuildingInput.safeParse({
      ...b,
      expectedVersion: original.version,
      floors: b.floors.map((f) => ({
        ...f,
        name: f.name || undefined,
        apartments: f.apartments.map(({ linked: _linked, ...u }) => u),
      })),
    });
    if (!parsed.success) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    try {
      await privateRequest(
        `/api/management/projects/${encodeURIComponent(data.id)}/structure`,
        controller.signal,
        "PUT",
        parsed.data,
      );
      if (!controller.signal.aborted) onSaved();
    } catch (cause) {
      if (controller.signal.aborted) return;
      const status = cause instanceof PrivateRequestError ? cause.status : 0;
      const code = cause instanceof PrivateRequestError ? cause.code : "";
      if ([401, 403, 404].includes(status)) {
        onAccessLost(status);
        onClose();
      } else
        setError(
          code === "LINKED_APARTMENTS"
            ? "layoutLinked"
            : code === "STALE_STRUCTURE"
              ? "structureStale"
              : status === 400
                ? "structureInvalid"
                : "structureUncertain",
        );
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <section dir={dir} className="min-w-0 space-y-4" aria-label={t("editorTitle")}>
      <p className="text-sm text-muted-foreground">{t("managementStructureHint")}</p>
      <fieldset disabled={busy || refreshing || !!error} className="min-w-0">
        <ProjectStructureEditor
          managed
          buildings={buildings}
          onChange={setBuildings}
          projectName={data.name}
        />
      </fieldset>
      {error && (
        <div
          role="alert"
          className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3"
        >
          <p>{t(error)}</p>
          <Button variant="outline" disabled={busy || refreshing} onClick={onReload}>
            {t("refreshManagement")}
          </Button>
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" disabled={busy || refreshing} onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button
          loading={busy}
          disabled={refreshing || !!error || !validateDraft(buildings).success || !dirty}
          onClick={save}
        >
          {t("save")}
        </Button>
      </div>
    </section>
  );
}
