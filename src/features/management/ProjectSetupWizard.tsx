"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { Skeleton } from "@/components/ui/skeleton";
import {
  setupFloorCounts,
  setupApartmentCount,
  MAX_SETUP_BUILDINGS,
  MAX_SETUP_FLOORS,
  MAX_SETUP_APARTMENTS,
  projectSetupDetailsInput,
  projectSetupInput,
  setupBuildingsInput,
  type ProjectSetupInput,
  type ProjectSetupResult,
} from "@/lib/db/project-setup-input";
import { managementHref } from "@/lib/access/management-contracts";
import { createProject, ProjectSetupRequestError } from "./project-setup-api";

type BuildingDraft = {
  id: number;
  name: string;
  address?: string;
  floorUnits?: number[];
  floors: number;
  unitsPerFloor: number;
};

const initialBuilding = (): BuildingDraft => ({
  id: 1,
  name: "",
  floors: 1,
  unitsPerFloor: 1,
});

export function ProjectSetupWizard({
  onCreate = createProject,
}: {
  onCreate?: (input: ProjectSetupInput) => Promise<ProjectSetupResult>;
}) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [projectName, setProjectName] = useState("");
  const [city, setCity] = useState("");
  const [buildings, setBuildings] = useState<BuildingDraft[]>([initialBuilding()]);
  const steps = [t("project"), t("buildings"), t("stepReview")];
  const updateBuilding = (id: number, patch: Partial<BuildingDraft>) =>
    setBuildings((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ProjectSetupResult | null>(null);
  const [error, setError] = useState<
    "setupFailed" | "setupForbidden" | "setupExpired" | "setupInvalid" | null
  >(null);
  const pending = useRef(false);
  const payload = {
    name: projectName,
    city,
    buildings: buildings.map(({ name, address, floorUnits, floors, unitsPerFloor }) => ({
      ...(address !== undefined ? { address } : {}),
      ...(floorUnits ? { floorUnits } : {}),
      name,
      floors,
      unitsPerFloor,
    })),
  };
  const valid =
    step === 0
      ? projectSetupDetailsInput.safeParse(payload).success
      : step === 1
        ? setupBuildingsInput.safeParse(payload.buildings).success
        : projectSetupInput.safeParse(payload).success;
  const goTo = (next: number) => {
    if (!pending.current) {
      setStep(next);
      setError(null);
    }
  };
  async function submit() {
    if (pending.current || result) return;
    const parsed = projectSetupInput.safeParse(payload);
    if (!parsed.success) {
      setError("setupInvalid");
      return;
    }
    pending.current = true;
    setSubmitting(true);
    setError(null);
    try {
      setResult(await onCreate(parsed.data));
    } catch (cause) {
      const status = cause instanceof ProjectSetupRequestError ? cause.status : 0;
      setError(
        status === 401
          ? "setupExpired"
          : status === 403
            ? "setupForbidden"
            : [400, 413, 415].includes(status)
              ? "setupInvalid"
              : "setupFailed",
      );
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }
  if (result)
    return (
      <AppShell>
        <section
          className="mx-auto max-w-2xl space-y-4 rounded-3xl bg-card p-5 shadow-warm community-enter"
          role="status"
        >
          <h1 className="text-2xl font-bold">{t("setupCreated")}</h1>
          <p>
            {projectName.trim()} — {city.trim()}
          </p>
          <p>
            {t("setupCreatedDetails", {
              n: buildings.length,
              units: buildings.reduce((total, b) => total + setupApartmentCount(b), 0),
            })}
          </p>
          <Link
            href={managementHref(result.projectId)}
            className="inline-block text-primary underline"
          >
            {t("openProjectManagement")}
          </Link>
        </section>
      </AppShell>
    );

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          href="/manage"
          aria-disabled={submitting}
          onClick={(event) => {
            if (pending.current) event.preventDefault();
          }}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {t("back")}
        </Link>
        <h1 className="text-2xl font-bold">{t("newProject")}</h1>
        <nav aria-label={t("joinSteps")} className="grid grid-cols-3 gap-2">
          {steps.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => index < step && goTo(index)}
              disabled={submitting || index >= step}
              aria-current={index === step ? "step" : undefined}
              className={`rounded-xl px-2 py-3 text-sm transition-colors duration-200 motion-reduce:transition-none ${index === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {index + 1}. {label}
            </button>
          ))}
        </nav>
        <section
          aria-busy={submitting}
          key={step}
          className="space-y-4 rounded-3xl bg-card p-5 shadow-warm motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        >
          <h2 className="text-lg font-semibold">{steps[step]}</h2>
          {step === 1 && <p className="text-sm text-muted-foreground">{t("setupNumbering")}</p>}
          {step === 0 && (
            <>
              <label className="block space-y-2">
                <span>{t("projectName")}</span>
                <Input
                  maxLength={200}
                  required
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </label>
              <label className="block space-y-2">
                <span>{t("city")}</span>
                <Input
                  maxLength={200}
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </label>
            </>
          )}
          {step === 1 && (
            <>
              {buildings.map((b) => (
                <div key={b.id} className="space-y-3 rounded-2xl border border-border p-4">
                  <label className="block space-y-2">
                    <span>{t("building")}</span>
                    <Input
                      maxLength={200}
                      required
                      value={b.name}
                      onChange={(e) => updateBuilding(b.id, { name: e.target.value })}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span>{t("buildingAddress")}</span>
                    <Input
                      maxLength={500}
                      autoComplete="street-address"
                      value={b.address ?? ""}
                      onChange={(e) => updateBuilding(b.id, { address: e.target.value })}
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-2">
                      <span>{t("floors")}</span>
                      <Input
                        type="number"
                        min={1}
                        max={200}
                        value={b.floors}
                        onChange={(e) => {
                          const floors = Number(e.target.value);
                          updateBuilding(b.id, {
                            floors,
                            ...(b.floorUnits
                              ? {
                                  floorUnits: Array.from(
                                    { length: Math.max(0, Math.min(200, floors)) },
                                    (_, i) => b.floorUnits?.[i] ?? b.unitsPerFloor,
                                  ),
                                }
                              : {}),
                          });
                        }}
                      />
                    </label>
                    <label className="space-y-2">
                      <span>{t("unitsPerFloor")}</span>
                      <Input
                        type="number"
                        min={1}
                        max={200}
                        value={b.unitsPerFloor}
                        onChange={(e) =>
                          updateBuilding(b.id, {
                            unitsPerFloor: Number(e.target.value),
                            floorUnits: undefined,
                          })
                        }
                      />
                    </label>
                  </div>
                  <details className="rounded-xl border p-3" open={!!b.floorUnits}>
                    <summary className="cursor-pointer font-medium">{t("layoutPerFloor")}</summary>
                    <p className="my-2 text-sm text-muted-foreground">{t("layoutZeroHint")}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {setupFloorCounts(b)
                        .slice(0, 200)
                        .map((units, floor) => (
                          <label key={floor} className="flex items-center gap-2">
                            <span className="min-w-16">
                              {t("floor")} {floor}
                            </span>
                            <Input
                              aria-label={t("layoutFloorCount", { floor, building: b.name })}
                              type="number"
                              min={0}
                              max={200}
                              value={Number.isFinite(units) ? units : ""}
                              onChange={(e) => {
                                const counts = [...setupFloorCounts(b)];
                                counts[floor] =
                                  e.target.value === "" ? NaN : Number(e.target.value);
                                updateBuilding(b.id, { floorUnits: counts });
                              }}
                            />
                          </label>
                        ))}
                    </div>
                  </details>
                  {buildings.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setBuildings((items) =>
                          items.map((item) =>
                            item.id === b.id
                              ? item
                              : {
                                  ...item,
                                  floors: b.floors,
                                  unitsPerFloor: b.unitsPerFloor,
                                  floorUnits: b.floorUnits ? [...b.floorUnits] : undefined,
                                },
                          ),
                        )
                      }
                    >
                      {t("layoutCopyAll")}
                    </Button>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {t("willGenerate", { n: setupApartmentCount(b) })}
                  </p>
                  {buildings.length > 1 && (
                    <Button
                      variant="outline"
                      type="button"
                      onClick={() =>
                        setBuildings((items) => items.filter((item) => item.id !== b.id))
                      }
                    >
                      {t("remove")}
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                type="button"
                disabled={buildings.length >= MAX_SETUP_BUILDINGS}
                onClick={() =>
                  setBuildings((items) => [
                    ...items,
                    {
                      ...initialBuilding(),
                      id: Math.max(...items.map((b) => b.id)) + 1,
                    },
                  ])
                }
              >
                {t("addBuilding")}
              </Button>
            </>
          )}
          {step === 2 && (
            <div className="space-y-3">
              <p className="font-medium">
                {projectName} — {city}
              </p>
              {buildings.map((b) => (
                <div key={b.id} className="rounded-xl bg-muted p-3">
                  <p>
                    {b.name}: {b.floors} {t("floors")} · {setupApartmentCount(b)} {t("units")}
                  </p>
                  {b.address && <p>{b.address}</p>}
                  <p className="text-sm text-muted-foreground">
                    {setupFloorCounts(b)
                      .map((n, i) => `${t("floor")} ${i}: ${n}`)
                      .join(" · ")}
                  </p>
                </div>
              ))}
              <p className="text-sm text-muted-foreground">{t("setupReviewHint")}</p>
            </div>
          )}
        </section>
        {step === 1 && !valid && (
          <p role="status" className="text-sm text-destructive">
            {t("setupBuildingsInvalid", {
              buildings: MAX_SETUP_BUILDINGS,
              floors: MAX_SETUP_FLOORS,
              units: MAX_SETUP_APARTMENTS,
            })}
          </p>
        )}
        {error && (
          <div role="alert" className="space-y-2 text-sm text-destructive">
            <p>{t(error)}</p>
            {error === "setupExpired" && (
              <Link href="/auth" className="underline">
                {t("signIn")}
              </Link>
            )}
          </div>
        )}
        {submitting && (
          <div role="status" aria-live="polite" aria-busy="true" className="space-y-2">
            <p>{t("loadingSubmit")}</p>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}
        <div className="flex justify-between gap-3">
          <Button
            variant="outline"
            type="button"
            disabled={submitting || step === 0}
            onClick={() => goTo(step - 1)}
          >
            {t("back")}
          </Button>
          {step < 2 ? (
            <Button type="button" disabled={!valid} onClick={() => goTo(step + 1)}>
              {steps[step + 1]}
            </Button>
          ) : (
            <Button type="button" disabled={submitting || !valid} onClick={submit}>
              {submitting ? t("loadingSubmit") : t("create")}
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
