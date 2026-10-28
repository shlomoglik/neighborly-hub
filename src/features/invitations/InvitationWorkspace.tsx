"use client";
import type { StaffInput, StaffRecipient } from "@/lib/access/staff-contracts";
import { Plus } from "lucide-react";
import { ResponsiveFormDialog } from "@/components/community/ResponsiveFormDialog";
import { CommunitySkeleton } from "@/components/community/CommunityLoading";
import { RefreshButton } from "@/components/community/RefreshButton";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ManagementHierarchy } from "@/lib/access/management-contracts";
import {
  invitationInput,
  type InvitationInput,
  type InvitationPage,
  type RequestPage,
} from "@/lib/access/invitation-contracts";
import { useStaffRecipient } from "./use-staff-recipient";
import { InvitationShare } from "./InvitationShare";
import { RequestList } from "./RequestList";
import { InvitationFeedback, InvitationPagination, invitationErrorKey } from "./InvitationFeedback";
import type { ResourceStatus } from "./use-invitation-resource";
export type InvitationWorkspaceProps = {
  projectId: string;
  status: ResourceStatus;
  data: {
    hierarchy: ManagementHierarchy;
    invitations: InvitationPage;
    requests: RequestPage;
  } | null;
  busy: boolean;
  error: string | null;
  created: {
    id: string;
    url: string;
    email: string;
    kind: InvitationInput["kind"];
    buildingId: string | null;
  } | null;
  contacts?: { name: string; phone: string }[];
  onInspectRecipient: (input: StaffInput, signal: AbortSignal) => Promise<StaffRecipient>;
  onRenew: (id: string) => Promise<void>;
  onCreate: (input: InvitationInput) => Promise<boolean>;
  onRevoke: (id: string) => Promise<void>;
  onReview: (id: string, decision: "approve" | "reject") => Promise<boolean>;
  onRefresh: () => void;
  onInvitationPage: (n: number) => void;
  onRequestPage: (n: number) => void;
  contactSearch?: {
    value: string;
    onChange: (value: string) => void;
    loading: boolean;
    error?: boolean;
  };
};
export function InvitationWorkspace(p: InvitationWorkspaceProps) {
  const { t, lang } = useI18n();
  const [creating, setCreating] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const [kind, setKind] = useState<InvitationInput["kind"]>("resident");
  const [buildingId, setBuilding] = useState("");
  const [apartmentId, setApartment] = useState("");
  const [email, setEmail] = useState("");
  const [days, setDays] = useState(7);
  const [revoke, setRevoke] = useState<string | null>(null);
  useEffect(() => {
    if (p.status !== "ready" && p.status !== "loading") setCreating(false);
    if (p.status === "expired" || p.status === "unavailable") {
      setEmail("");
      setBuilding("");
      setApartment("");
    }
  }, [p.status]);
  const hierarchy = p.data?.hierarchy;
  const selected = hierarchy?.buildings.find((b) => b.id === buildingId);
  const input = invitationInput.safeParse({
    kind,
    ...(kind !== "project_manager" ? { buildingId } : {}),
    ...(kind === "resident" ? { apartmentId: apartmentId || null } : {}),
    ...(email.trim() ? { recipientEmail: email } : {}),
    expiresInDays: days,
  });
  const recipient = useStaffRecipient(
    creating && input.success && input.data.kind !== "resident"
      ? ({
          email: input.data.recipientEmail,
          role: input.data.kind,
          buildingId: input.data.kind === "project_manager" ? null : input.data.buildingId,
        } as StaffInput)
      : null,
    p.onInspectRecipient,
  );
  const valid =
    input.success &&
    (kind === "resident" || (!!recipient.data && recipient.data.role !== "assigned")) &&
    (kind === "project_manager" ? !!p.data?.invitations.canInviteStaff : !!selected) &&
    (kind === "resident" || p.data?.invitations.canInviteStaff) &&
    (!apartmentId || selected?.floors.some((f) => f.apartments.some((a) => a.id === apartmentId)));
  const shareAllowed =
    !!p.created &&
    !!p.data &&
    (p.created.kind === "resident"
      ? p.data.hierarchy.buildings.some((b) => b.id === p.created!.buildingId)
      : p.data.invitations.canInviteStaff);
  return (
    <section className="space-y-5 break-words">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 ref={heading} className="font-heading text-2xl font-normal" tabIndex={-1}>
          {t("inviteManagement")}
        </h2>
        <div className="ms-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2">
          {((p.status === "ready" && p.data) || (creating && p.status === "loading")) && (
            <ResponsiveFormDialog
              open={creating}
              onOpenChange={(open) => {
                if (open) {
                  setKind("resident");
                  setBuilding("");
                  setApartment("");
                  setEmail("");
                  setDays(7);
                }
                setCreating(open);
              }}
              title={t("inviteCreate")}
              description={t("inviteApprovalHint")}
              busy={p.busy}
              fallbackFocus={heading}
              trigger={
                <Button disabled={p.busy || p.status === "loading"}>
                  <Plus aria-hidden />
                  {t("inviteCreate")}
                </Button>
              }
            >
              {p.status === "ready" && p.data ? (
                <form
                  className="space-y-3"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (
                      valid &&
                      input.success &&
                      !p.busy &&
                      !p.error &&
                      (await p.onCreate(input.data))
                    )
                      setCreating(false);
                  }}
                >
                  {p.error && (
                    <div role="alert" className="space-y-2">
                      <p>{t(invitationErrorKey(p.error))}</p>
                      <RefreshButton
                        disabled={p.busy}
                        onClick={() => {
                          setCreating(false);
                          p.onRefresh();
                        }}
                        label={t("refreshManagement")}
                      />
                    </div>
                  )}
                  <fieldset disabled={p.busy} className="space-y-3">
                    <label className="block space-y-2">
                      <span>{t("inviteKind")}</span>
                      <select
                        className="min-h-11 w-full rounded-xl border bg-card px-3"
                        value={kind}
                        onChange={(e) => {
                          setKind(e.target.value as InvitationInput["kind"]);
                          setApartment("");
                        }}
                      >
                        <option value="resident">{t("inviteResident")}</option>
                        {p.data.invitations.canInviteStaff && (
                          <>
                            <option value="project_manager">{t("project_manager")}</option>
                            <option value="building_manager">{t("building_manager")}</option>
                          </>
                        )}
                      </select>
                    </label>
                    {kind !== "project_manager" && (
                      <label className="block space-y-2">
                        <span>{t("building")}</span>
                        <select
                          required
                          className="min-h-11 w-full rounded-xl border bg-card px-3"
                          value={buildingId}
                          onChange={(e) => {
                            setBuilding(e.target.value);
                            setApartment("");
                          }}
                        >
                          <option value="">{t("filterBuilding")}</option>
                          {hierarchy!.buildings.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {kind === "resident" && (
                      <label className="block space-y-2">
                        <span>{t("apartment")}</span>
                        <select
                          className="min-h-11 w-full rounded-xl border bg-card px-3"
                          value={apartmentId}
                          onChange={(e) => setApartment(e.target.value)}
                        >
                          <option value="">{t("inviteWholeBuilding")}</option>
                          {selected?.floors.flatMap((f) =>
                            f.apartments.map((a) => (
                              <option key={a.id} value={a.id}>
                                {t("floor")} {f.number} · {t("apartment")} {a.number}
                              </option>
                            )),
                          )}
                        </select>
                      </label>
                    )}
                    <label className="block space-y-2">
                      <span>{t("inviteRecipientEmail")}</span>
                      <Input
                        required={kind !== "resident"}
                        type="email"
                        maxLength={254}
                        dir="ltr"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </label>
                    {kind !== "resident" && (
                      <p
                        role={
                          recipient.failed || recipient.data?.role === "assigned"
                            ? "alert"
                            : "status"
                        }
                        className="text-sm text-muted-foreground"
                      >
                        {t(
                          recipient.failed
                            ? "recipientCheckFailed"
                            : recipient.data?.role === "assigned"
                              ? "staffAlreadyHasRole"
                              : recipient.data?.role === "upgrade"
                                ? "staffUpgradeHint"
                                : recipient.data?.account === "existing"
                                  ? "inviteExistingAccount"
                                  : recipient.data?.account === "new"
                                    ? "inviteNewAccount"
                                    : "recipientCheckHint",
                        )}
                      </p>
                    )}
                    <label className="block space-y-2">
                      <span>{t("inviteExpires")}</span>
                      <Input
                        type="number"
                        required
                        min={1}
                        max={90}
                        step={1}
                        value={Number.isNaN(days) ? "" : days}
                        onChange={(e) => setDays(e.target.value ? Number(e.target.value) : NaN)}
                      />
                    </label>
                    <p className="text-sm text-muted-foreground">{t("inviteReuseHint")}</p>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setCreating(false)}>
                        {t("cancel")}
                      </Button>
                      <Button type="submit" disabled={!valid || !!p.error} loading={p.busy}>
                        {t("inviteCreate")}
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
            onClick={p.onRefresh}
            label={t("refreshManagement")}
          />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{t("inviteApprovalHint")}</p>
      {p.error && !creating && <p role="alert">{t(invitationErrorKey(p.error))}</p>}
      <InvitationFeedback status={p.status} onRetry={p.onRefresh} />
      {p.status === "ready" && p.data && (
        <div className="community-enter space-y-5">
          {shareAllowed && p.created && (
            <div className="space-y-3">
              {p.contactSearch && (
                <label className="invitation-no-print block space-y-2">
                  <span>{t("inviteContactSearch")}</span>
                  <Input
                    value={p.contactSearch.value}
                    onChange={(e) => p.contactSearch!.onChange(e.target.value)}
                    maxLength={100}
                  />
                  {p.contactSearch.loading && <span role="status">{t("loading")}</span>}
                  {p.contactSearch.error && <span role="alert">{t("loadError")}</span>}
                </label>
              )}
              <InvitationShare
                url={p.created.url}
                projectName={hierarchy!.name}
                email={p.created.email}
                contacts={p.contacts}
              />
            </div>
          )}
          <section className="space-y-3">
            <h2 className="text-xl font-bold">{t("inviteLinks")}</h2>
            {!p.data.invitations.invitations.length && <p role="status">{t("inviteNoLinks")}</p>}
            <ul className="space-y-3">
              {p.data.invitations.invitations.map((i) => (
                <li key={i.id} className="space-y-2 rounded-xl border bg-card p-4">
                  <p>
                    {t(i.kind === "resident" ? "inviteResident" : i.kind)} ·{" "}
                    <bdi>
                      {hierarchy!.buildings.find((b) => b.id === i.buildingId)?.name ??
                        hierarchy!.name}
                    </bdi>
                  </p>
                  <p>
                    <bdi>{i.recipientEmail}</bdi>
                  </p>
                  <p>
                    {t("inviteExpiryValue", {
                      value: new Date(i.expiresAt).toLocaleDateString(lang),
                    })}
                  </p>
                  <p>
                    {t(
                      i.revoked
                        ? "inviteRevoked"
                        : i.consumed
                          ? "inviteConsumed"
                          : Date.parse(i.expiresAt) <= Date.now()
                            ? "inviteInactive"
                            : "inviteActive",
                    )}
                  </p>
                  {i.kind !== "household_member" && (
                    <div className="space-y-1">
                      <Button variant="outline" disabled={p.busy} onClick={() => p.onRenew(i.id)}>
                        {t("inviteRenew")}
                      </Button>
                      <p className="text-sm text-muted-foreground">{t("inviteRenewHint")}</p>
                    </div>
                  )}
                  {!i.revoked && (
                    <Button variant="outline" disabled={p.busy} onClick={() => setRevoke(i.id)}>
                      {t("inviteRevoke")}
                    </Button>
                  )}
                  {revoke === i.id && (
                    <div role="group" aria-label={t("inviteRevokeConfirm")} className="space-y-2">
                      <p>{t("inviteRevokeConfirm")}</p>
                      <Button
                        disabled={p.busy}
                        onClick={async () => {
                          await p.onRevoke(i.id);
                          setRevoke(null);
                        }}
                      >
                        {t("confirm")}
                      </Button>
                      <Button variant="ghost" disabled={p.busy} onClick={() => setRevoke(null)}>
                        {t("cancel")}
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <InvitationPagination
              page={p.data.invitations.page}
              hasNext={p.data.invitations.hasNext}
              busy={p.busy}
              onPage={p.onInvitationPage}
            />
          </section>
          <RequestList
            data={p.data.requests}
            busy={p.busy}
            onPage={p.onRequestPage}
            onReview={p.onReview}
          />
        </div>
      )}
    </section>
  );
}
