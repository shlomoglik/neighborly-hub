"use client";
import { Plus } from "lucide-react";
import { ResponsiveFormDialog } from "@/components/community/ResponsiveFormDialog";
import { RefreshButton } from "@/components/community/RefreshButton";
import { useEffect, useRef, useState } from "react";
import { useI18n, type TKey } from "@/lib/i18n";
import {
  staffInput,
  type StaffAssignment,
  type StaffInput,
  type StaffPage,
} from "@/lib/access/staff-contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CommunitySkeleton } from "@/components/community/CommunityLoading";
import { SystemFeedback } from "@/components/community/SystemFeedback";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { StaffStatus } from "./use-staff";
export type StaffWorkspaceProps = {
  projectId: string;
  status: StaffStatus;
  data: StaffPage | null;
  busy: boolean;
  notice: { key: TKey; error: boolean } | null;
  onAdd: (input: StaffInput) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
  onRefresh: () => void;
  onPageChange: (page: number) => void;
};
export function StaffWorkspace(p: StaffWorkspaceProps) {
  const { t, dir } = useI18n();
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffInput["role"]>("project_manager");
  const [buildingId, setBuilding] = useState("");
  const [confirm, setConfirm] = useState<StaffAssignment | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const revokeTrigger = useRef<HTMLButtonElement | null>(null);
  const restoreFocus = useRef(false);
  const requestFocus = () => {
    restoreFocus.current = true;
  };
  useEffect(() => {
    if (p.status !== "ready") {
      setConfirm(null);
      if (p.status !== "loading") setCreating(false);
    }
    if (["forbidden", "unavailable", "expired"].includes(p.status)) {
      setEmail("");
      setBuilding("");
    }
    if (p.status !== "loading" && restoreFocus.current) {
      heading.current?.focus();
      restoreFocus.current = false;
    }
  }, [p.status, p.data]);
  const input = staffInput.safeParse({
    email,
    role,
    buildingId: role === "project_manager" ? null : buildingId,
  });
  const validBuilding =
    role === "project_manager" || p.data?.buildings.some((b) => b.id === buildingId);
  return (
    <section className="space-y-5 break-words">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 ref={heading} tabIndex={-1} className="font-heading text-2xl font-normal">
          {t("staffManagement")}
        </h2>
        <div className="ms-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2">
          {((p.status === "ready" && p.data) || (creating && p.status === "loading")) && (
            <ResponsiveFormDialog
              open={creating}
              onOpenChange={(open) => {
                if (open) {
                  setEmail("");
                  setRole("project_manager");
                  setBuilding("");
                }
                setCreating(open);
              }}
              title={t("staffAdd")}
              description={t("staffRegisteredHint")}
              busy={p.busy}
              fallbackFocus={heading}
              trigger={
                <Button disabled={p.busy || p.status === "loading"}>
                  <Plus aria-hidden />
                  {t("staffAdd")}
                </Button>
              }
            >
              {p.status === "ready" && p.data ? (
                <form
                  className="space-y-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (input.success && validBuilding) {
                      requestFocus();
                      if (await p.onAdd(input.data)) {
                        setEmail("");
                        setCreating(false);
                      }
                    }
                  }}
                >
                  {p.notice?.error && <p role="alert">{t(p.notice.key)}</p>}
                  <fieldset disabled={p.busy} className="space-y-3">
                    <label className="block space-y-2">
                      <span>{t("email")}</span>
                      <Input
                        type="email"
                        dir="ltr"
                        autoComplete="off"
                        required
                        maxLength={254}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </label>
                    <label className="block space-y-2">
                      <span>{t("staffRole")}</span>
                      <select
                        className="min-h-11 w-full rounded-xl border bg-card px-3 focus-visible:outline-2 focus-visible:outline-primary"
                        value={role}
                        onChange={(e) => setRole(e.target.value as StaffInput["role"])}
                      >
                        <option value="project_manager">{t("project_manager")}</option>
                        <option value="building_manager">{t("building_manager")}</option>
                      </select>
                    </label>
                    {role === "building_manager" && (
                      <label className="block space-y-2">
                        <span>{t("building")}</span>
                        <select
                          required
                          className="min-h-11 w-full rounded-xl border bg-card px-3 focus-visible:outline-2 focus-visible:outline-primary"
                          value={buildingId}
                          onChange={(e) => setBuilding(e.target.value)}
                        >
                          <option value="">{t("filterBuilding")}</option>
                          {p.data.buildings.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setCreating(false)}>
                        {t("cancel")}
                      </Button>
                      <Button
                        type="submit"
                        loading={p.busy}
                        disabled={!input.success || !validBuilding}
                      >
                        {t("staffAdd")}
                      </Button>
                    </div>
                  </fieldset>
                </form>
              ) : (
                <CommunitySkeleton variant="form" />
              )}
            </ResponsiveFormDialog>
          )}
          <RefreshButton
            disabled={p.busy || p.status === "loading"}
            onClick={() => {
              requestFocus();
              p.onRefresh();
            }}
            label={t("refreshManagement")}
          />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{t("staffRegisteredHint")}</p>
      {p.notice && !creating && (
        <div role={p.notice.error ? "alert" : "status"} className="rounded-xl border bg-card p-4">
          {t(p.notice.key)}
        </div>
      )}
      {p.busy && <p role="status">{t("saving")}</p>}
      {p.status === "loading" && <CommunitySkeleton variant="form" />}
      {p.status === "error" && <SystemFeedback kind="error" onRetry={p.onRefresh} />}
      {p.status === "forbidden" && (
        <SystemFeedback kind="private" message={t("staffAdminOnly")} onRetry={p.onRefresh} />
      )}
      {p.status === "unavailable" && (
        <SystemFeedback kind="private" message={t("managementUnavailable")} onRetry={p.onRefresh} />
      )}
      {p.status === "expired" && (
        <div className="space-y-3">
          <SystemFeedback kind="private" message={t("managementExpired")} />
          <Button asChild>
            <a href="/auth">{t("signIn")}</a>
          </Button>
        </div>
      )}
      {p.status === "ready" && p.data && (
        <div className="community-enter space-y-5">
          <section className="space-y-3" aria-label={t("staffAssignments")}>
            <h3 className="font-bold">{t("staffAssignments")}</h3>
            {!p.data.assignments.length && (
              <SystemFeedback kind="empty" message={t("staffEmpty")} />
            )}
            <ul className="space-y-3">
              {p.data.assignments.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold">
                      <bdi>{a.name}</bdi>
                    </p>
                    <p>
                      <bdi dir="ltr">{a.email}</bdi>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t(a.role)} ·{" "}
                      <bdi>
                        {a.buildingId
                          ? p.data!.buildings.find((b) => b.id === a.buildingId)?.name
                          : t("allBuildings")}
                      </bdi>
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    disabled={p.busy}
                    onClick={(event) => {
                      revokeTrigger.current = event.currentTarget;
                      setConfirm(a);
                    }}
                    aria-label={t("staffRevokeFor", {
                      email: a.email,
                      scope: a.buildingId
                        ? (p.data!.buildings.find((b) => b.id === a.buildingId)?.name ?? "")
                        : t("allBuildings"),
                    })}
                  >
                    {t("staffRevoke")}
                  </Button>
                </li>
              ))}
            </ul>
            <nav
              className="flex items-center justify-between gap-2"
              aria-label={t("staffAssignments")}
            >
              <Button
                variant="outline"
                disabled={p.busy || p.data.page <= 1}
                onClick={() => {
                  requestFocus();
                  p.onPageChange(p.data!.page - 1);
                }}
              >
                {t("directoryPrevious")}
              </Button>
              <span>{t("directoryPage", { n: p.data.page })}</span>
              <Button
                variant="outline"
                disabled={p.busy || !p.data.hasNext}
                onClick={() => {
                  requestFocus();
                  p.onPageChange(p.data!.page + 1);
                }}
              >
                {t("directoryNext")}
              </Button>
            </nav>
          </section>
        </div>
      )}
      <AlertDialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open && !p.busy) setConfirm(null);
        }}
      >
        <AlertDialogContent
          dir={dir}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (revokeTrigger.current?.isConnected) revokeTrigger.current.focus();
            else heading.current?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{t("staffRevoke")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("staffRevokeConfirm", {
                email: confirm?.email ?? "",
                scope: confirm?.buildingId
                  ? (p.data?.buildings.find((b) => b.id === confirm.buildingId)?.name ?? "")
                  : t("allBuildings"),
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={p.busy}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={p.busy}
              onClick={async (e) => {
                e.preventDefault();
                if (confirm) {
                  requestFocus();
                  await p.onRemove(confirm.id);
                  setConfirm(null);
                }
              }}
            >
              {t("staffRevoke")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
