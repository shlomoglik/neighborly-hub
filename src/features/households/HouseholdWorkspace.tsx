"use client";
import { HouseholdNavigationContext } from "./HouseholdNavigationContext";
import { RefreshButton } from "@/components/community/RefreshButton";
import { useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { TKey } from "@/lib/i18n/dictionary";
import { HouseholdDetailsContent } from "@/components/community/HouseholdPanel";
import { ContactCard, ContactCardDetails } from "@/components/community/ContactCard";
import { ContactForm, toVisibility } from "./ContactForm";
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
const emptyContact: ContactFields = {
  kind: "phone",
  value: "",
  label: null,
  visibility: "managers",
};
function sameContact(a: ContactFields, b: ContactFields) {
  return (
    a.kind === b.kind && a.value === b.value && a.label === b.label && a.visibility === b.visibility
  );
}
const failureMessages: Partial<Record<string, TKey>> = {
  STALE_HOUSEHOLD: "homeStale",
  DUPLICATE_CONTACT: "homeDuplicate",
  CONTACT_LIMIT: "homeContactLimit",
  INVALID_INPUT: "homeInvalid",
};
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
  refreshing?: boolean;
  error: string | null;
  onRefresh: () => void;
  onClearError?: () => void;
  onPage: (page: number) => void;
  onSave: (input: HouseholdMutation) => Promise<boolean>;
};
export function HouseholdWorkspace({
  status,
  data,
  busy,
  refreshing = false,
  error,
  onRefresh,
  onClearError,
  onPage,
  onSave,
}: HouseholdWorkspaceProps) {
  const { t } = useI18n();
  const shared = useContext(HouseholdNavigationContext);
  const Heading = shared ? "h2" : "h1";
  const [editor, setEditor] = useState<Editor | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [saved, setSaved] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const restoreFocus = useRef(false);
  const contactsHeading = useRef<HTMLHeadingElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const editButtons = useRef(new Map<string, HTMLButtonElement>());
  const deleteButtons = useRef(new Map<string, HTMLButtonElement>());
  const contactFocus = useRef<{ kind: "add" | "edit" | "delete"; id?: string } | null>(null);
  useEffect(() => {
    if (status === "expired" || status === "unavailable") {
      setEditor(null);
      setSaved(false);
      contactFocus.current = null;
    }
    if (status === "ready" && !refreshing && restoreFocus.current) {
      heading.current?.focus();
      restoreFocus.current = false;
    }
  }, [status, refreshing]);
  useEffect(() => {
    if (
      status === "ready" &&
      data &&
      editor &&
      (editor.type === "name" ? !data.canRename : data.ownContacts === null)
    )
      setEditor(null);
  }, [status, data, editor]);
  useEffect(() => {
    const target = contactFocus.current;
    if (status !== "ready" || editor || busy || !target) return;
    const button =
      target.kind === "add"
        ? addButton.current
        : target.id &&
          (target.kind === "edit" ? editButtons : deleteButtons).current.get(target.id);
    (button && !button.disabled ? button : contactsHeading.current)?.focus();
    contactFocus.current = null;
  }, [status, editor, busy]);

  const contactDraft = editor?.type === "contact" ? editor : null;
  const contactDirty =
    !!contactDraft && !sameContact(contactDraft.value, contactDraft.expected ?? emptyContact);
  const savedContact = data?.ownContacts?.find((contact) => contact.id === contactDraft?.id);
  const contactStale =
    !!contactDraft &&
    (error === "STALE_HOUSEHOLD" ||
      (!!contactDraft.expected &&
        (!savedContact || !sameContact(savedContact, contactDraft.expected))));
  const open = (value: Editor) => {
    onClearError?.();
    setEditor(value);
    setInvalid(false);
    setSaved(false);
  };
  const closeEditor = (completed = false) => {
    if (editor?.type === "contact") {
      contactFocus.current = editor.id ? { kind: "edit", id: editor.id } : { kind: "add" };
    } else if (editor?.type === "delete") {
      contactFocus.current = completed ? { kind: "add" } : { kind: "delete", id: editor.id };
    }
    onClearError?.();
    setEditor(null);
  };
  const submit = async () => {
    if (!editor || busy || (editor.type === "contact" && (!contactDirty || contactStale))) return;
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
      closeEditor(true);
      setSaved(true);
      if (editor.type === "name") restoreFocus.current = true;
    }
  };
  const changeContact = (value: Partial<ContactFields>) =>
    setEditor((e) => (e?.type === "contact" ? { ...e, value: { ...e.value, ...value } } : e));
  const feedback = (code: string) => (
    <p role="alert" className="text-sm text-destructive">
      {t(failureMessages[code] ?? "homeUncertain")}
    </p>
  );
  const contactForm = contactDraft && (
    <ContactForm
      value={contactDraft.value}
      adding={!contactDraft.id}
      busy={busy}
      canSave={
        contactDirty &&
        !contactStale &&
        householdMutation.safeParse(
          contactDraft.id
            ? {
                action: "updateContact",
                id: contactDraft.id,
                contact: contactDraft.value,
                expected: contactDraft.expected,
              }
            : { action: "addContact", contact: contactDraft.value },
        ).success
      }
      feedback={
        contactStale ? (
          <>
            {feedback("STALE_HOUSEHOLD")}
            <Button type="button" variant="outline" onClick={onRefresh}>
              {t("refreshDirectory")}
            </Button>
          </>
        ) : error ? (
          feedback(error)
        ) : null
      }
      onChange={changeContact}
      onSubmit={() => void submit()}
      onCancel={() => closeEditor()}
    />
  );
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Heading ref={heading} tabIndex={-1} className="text-2xl font-bold">
          {t(shared ? "details" : "family")}
        </Heading>
        <div className="ms-auto flex max-w-full shrink-0 flex-wrap items-center justify-end gap-2">
          <RefreshButton
            onClick={onRefresh}
            disabled={busy || refreshing || status === "loading"}
            label={t("refreshDirectory")}
          />
        </div>
      </div>
      {!shared && (
        <Link
          href="/directory"
          className="inline-flex min-h-11 items-center text-primary underline"
        >
          {t("back")}
        </Link>
      )}
      <HouseholdFeedback status={status} onRefresh={onRefresh} />
      {status === "ready" && data && (
        <div className="community-enter space-y-5">
          {!shared && (
            <p className="text-muted-foreground">
              <bdi>{data.project}</bdi>
            </p>
          )}
          <HouseholdDetailsContent
            hideHeading={!!shared}
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
              disabled={busy || refreshing || data.page <= 1}
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
              disabled={busy || refreshing || !data.hasNext}
              onClick={() => {
                restoreFocus.current = true;
                onPage(data.page + 1);
              }}
            >
              {t("directoryNext")}
            </Button>
          </nav>
          {data.canRename && !shared && (
            <Button variant="outline" asChild>
              <Link href={`/household/${data.id}/members`}>{t("familyManage")}</Link>
            </Button>
          )}
          {data.canRename && (
            <Button
              variant="outline"
              disabled={busy || contactDirty}
              onClick={() => open({ type: "name", value: data.name, expected: data.name })}
            >
              {t("homeRename")}
            </Button>
          )}
          {data.ownContacts !== null && (
            <section className="min-w-0 space-y-3 rounded-2xl border bg-card p-4">
              <h2 ref={contactsHeading} tabIndex={-1} className="text-xl font-semibold">
                {t("homeMyContacts")}
              </h2>
              <p className="text-sm text-muted-foreground">{t("homeGlobalContacts")}</p>
              {data.ownContacts.length === 0 && !contactDraft && <p>{t("homeNoContacts")}</p>}
              {data.ownContacts.map(({ id, ...contact }) => (
                <ContactCard key={id}>
                  {contactDraft?.id === id ? (
                    contactForm
                  ) : (
                    <ContactCardDetails
                      {...contact}
                      visibility={toVisibility(contact.visibility)}
                      actions={
                        <>
                          <Button
                            ref={(node) => {
                              if (node) editButtons.current.set(id, node);
                              else editButtons.current.delete(id);
                            }}
                            variant="outline"
                            size="icon"
                            disabled={busy || contactDirty}
                            aria-label={t("homeEditContact", { value: contact.value })}
                            onClick={() =>
                              open({ type: "contact", id, value: contact, expected: contact })
                            }
                          >
                            <Pencil aria-hidden="true" />
                          </Button>
                          <Button
                            ref={(node) => {
                              if (node) deleteButtons.current.set(id, node);
                              else deleteButtons.current.delete(id);
                            }}
                            variant="ghost"
                            size="icon"
                            disabled={busy || contactDirty}
                            aria-label={t("homeDeleteContact", { value: contact.value })}
                            onClick={() => open({ type: "delete", id, expected: contact })}
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </>
                      }
                    />
                  )}
                </ContactCard>
              ))}
              {contactDraft && !savedContact && <ContactCard>{contactForm}</ContactCard>}
              <Button
                ref={addButton}
                disabled={
                  busy ||
                  contactDirty ||
                  !!(contactDraft && !contactDraft.id) ||
                  data.ownContacts.length >= 10
                }
                onClick={() => open({ type: "contact", value: emptyContact })}
              >
                {t("homeAddContact")}
              </Button>
            </section>
          )}
          {editor?.type === "name" && (
            <form
              className="community-enter space-y-4 rounded-2xl border bg-card p-4"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <fieldset disabled={busy} className="space-y-4">
                <legend className="mb-3 font-semibold">{t("homeRename")}</legend>
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
                {invalid && <p role="alert">{t("homeInvalid")}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit">{t(busy ? "saving" : "save")}</Button>
                  <Button type="button" variant="outline" onClick={() => closeEditor()}>
                    {t("cancel")}
                  </Button>
                </div>
              </fieldset>
            </form>
          )}
          {error && (!editor || editor.type === "name") && feedback(error)}
          {saved && <p role="status">{t("homeSaved")}</p>}
          <AlertDialog
            open={editor?.type === "delete"}
            onOpenChange={(open) => {
              if (!open && !busy) closeEditor();
            }}
          >
            <AlertDialogContent onCloseAutoFocus={(event) => event.preventDefault()}>
              <AlertDialogTitle>{t("homeDeleteTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{t("homeDeleteHint")}</AlertDialogDescription>
              {error && editor?.type === "delete" && feedback(error)}
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
