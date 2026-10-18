"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { HouseholdDetailsContent } from "@/components/community/HouseholdPanel";
import { VisibilitySelector, type Visibility } from "@/components/community/VisibilitySelector";
import { CommunitySkeleton } from "@/components/community/CommunityLoading";
import { SystemFeedback } from "@/components/community/SystemFeedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import type { ResourceStatus } from "@/features/shared/use-private-resource";
import {
  householdMutation,
  type HouseholdDetail,
  type HouseholdMutation,
  type ContactFields,
} from "@/lib/access/household-contracts";

type Editor =
  | { type: "name"; value: string; expected: string }
  | { type: "contact"; id?: string; value: ContactFields; expected?: ContactFields }
  | { type: "delete"; id: string; expected: ContactFields };
const toVisibility = (v: ContactFields["visibility"]): Visibility =>
  v === "managers" ? "admins" : v === "project" ? "complex" : "building";
const fromVisibility = (v: Visibility): ContactFields["visibility"] =>
  v === "admins" ? "managers" : v === "complex" ? "project" : "building";
export function HouseholdFeedback({
  status,
  onRefresh,
}: {
  status: ResourceStatus;
  onRefresh: () => void;
}) {
  const { t } = useI18n();
  if (status === "loading") return <CommunitySkeleton variant="details" />;
  if (status === "error") return <SystemFeedback kind="error" onRetry={onRefresh} />;
  if (status === "expired")
    return (
      <div className="space-y-3">
        <SystemFeedback kind="private" message={t("managementExpired")} />
        <Button asChild>
          <Link href="/auth">{t("signIn")}</Link>
        </Button>
      </div>
    );
  if (status === "unavailable")
    return <SystemFeedback kind="private" message={t("homeUnavailable")} onRetry={onRefresh} />;
  return null;
}
export type HouseholdWorkspaceProps = {
  status: ResourceStatus;
  data: HouseholdDetail | null;
  busy: boolean;
  error: string | null;
  onRefresh: () => void;
  onPage: (page: number) => void;
  onSave: (input: HouseholdMutation) => Promise<boolean>;
};
export function HouseholdWorkspace({
  status,
  data,
  busy,
  error,
  onRefresh,
  onPage,
  onSave,
}: HouseholdWorkspaceProps) {
  const { t } = useI18n();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [saved, setSaved] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const restoreFocus = useRef(false);
  useEffect(() => {
    if (status === "expired" || status === "unavailable") {
      setEditor(null);
      setSaved(false);
    }
    if (status === "ready" && restoreFocus.current) {
      heading.current?.focus();
      restoreFocus.current = false;
    }
  }, [status]);
  useEffect(() => {
    if (
      status === "ready" &&
      data &&
      editor &&
      (editor.type === "name" ? !data.canRename : data.ownContacts === null)
    )
      setEditor(null);
  }, [status, data, editor]);
  const open = (value: Editor) => {
    setEditor(value);
    setInvalid(false);
    setSaved(false);
  };
  const submit = async () => {
    if (!editor || busy) return;
    const input =
      editor.type === "name"
        ? { action: "rename", name: editor.value, expected: editor.expected }
        : editor.type === "delete"
          ? { action: "deleteContact", id: editor.id, expected: editor.expected }
          : editor.id
            ? {
                action: "updateContact",
                id: editor.id,
                contact: editor.value,
                expected: editor.expected,
              }
            : { action: "addContact", contact: editor.value };
    const result = householdMutation.safeParse(input);
    if (!result.success) {
      setInvalid(true);
      return;
    }
    if (await onSave(result.data)) {
      setEditor(null);
      setSaved(true);
      restoreFocus.current = true;
    }
  };
  const changeContact = (value: Partial<ContactFields>) =>
    setEditor((e) => (e?.type === "contact" ? { ...e, value: { ...e.value, ...value } } : e));
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold">
          {t("family")}
        </h1>
        <Button variant="outline" onClick={onRefresh} disabled={busy || status === "loading"}>
          {t("refreshDirectory")}
        </Button>
      </div>
      <Link href="/directory" className="inline-flex min-h-11 items-center text-primary underline">
        {t("back")}
      </Link>
      <HouseholdFeedback status={status} onRefresh={onRefresh} />
      {status === "ready" && data && (
        <div className="community-enter space-y-5">
          <p className="text-muted-foreground">
            <bdi>{data.project}</bdi>
          </p>
          <HouseholdDetailsContent
            name={data.name}
            building={data.building}
            apartment={data.apartment}
            floor={String(data.floor)}
            members={data.members.map((m) => ({
              ...m,
              contacts: m.contacts.map((c) => ({ ...c, visible: true as const })),
            }))}
          />
          <p className="text-sm text-muted-foreground">{t("homeAdultsOnly")}</p>
          <nav
            aria-label={t("homeMembersPages")}
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <Button
              variant="outline"
              disabled={busy || data.page <= 1}
              onClick={() => {
                restoreFocus.current = true;
                onPage(data.page - 1);
              }}
            >
              {t("directoryPrevious")}
            </Button>
            <span>{t("directoryPage", { n: data.page })}</span>
            <Button
              variant="outline"
              disabled={busy || !data.hasNext}
              onClick={() => {
                restoreFocus.current = true;
                onPage(data.page + 1);
              }}
            >
              {t("directoryNext")}
            </Button>
          </nav>
          {data.canRename && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => open({ type: "name", value: data.name, expected: data.name })}
            >
              {t("homeRename")}
            </Button>
          )}
          {data.ownContacts !== null && (
            <section className="space-y-3 rounded-2xl border bg-card p-4">
              <h2 className="text-xl font-semibold">{t("homeMyContacts")}</h2>
              <p className="text-sm text-muted-foreground">{t("homeGlobalContacts")}</p>
              {data.ownContacts.length === 0 && <p>{t("homeNoContacts")}</p>}
              {data.ownContacts.map(({ id, ...contact }) => (
                <div key={id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
                  <div className="min-w-0 flex-1">
                    <p>
                      <bdi dir="ltr" className="break-all">
                        {contact.value}
                      </bdi>
                    </p>
                    <p className="text-sm">
                      {contact.label && <bdi>{contact.label} · </bdi>}
                      {t(
                        contact.visibility === "managers"
                          ? "vis_managers"
                          : contact.visibility === "building"
                            ? "vis_building"
                            : "vis_project",
                      )}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    disabled={busy}
                    aria-label={t("homeEditContact", { value: contact.value })}
                    onClick={() => open({ type: "contact", id, value: contact, expected: contact })}
                  >
                    {t("edit")}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    aria-label={t("homeDeleteContact", { value: contact.value })}
                    onClick={() => open({ type: "delete", id, expected: contact })}
                  >
                    {t("delete")}
                  </Button>
                </div>
              ))}
              <Button
                disabled={busy || data.ownContacts.length >= 10}
                onClick={() =>
                  open({
                    type: "contact",
                    value: { kind: "phone", value: "", label: null, visibility: "managers" },
                  })
                }
              >
                {t("homeAddContact")}
              </Button>
            </section>
          )}
          {editor && editor.type !== "delete" && (
            <form
              className="community-enter space-y-4 rounded-2xl border bg-card p-4"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <fieldset disabled={busy} className="space-y-4">
                <legend className="mb-3 font-semibold">
                  {t(editor.type === "name" ? "homeRename" : "homeContactEditor")}
                </legend>
                {editor.type === "name" ? (
                  <label className="block space-y-2">
                    <span>{t("familyName")}</span>
                    <Input
                      autoFocus
                      required
                      maxLength={100}
                      value={editor.value}
                      onChange={(e) => setEditor({ ...editor, value: e.target.value })}
                    />
                  </label>
                ) : (
                  <>
                    <label className="block space-y-2">
                      <span>{t("homeContactKind")}</span>
                      <select
                        className="min-h-11 w-full rounded-xl border bg-card px-3"
                        value={editor.value.kind}
                        onChange={(e) =>
                          changeContact({ kind: e.target.value as "phone" | "email" })
                        }
                      >
                        <option value="phone">{t("phone")}</option>
                        <option value="email">{t("email")}</option>
                      </select>
                    </label>
                    <label className="block space-y-2">
                      <span>{t(editor.value.kind === "phone" ? "phone" : "email")}</span>
                      <Input
                        autoFocus
                        required
                        dir="ltr"
                        type={editor.value.kind === "email" ? "email" : "tel"}
                        maxLength={editor.value.kind === "email" ? 254 : 40}
                        value={editor.value.value}
                        onChange={(e) => changeContact({ value: e.target.value })}
                      />
                    </label>
                    <label className="block space-y-2">
                      <span>{t("homeContactLabel")}</span>
                      <Input
                        maxLength={50}
                        value={editor.value.label ?? ""}
                        onChange={(e) => changeContact({ label: e.target.value || null })}
                      />
                    </label>
                    <VisibilitySelector
                      value={toVisibility(editor.value.visibility)}
                      onChange={(v) => changeContact({ visibility: fromVisibility(v) })}
                    />
                  </>
                )}
                {invalid && <p role="alert">{t("homeInvalid")}</p>}
                <div className="flex gap-2">
                  <Button type="submit">{t(busy ? "saving" : "save")}</Button>
                  <Button type="button" variant="outline" onClick={() => setEditor(null)}>
                    {t("cancel")}
                  </Button>
                </div>
              </fieldset>
            </form>
          )}
          {error && (
            <p role="alert" className="text-destructive">
              {t(
                error === "STALE_HOUSEHOLD"
                  ? "homeStale"
                  : error === "DUPLICATE_CONTACT"
                    ? "homeDuplicate"
                    : error === "CONTACT_LIMIT"
                      ? "homeContactLimit"
                      : error === "INVALID_INPUT"
                        ? "homeInvalid"
                        : "homeUncertain",
              )}
            </p>
          )}
          {saved && <p role="status">{t("homeSaved")}</p>}
          <AlertDialog
            open={editor?.type === "delete"}
            onOpenChange={(open) => {
              if (!open && !busy) setEditor(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogTitle>{t("homeDeleteTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{t("homeDeleteHint")}</AlertDialogDescription>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction
                  disabled={busy}
                  onClick={(e) => {
                    e.preventDefault();
                    void submit();
                  }}
                >
                  {t("delete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </section>
  );
}
