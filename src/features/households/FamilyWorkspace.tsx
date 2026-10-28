"use client";
import { HouseholdNavigationContext } from "./HouseholdNavigationContext";
import { RefreshButton } from "@/components/community/RefreshButton";
import { useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useI18n, type TKey } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MemberRow } from "@/components/community/MemberRow";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { InvitationPagination } from "@/features/invitations/InvitationFeedback";
import { InvitationShare } from "@/features/invitations/InvitationShare";
import type { ResourceStatus } from "@/features/shared/use-private-resource";
import {
  familyMutation,
  type FamilyPage,
  type FamilyMember,
  type FamilyMutation,
} from "@/lib/access/family-contracts";
import {
  householdInvitationInput,
  type HouseholdInvitationInput,
  type InvitationPage,
} from "@/lib/access/invitation-contracts";
import { HouseholdFeedback } from "./HouseholdWorkspace";
type Editor = { requestId: string; member?: FamilyMember; name: string; relation: string };
export type FamilyWorkspaceProps = {
  id: string;
  status: ResourceStatus;
  data: { family: FamilyPage; invitations: InvitationPage } | null;
  busy: boolean;
  error: string | null;
  created: { id: string; url: string; email: string } | null;
  onRefresh: () => void;
  onPage: (page: number) => void;
  onInvitationPage: (page: number) => void;
  onMutate: (input: FamilyMutation) => Promise<boolean>;
  onInvite: (input: HouseholdInvitationInput) => Promise<boolean>;
  onRenew: (id: string) => Promise<boolean>;
  onRevoke: (id: string) => Promise<boolean>;
};
const errors: Record<string, TKey> = {
  STALE_FAMILY: "familyStale",
  REQUEST_REVIEWED: "inviteReviewed",
  FAMILY_LIMIT: "familyLimit",
  FAMILY_INVITE_LIMIT: "familyInviteLimit",
  INVALID_INPUT: "familyInvalid",
};
const errorKey = (code: string): TKey => errors[code] ?? "homeUncertain";
export function FamilyWorkspace(p: FamilyWorkspaceProps) {
  const { t, lang } = useI18n();
  const shared = useContext(HouseholdNavigationContext);
  const Heading = shared ? "h2" : "h1";
  const [editor, setEditor] = useState<Editor | null>(null);
  const [remove, setRemove] = useState<FamilyMember | null>(null);
  const [revoke, setRevoke] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [days, setDays] = useState(7);
  const [invalid, setInvalid] = useState(false);
  const [saved, setSaved] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusAfter = useRef(false);
  useEffect(() => {
    if (p.status === "expired" || p.status === "unavailable") {
      setEditor(null);
      setRemove(null);
      setRevoke(null);
      setEmail("");
      setSaved(false);
    }
    if (p.status === "ready" && focusAfter.current) {
      heading.current?.focus();
      focusAfter.current = false;
    }
  }, [p.status]);
  const open = (member?: FamilyMember) => {
    setEditor({
      requestId: crypto.randomUUID(),
      member,
      name: member?.name ?? "",
      relation: member?.relation ?? "",
    });
    setInvalid(false);
    setSaved(false);
  };
  const finish = () => {
    setEditor(null);
    setRemove(null);
    setRevoke(null);
    setSaved(true);
    focusAfter.current = true;
  };
  const submit = async () => {
    if (!editor || p.busy) return;
    const profile = { name: editor.name, relation: editor.relation.trim() || null };
    const parsed = familyMutation.safeParse(
      editor.member
        ? {
            action: "updateChild",
            id: editor.member.id,
            profile,
            expected: { name: editor.member.name, relation: editor.member.relation },
          }
        : { action: "addChild", requestId: editor.requestId, profile },
    );
    if (!parsed.success) {
      setInvalid(true);
      return;
    }
    if (await p.onMutate(parsed.data)) finish();
  };
  const invite = householdInvitationInput.safeParse({
    ...(email.trim() ? { recipientEmail: email } : {}),
    expiresInDays: days,
  });
  return (
    <section className="space-y-5">
      {!shared && (
        <Link
          href={`/household/${p.id}`}
          className="inline-flex min-h-11 items-center text-primary underline"
        >
          {t("back")}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading ref={heading} tabIndex={-1} className="text-2xl font-bold">
          {t("familyManage")}
        </Heading>
        <div className="ms-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2">
          <RefreshButton
            disabled={p.busy || p.status === "loading"}
            onClick={p.onRefresh}
            label={t("refreshDirectory")}
          />
        </div>
      </div>
      <HouseholdFeedback status={p.status} onRefresh={p.onRefresh} />
      {p.status === "ready" && p.data && (
        <div className="community-enter space-y-5">
          {!shared && (
            <h2 className="text-xl font-semibold">
              <bdi>{p.data.family.name}</bdi>
            </h2>
          )}
          <p>{t("familyPrivateHint")}</p>
          <ul className="space-y-3">
            {p.data.family.members.map((member) => (
              <li key={member.id} className="space-y-2">
                <MemberRow
                  member={{
                    id: member.id,
                    name: member.name,
                    relation: member.relation ?? undefined,
                    child: member.child,
                    primary: member.representative,
                    contacts: [],
                  }}
                />
                {member.editable && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      disabled={p.busy}
                      onClick={() => open(member)}
                      aria-label={t("familyEditChild", { name: member.name })}
                    >
                      {t("edit")}
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={p.busy}
                      onClick={() => {
                        setRemove(member);
                        setSaved(false);
                      }}
                      aria-label={t("familyRemoveChild", { name: member.name })}
                    >
                      {t("delete")}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <InvitationPagination
            page={p.data.family.page}
            hasNext={p.data.family.hasNext}
            busy={p.busy}
            onPage={(page) => {
              focusAfter.current = true;
              p.onPage(page);
            }}
          />
          <Button disabled={p.busy || !p.data.family.canAdd} onClick={() => open()}>
            {t("familyAddChild")}
          </Button>
          {editor && (
            <form
              className="community-enter space-y-4 rounded-2xl border bg-card p-4"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <fieldset disabled={p.busy} className="space-y-3">
                <legend className="mb-3 font-semibold">
                  {t(editor.member ? "familyChildEditor" : "familyAddChild")}
                </legend>
                <label className="block space-y-2">
                  <span>{t("fullName")}</span>
                  <Input
                    autoFocus
                    required
                    maxLength={200}
                    value={editor.name}
                    onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                  />
                </label>
                <label className="block space-y-2">
                  <span>{t("familyRelation")}</span>
                  <Input
                    maxLength={100}
                    value={editor.relation}
                    onChange={(e) => setEditor({ ...editor, relation: e.target.value })}
                  />
                </label>
                {invalid && <p role="alert">{t("familyInvalid")}</p>}
                <div className="flex gap-2">
                  <Button type="submit" loading={p.busy}>
                    {t("save")}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setEditor(null)}>
                    {t("cancel")}
                  </Button>
                </div>
              </fieldset>
            </form>
          )}
          <section className="space-y-4 rounded-2xl border bg-card p-4">
            <h2 className="text-xl font-semibold">{t("familyInviteAdult")}</h2>
            <p>{t("familyInviteHint")}</p>
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                if (invite.success && !p.busy && !p.error && (await p.onInvite(invite.data))) {
                  setEmail("");
                  setSaved(false);
                }
              }}
            >
              <fieldset disabled={p.busy || !!p.error} className="space-y-3">
                <label className="block space-y-2">
                  <span>{t("inviteRecipientEmail")}</span>
                  <Input
                    dir="ltr"
                    type="email"
                    maxLength={254}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label className="block space-y-2">
                  <span>{t("inviteExpires")}</span>
                  <Input
                    type="number"
                    min={1}
                    max={90}
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                  />
                </label>
                <Button
                  type="submit"
                  loading={p.busy}
                  disabled={!invite.success || !p.data.family.canAdd}
                >
                  {t("inviteCreate")}
                </Button>
              </fieldset>
            </form>
          </section>
          {p.created && (
            <InvitationShare
              url={p.created.url}
              projectName={p.data.family.projectName}
              email={p.created.email}
            />
          )}
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">{t("inviteLinks")}</h2>
            {!p.data.invitations.invitations.length && <p>{t("inviteNoLinks")}</p>}
            <ul className="space-y-3">
              {p.data.invitations.invitations.map((i) => (
                <li key={i.id} className="space-y-2 rounded-xl border bg-card p-4">
                  <p>{t("household_member")}</p>
                  {i.recipientEmail && (
                    <p>
                      <bdi dir="ltr">{i.recipientEmail}</bdi>
                    </p>
                  )}
                  <p>
                    {t("inviteExpiryValue", {
                      value: new Date(i.expiresAt).toLocaleDateString(lang),
                    })}
                  </p>
                  <p>
                    {t(
                      i.revoked || Date.parse(i.expiresAt) <= Date.now()
                        ? "inviteInactive"
                        : i.consumed
                          ? "familyInviteUsed"
                          : "inviteActive",
                    )}
                  </p>
                  <Button variant="outline" disabled={p.busy} onClick={() => p.onRenew(i.id)}>
                    {t("inviteRenew")}
                  </Button>
                  <p className="text-sm text-muted-foreground">{t("inviteRenewHint")}</p>
                  <Button
                    variant="outline"
                    disabled={p.busy || i.revoked}
                    onClick={() => setRevoke(i.id)}
                  >
                    {t("inviteRevoke")}
                  </Button>
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
          {p.error && (
            <p role="alert" className="text-destructive">
              {t(errorKey(p.error))}
            </p>
          )}
          {saved && <p role="status">{t("homeSaved")}</p>}
          <AlertDialog
            open={!!remove || !!revoke}
            onOpenChange={(open) => {
              if (!open && !p.busy) {
                setRemove(null);
                setRevoke(null);
              }
            }}
          >
            <AlertDialogContent>
              <AlertDialogTitle>
                {t(remove ? "familyRemoveTitle" : "inviteRevoke")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t(remove ? "familyRemoveHint" : "inviteRevokeConfirm")}
              </AlertDialogDescription>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={p.busy}>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  disabled={p.busy}
                  onClick={async (e) => {
                    e.preventDefault();
                    const ok = remove
                      ? await p.onMutate({
                          action: "removeChild",
                          id: remove.id,
                          expected: { name: remove.name, relation: remove.relation },
                        })
                      : revoke
                        ? await p.onRevoke(revoke)
                        : false;
                    if (ok) finish();
                  }}
                >
                  {t("confirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </section>
  );
}
