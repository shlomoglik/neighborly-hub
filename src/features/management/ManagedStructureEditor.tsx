"use client";
import { useEffect, useRef, useState } from "react";
import type { ManagementHierarchy } from "@/lib/access/management-contracts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
}: {
  data: ManagementHierarchy;
  initialId: string;
  refreshing: boolean;
  onClose: () => void;
  onSaved: () => void;
  onReload: () => void;
  onAccessLost: (status: number) => void;
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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        dir={dir}
        className="max-h-[95dvh] overflow-y-auto sm:max-w-[95vw]"
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>
            {t("editorTitle")} · <bdi>{original.name}</bdi>
          </DialogTitle>
          <DialogDescription>{t("editorCopyHint")}</DialogDescription>
        </DialogHeader>
        <fieldset disabled={busy || refreshing || !!error} className="min-w-0">
          <ProjectStructureEditor
            managed
            buildings={buildings}
            onChange={setBuildings}
            projectName={data.name}
          />
        </fieldset>
        {error && (
          <div role="alert">
            <p>{t(error)}</p>
            <Button variant="outline" disabled={busy} onClick={onReload}>
              {t("refreshManagement")}
            </Button>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            disabled={busy || refreshing || !!error || !validateDraft(buildings).success}
            onClick={save}
          >
            {t(busy ? "saving" : "save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
