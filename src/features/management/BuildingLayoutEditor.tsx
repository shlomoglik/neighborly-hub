"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n, type TKey } from "@/lib/i18n";
import type { ManagementHierarchy } from "@/lib/access/management-contracts";
import {
  buildingLayoutInput,
  type BuildingLayoutInput,
} from "@/lib/access/building-layout-contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { privateRequest, PrivateRequestError } from "@/features/shared/private-api";

export async function saveBuildingLayout(
  projectId: string,
  input: BuildingLayoutInput,
  signal: AbortSignal,
) {
  return privateRequest<{ added: number; removed: number }>(
    `/api/management/projects/${encodeURIComponent(projectId)}/structure`,
    signal,
    "PUT",
    input,
  );
}
export function BuildingLayoutEditor({
  data,
  initialId,
  refreshing,
  onClose,
  onSaved,
  onReload,
  onAccessLost,
  save = saveBuildingLayout,
}: {
  data: ManagementHierarchy;
  initialId: string;
  refreshing: boolean;
  onClose: () => void;
  onSaved: () => void;
  onReload: () => void;
  onAccessLost: (status: number) => void;
  save?: typeof saveBuildingLayout;
}) {
  const { t, dir } = useI18n();
  const [selected, setSelected] = useState([initialId]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [uniform, setUniform] = useState("4");
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TKey | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const buildings = data.buildings.filter((b) => selected.includes(b.id));
  const floorNumbers = [...new Set(buildings.flatMap((b) => b.floors.map((f) => f.number)))].sort(
    (a, b) => a - b,
  );
  const input = {
    buildings: buildings
      .filter((b) => b.floors.some((f) => counts[String(f.number)] !== undefined))
      .map((b) => ({
        id: b.id,
        expectedVersion: b.version ?? "",
        floors: b.floors
          .filter((f) => counts[String(f.number)] !== undefined)
          .map((f) => ({
            id: f.id,
            units: counts[String(f.number)]?.trim() ? Number(counts[String(f.number)]) : NaN,
          })),
      })),
  };
  const parsed = buildingLayoutInput.safeParse(input);
  const changes = buildings.flatMap((b) =>
    b.floors
      .filter(
        (f) =>
          counts[String(f.number)] !== undefined &&
          Number(counts[String(f.number)]) !== f.apartments.length,
      )
      .map((f) => ({
        building: b.name,
        floor: f.number,
        before: f.apartments.length,
        after: Number(counts[String(f.number)]),
      })),
  );
  const blocked = busy || refreshing;
  async function submit() {
    if (!parsed.success || pending.current || blocked || error) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    try {
      await save(data.id, parsed.data, controller.signal);
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
      if (!controller.signal.aborted) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <AlertDialogContent
        dir={dir}
        className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{t("layoutEdit")}</AlertDialogTitle>
          <AlertDialogDescription>{t("layoutHint")}</AlertDialogDescription>
        </AlertDialogHeader>
        <fieldset disabled={blocked || review || !!error} className="space-y-4">
          <legend className="sr-only">{t("layoutEdit")}</legend>
          <div className="flex flex-wrap gap-3">
            {data.buildings.map((b) => (
              <label key={b.id} className="flex min-h-11 items-center gap-2 rounded-xl border px-3">
                <input
                  type="checkbox"
                  checked={selected.includes(b.id)}
                  onChange={(e) => {
                    setSelected((ids) =>
                      e.target.checked ? [...ids, b.id] : ids.filter((id) => id !== b.id),
                    );
                    setCounts({});
                  }}
                />
                <bdi>{b.name}</bdi>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-2">
              <span>{t("unitsPerFloor")}</span>
              <Input
                type="number"
                min={0}
                max={200}
                value={uniform}
                onChange={(e) => setUniform(e.target.value)}
              />
            </label>
            <Button
              type="button"
              variant="outline"
              disabled={
                !selected.length ||
                !uniform.trim() ||
                !Number.isInteger(Number(uniform)) ||
                Number(uniform) < 0 ||
                Number(uniform) > 200
              }
              onClick={() =>
                setCounts(Object.fromEntries(floorNumbers.map((f) => [String(f), uniform])))
              }
            >
              {t("layoutApplyFloors")}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{t("layoutExistingHint")}</p>
          <div className="space-y-2">
            {floorNumbers.map((number) => {
              const floors = buildings.flatMap((b) => b.floors.filter((f) => f.number === number));
              const sizes = [...new Set(floors.map((f) => f.apartments.length))];
              return (
                <label key={number} className="flex items-center gap-3 rounded-xl border p-2">
                  <span className="min-w-20">
                    {t("floor")} {number}
                  </span>
                  <Input
                    aria-label={t("layoutFloor", { floor: number })}
                    type="number"
                    min={0}
                    max={200}
                    placeholder={sizes.length === 1 ? String(sizes[0]) : t("layoutMixed")}
                    value={counts[String(number)] ?? ""}
                    onChange={(e) => {
                      const next = { ...counts };
                      if (e.target.value === "") delete next[String(number)];
                      else next[String(number)] = e.target.value;
                      setCounts(next);
                    }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {t("layoutBuildingsCount", { n: floors.length })}
                  </span>
                </label>
              );
            })}
            {!floorNumbers.length && <p>{t("managementNoFloors")}</p>}
          </div>
        </fieldset>
        {review && (
          <div className="community-enter space-y-2" role="region" aria-label={t("stepReview")}>
            <h3 className="font-semibold">{t("stepReview")}</h3>
            <ul className="space-y-1">
              {changes.map((change) => (
                <li key={`${change.building}:${change.floor}`}>
                  {change.building} · {t("floor")} {change.floor}:{" "}
                  <bdi>
                    {change.before} → {change.after}
                  </bdi>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">{t("layoutRemovalHint")}</p>
          </div>
        )}
        {error && (
          <div role="alert" className="space-y-2">
            <p>{t(error)}</p>
            <Button variant="outline" disabled={busy} onClick={onReload}>
              {t("refreshManagement")}
            </Button>
          </div>
        )}
        {blocked && <p role="status">{t(busy ? "saving" : "loading")}</p>}
        <AlertDialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            {t("cancel")}
          </Button>
          {review ? (
            <>
              <Button
                variant="outline"
                disabled={blocked || !!error}
                onClick={() => setReview(false)}
              >
                {t("back")}
              </Button>
              <Button disabled={blocked || !!error} onClick={submit}>
                {t("save")}
              </Button>
            </>
          ) : (
            <Button
              disabled={blocked || !parsed.success || !changes.length || !!error}
              onClick={() => setReview(true)}
            >
              {t("stepReview")}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
