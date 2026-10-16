"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";

type BuildingDraft = {
  id: number;
  name: string;
  floors: number;
  unitsPerFloor: number;
};

const initialBuilding = (): BuildingDraft => ({
  id: 1,
  name: "",
  floors: 1,
  unitsPerFloor: 1,
});

export function ProjectSetupWizard() {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [projectName, setProjectName] = useState("");
  const [city, setCity] = useState("");
  const [buildings, setBuildings] = useState<BuildingDraft[]>([initialBuilding()]);
  const steps = [t("project"), t("buildings"), t("stepReview")];
  const updateBuilding = (id: number, patch: Partial<BuildingDraft>) =>
    setBuildings((items) =>
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  const valid =
    step === 0
      ? Boolean(projectName.trim() && city.trim())
      : step === 1
        ? buildings.length > 0 &&
          buildings.every(
            (b) =>
              b.name.trim() &&
              Number.isInteger(b.floors) &&
              b.floors > 0 &&
              Number.isInteger(b.unitsPerFloor) &&
              b.unitsPerFloor > 0,
          )
        : true;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <Link
          href="/manage"
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
              onClick={() => index < step && setStep(index)}
              disabled={index >= step}
              aria-current={index === step ? "step" : undefined}
              className={`rounded-xl px-2 py-3 text-sm transition-colors duration-200 motion-reduce:transition-none ${index === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {index + 1}. {label}
            </button>
          ))}
        </nav>
        <section
          key={step}
          className="space-y-4 rounded-3xl bg-card p-5 shadow-warm motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        >
          <h2 className="text-lg font-semibold">{steps[step]}</h2>
          {step === 0 && (
            <>
              <label className="block space-y-2">
                <span>{t("projectName")}</span>
                <Input
                  required
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </label>
              <label className="block space-y-2">
                <span>{t("city")}</span>
                <Input
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
                <div
                  key={b.id}
                  className="space-y-3 rounded-2xl border border-border p-4"
                >
                  <label className="block space-y-2">
                    <span>{t("building")}</span>
                    <Input
                      required
                      value={b.name}
                      onChange={(e) =>
                        updateBuilding(b.id, { name: e.target.value })
                      }
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
                        onChange={(e) =>
                          updateBuilding(b.id, { floors: Number(e.target.value) })
                        }
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
                          updateBuilding(b.id, { unitsPerFloor: Number(e.target.value) })
                        }
                      />
                    </label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("willGenerate", { n: b.floors * b.unitsPerFloor })}
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
                  {b.name}: {b.floors} {t("floors")} · {b.floors * b.unitsPerFloor}{" "}
                  {t("units")}
                </div>
              ))}
              <p className="text-sm text-muted-foreground">
                {t("previewNeighbor")}
              </p>
            </div>
          )}
        </section>
        <div className="flex justify-between gap-3">
          <Button
            variant="outline"
            type="button"
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
          >
            {t("back")}
          </Button>
          {step < 2 ? (
            <Button
              type="button"
              disabled={!valid}
              onClick={() => setStep((s) => s + 1)}
            >
              {steps[step + 1]}
            </Button>
          ) : (
            <Button type="button" disabled title={t("stepReview")}>
              {t("create")}
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
