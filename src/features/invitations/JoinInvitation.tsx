"use client";
import { RefreshButton } from "@/components/community/RefreshButton";
import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { joinInput, type JoinInput, type JoinContext } from "@/lib/access/invitation-contracts";
import { InvitationFeedback, InvitationPagination, invitationErrorKey } from "./InvitationFeedback";
import { JoinRequestGuidance } from "./JoinRequestGuidance";
import type { ResourceStatus } from "./use-invitation-resource";
export type JoinInvitationProps = {
  signInHref?: string;
  status: ResourceStatus;
  data: JoinContext | null;
  busy: boolean;
  error: string | null;
  onSubmit: (input: JoinInput) => Promise<void>;
  onRefresh: () => void;
  onPage: (page: number) => void;
};
export function JoinInvitation(p: JoinInvitationProps) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [family, setFamily] = useState("");
  const [apartmentId, setApartment] = useState("");
  const data = p.data;
  const selected = data?.fixedApartmentId ?? apartmentId;
  const input = joinInput.safeParse(
    data?.kind === "resident"
      ? { apartmentId: selected, fullName: name, householdName: family }
      : data?.kind === "household_member"
        ? { fullName: name }
        : {},
  );
  const valid =
    input.success && (data?.kind !== "resident" || data.apartments.some((a) => a.id === selected));
  return (
    <section className="mx-auto max-w-2xl space-y-5 break-words">
      <h1 className="text-2xl font-bold">{t("joinTitle")}</h1>
      <Link className="text-primary underline" href="/account#join-requests">
        {t("inviteMyRequests")}
      </Link>
      <InvitationFeedback status={p.status} onRetry={p.onRefresh} signInHref={p.signInHref} />
      {p.status === "unavailable" && <p>{t("joinInactiveNext")}</p>}
      {p.error && (
        <div role="alert" className="space-y-2">
          <p>{t(invitationErrorKey(p.error))}</p>
          <div className="flex justify-end">
            <RefreshButton disabled={p.busy} onClick={p.onRefresh} label={t("refreshManagement")} />
          </div>
        </div>
      )}
      {p.status === "ready" && data && (
        <div className="community-enter space-y-4 rounded-2xl border bg-card p-4">
          <h2 className="text-xl font-bold">
            <bdi>{data.projectName}</bdi>
          </h2>
          <p>
            <bdi>{data.buildingName}</bdi> ·{" "}
            {t(data.kind === "resident" ? "inviteResident" : data.kind)}
          </p>
          {data.request ? (
            <div className="space-y-3">
              <p role="status">
                {t(
                  data.request.status === "pending"
                    ? "invitePending"
                    : data.request.status === "approved"
                      ? "inviteApproved"
                      : "inviteRejected",
                )}
              </p>
              <JoinRequestGuidance
                status={data.request.status}
                kind={data.kind}
                active={data.active}
              />
              <Link href="/account#join-requests" className="text-primary underline">
                {t("inviteMyRequests")}
              </Link>
            </div>
          ) : !data.active ? (
            <p role="status">{t("joinInactiveNext")}</p>
          ) : (
            <form
              className="space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                if (valid && input.success && data.active && !p.busy && !p.error)
                  await p.onSubmit(input.data);
              }}
            >
              <p>{t("inviteJoinHint")}</p>
              {data.kind === "resident" && <p>{t("joinFirstResident")}</p>}
              {(data.kind === "resident" || data.kind === "household_member") && (
                <aside
                  aria-labelledby="join-participation"
                  className="space-y-3 rounded-xl border p-3 text-sm"
                >
                  <h3 id="join-participation" className="font-semibold">
                    {t("joinParticipation")}
                  </h3>
                  <p>{t("joinListingScope")}</p>
                  <p>{t("joinContactPrivacy")}</p>
                  <p>{t("joinChildrenPrivacy")}</p>
                  <p>{t("joinParticipationNotice")}</p>
                </aside>
              )}
              <fieldset className="space-y-3" disabled={p.busy || !data.active}>
                {data.kind === "household_member" && (
                  <>
                    <p>{t("familyJoinHint")}</p>
                    {data.apartments[0] && (
                      <p>
                        {t("apartment")} <bdi>{data.apartments[0].number}</bdi>
                      </p>
                    )}
                    <label className="block space-y-2">
                      <span>{t("fullName")}</span>
                      <Input
                        required
                        autoComplete="name"
                        maxLength={200}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </label>
                    <p className="text-sm text-muted-foreground">{t("inviteIdentityReuse")}</p>
                  </>
                )}
                {data.kind === "resident" && (
                  <>
                    <label className="block space-y-2">
                      <span>{t("apartment")}</span>
                      <select
                        className="min-h-11 w-full rounded-xl border bg-card px-3"
                        required
                        value={selected}
                        disabled={!!data.fixedApartmentId}
                        onChange={(e) => setApartment(e.target.value)}
                      >
                        <option value="">{t("inviteChooseApartment")}</option>
                        {data.apartments.map((a) => (
                          <option key={a.id} value={a.id}>
                            {t("floor")} {a.floor} · {t("apartment")} {a.number}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-2">
                      <span>{t("fullName")}</span>
                      <Input
                        required
                        autoComplete="name"
                        maxLength={200}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </label>
                    <label className="block space-y-2">
                      <span>{t("familyName")}</span>
                      <Input
                        required
                        maxLength={200}
                        value={family}
                        onChange={(e) => setFamily(e.target.value)}
                      />
                    </label>
                    <p className="text-sm text-muted-foreground">{t("inviteIdentityReuse")}</p>
                  </>
                )}
                <Button type="submit" loading={p.busy} disabled={!valid || !!p.error}>
                  {t("inviteSubmit")}
                </Button>
              </fieldset>
              {data.kind === "resident" && !data.fixedApartmentId && (
                <InvitationPagination
                  page={data.page}
                  hasNext={data.hasNext}
                  busy={p.busy}
                  onPage={(n) => {
                    setApartment("");
                    p.onPage(n);
                  }}
                />
              )}
            </form>
          )}
        </div>
      )}
    </section>
  );
}
