"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n, type TKey } from "@/lib/i18n";
import {
  projectSetupDetailsInput,
  projectSetupInput,
  type ProjectSetupInput,
  type ProjectSetupResult,
} from "@/lib/db/project-setup-input";
import { managementHref } from "@/lib/access/management-contracts";
import { createProject, ProjectSetupRequestError } from "./project-setup-api";
import { ProjectStructureEditor } from "./ProjectStructureEditor";
import {
  draftBuildings,
  draftPayload,
  newBuilding,
  withDefaultNames,
  type DraftBuilding,
} from "./project-structure-draft";

export const SETUP_DRAFT_KEY = "neighborly:project-setup:v2";
const savedDraft = z.object({
  version: z.literal(2),
  revision: z.string(),
  name: z.string().max(200),
  city: z.string().max(200),
  buildings: draftBuildings,
  step: z.number().int().min(0).max(3),
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
  const [buildings, setBuildingsState] = useState<DraftBuilding[]>(() =>
    withDefaultNames([newBuilding()], t("building"), t("floor")),
  );
  const setBuildings = (next: DraftBuilding[]) =>
    setBuildingsState(withDefaultNames(next, t("building"), t("floor")));
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ProjectSetupResult | null>(null);
  const [error, setError] = useState<TKey | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [available, setAvailable] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [ready, setReady] = useState(false);
  const revision = useRef<string | null>(null);
  const pending = useRef(false);
  const steps = [t("project"), t("editorTitle"), t("editorTypes"), t("editorReview")];
  const payload = draftPayload(projectName, city, buildings);
  const valid = (step === 0 ? projectSetupDetailsInput : projectSetupInput).safeParse(
    payload,
  ).success;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETUP_DRAFT_KEY);
      if (raw) {
        const parsed = savedDraft.safeParse(JSON.parse(raw));
        if (parsed.success) {
          revision.current = parsed.data.revision;
          setAvailable(true);
        }
      }
    } catch {
      setSaveFailed(true);
    }
    setReady(true);
    const changed = (event: StorageEvent) => {
      if (event.key === SETUP_DRAFT_KEY) {
        setConflict(true);
        setAvailable(!!event.newValue);
        setSaved(false);
      }
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  const save = () => {
    if (!ready || conflict || available || result || pending.current) return;
    try {
      const raw = localStorage.getItem(SETUP_DRAFT_KEY);
      if (raw) {
        const parsed = savedDraft.safeParse(JSON.parse(raw));
        if (!parsed.success || parsed.data.revision !== revision.current) {
          setConflict(true);
          setAvailable(parsed.success);
          return;
        }
      } else if (revision.current) {
        setConflict(true);
        return;
      }
      const next = crypto.randomUUID();
      localStorage.setItem(
        SETUP_DRAFT_KEY,
        JSON.stringify({ version: 2, revision: next, name: projectName, city, buildings, step }),
      );
      revision.current = next;
      setSaved(true);
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
      setSaved(false);
    }
  };
  useEffect(() => {
    if (!ready || available || conflict || result || submitting || (!projectName && !city)) return;
    setSaved(false);
    const timer = window.setTimeout(save, 500);
    return () => window.clearTimeout(timer);
    // Save the complete committed draft, never transient text inside inline fields.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectName, city, buildings, step, ready, available, conflict, result, submitting]);
  const restore = () => {
    try {
      const parsed = savedDraft.parse(JSON.parse(localStorage.getItem(SETUP_DRAFT_KEY) ?? "null"));
      setProjectName(parsed.name);
      setCity(parsed.city);
      setBuildings(parsed.buildings);
      setStep(parsed.step);
      revision.current = parsed.revision;
      setAvailable(false);
      setConflict(false);
      setSaved(true);
    } catch {
      setSaveFailed(true);
    }
  };
  const discard = () => {
    try {
      localStorage.removeItem(SETUP_DRAFT_KEY);
      revision.current = null;
      setAvailable(false);
      setConflict(false);
      setSaved(false);
    } catch {
      setSaveFailed(true);
    }
  };
  async function submit() {
    if (pending.current || result || conflict || available) return;
    const parsed = projectSetupInput.safeParse(payload);
    if (!parsed.success) {
      setError("setupInvalid");
      return;
    }
    pending.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const created = await onCreate(parsed.data);
      setResult(created);
      try {
        const raw = localStorage.getItem(SETUP_DRAFT_KEY);
        if (raw && savedDraft.parse(JSON.parse(raw)).revision === revision.current)
          localStorage.removeItem(SETUP_DRAFT_KEY);
      } catch {
        /* Creation already succeeded; storage cleanup must not turn it into a failed request. */
      }
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
          role="status"
          className="mx-auto max-w-2xl space-y-4 rounded-3xl bg-card p-5 shadow-warm"
        >
          <h1 className="text-2xl font-bold">{t("setupCreated")}</h1>
          <p>
            <bdi>{projectName.trim()}</bdi> — <bdi>{city.trim()}</bdi>
          </p>
          <p>
            {t("setupCreatedDetails", {
              n: buildings.length,
              units: buildings.reduce(
                (n, b) => n + b.floors.reduce((n, f) => n + f.apartments.length, 0),
                0,
              ),
            })}
          </p>
          <Link className="text-primary underline" href={managementHref(result.projectId)}>
            {t("openProjectManagement")}
          </Link>
        </section>
      </AppShell>
    );
  return (
    <AppShell wide>
      <div className="mx-auto min-w-0 max-w-7xl space-y-5">
        <Link
          href="/manage"
          aria-disabled={submitting}
          onClick={(e) => {
            if (pending.current) e.preventDefault();
          }}
          className="text-sm text-muted-foreground hover:underline"
        >
          {t("back")}
        </Link>
        <header className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">
              <bdi>{projectName || t("newProject")}</bdi>
            </p>
            <h1 className="text-2xl font-bold">{t("newProject")}</h1>
          </div>
          <Button variant="outline" disabled={submitting || conflict || available} onClick={save}>
            {t("editorSaveDraft")}
          </Button>
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {saveFailed ? t("editorSaveFailed") : saved ? t("editorSaved") : ""}
          </span>
        </header>
        <p className="text-xs text-muted-foreground">{t("editorLocalHint")}</p>
        {(available || conflict) && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted p-3"
          >
            <p className="w-full">{t(conflict ? "editorDraftConflict" : "editorRestore")}</p>
            {available && <Button onClick={restore}>{t("editorRestore")}</Button>}
            <Button variant="outline" onClick={discard}>
              {t("editorDiscard")}
            </Button>
          </div>
        )}
        <nav aria-label={t("joinSteps")} className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {steps.map((label, index) => (
            <button
              key={index}
              type="button"
              disabled={submitting || index >= step}
              aria-current={index === step ? "step" : undefined}
              onClick={() => {
                setStep(index);
                setError(null);
              }}
              className={`rounded-xl px-3 py-3 text-sm ${index === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {index + 1}. {label}
            </button>
          ))}
        </nav>
        <fieldset disabled={submitting} className="min-w-0 space-y-4" aria-busy={submitting}>
          {step === 0 && (
            <section className="mx-auto max-w-2xl space-y-4 rounded-3xl bg-card p-5 shadow-warm">
              <h2 className="font-semibold">{steps[0]}</h2>
              <label className="block space-y-2">
                <span>{t("projectName")}</span>
                <Input
                  required
                  maxLength={200}
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </label>
              <label className="block space-y-2">
                <span>{t("city")}</span>
                <Input
                  required
                  maxLength={200}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </label>
            </section>
          )}
          {(step === 1 || step === 2) && (
            <>
              <h2 className="text-lg font-semibold">{steps[step]}</h2>
              {step === 2 && (
                <p className="text-sm text-muted-foreground">{t("editorSpecsHint")}</p>
              )}
              <ProjectStructureEditor
                key={step}
                buildings={buildings}
                onChange={setBuildings}
                projectName={projectName}
                typesOnly={step === 2}
              />
            </>
          )}
          {step === 3 && (
            <section className="space-y-4 rounded-3xl bg-card p-5 shadow-warm">
              <h2 className="text-lg font-semibold">{steps[3]}</h2>
              <p>
                <bdi>{projectName}</bdi> — <bdi>{city}</bdi>
              </p>
              {buildings.map((b) => (
                <div key={b.id} className="rounded-2xl bg-muted p-4">
                  <h3 className="font-semibold">
                    <bdi>{b.name}</bdi> · {b.floors.length} {t("floors")} ·{" "}
                    {t("editorCount", { n: b.floors.reduce((n, f) => n + f.apartments.length, 0) })}
                  </h3>
                  <p>
                    <bdi>{b.address}</bdi>
                  </p>
                  {[...b.floors]
                    .sort((a, b) => b.number - a.number)
                    .map((f) => (
                      <p key={f.id} className="text-sm">
                        <bdi>{f.name || `${t("floor")} ${f.number}`}</bdi> · {t(f.type)} ·{" "}
                        {f.apartments.map((u) => u.number).join(", ") || t("editorCount", { n: 0 })}
                      </p>
                    ))}
                </div>
              ))}
              <p className="text-sm text-muted-foreground">{t("setupReviewHint")}</p>
            </section>
          )}
        </fieldset>
        {error && (
          <div role="alert" className="text-sm text-destructive">
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
        <div className="sticky bottom-20 z-10 lg:bottom-0 flex flex-wrap justify-end gap-3 rounded-2xl border bg-card/95 p-3 shadow-warm">
          <Button
            variant="outline"
            disabled={submitting || step === 0}
            onClick={() => {
              setStep(step - 1);
              setError(null);
            }}
          >
            {t("back")}
          </Button>
          {step < 3 ? (
            <Button
              disabled={!valid || submitting || conflict || available}
              onClick={() => {
                setStep(step + 1);
                setError(null);
              }}
            >
              {t("editorNext")}
            </Button>
          ) : (
            <Button disabled={!valid || submitting || conflict || available} onClick={submit}>
              {t(submitting ? "loadingSubmit" : "create")}
            </Button>
          )}
        </div>
      </div>
    </AppShell>
  );
}
