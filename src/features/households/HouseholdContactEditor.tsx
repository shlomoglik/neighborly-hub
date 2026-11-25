"use client";

import { useContext, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { usePrivateAction } from "@/features/shared/use-private-action";
import {
  householdMutation,
  sameContact,
  type ContactChange,
  type ContactFields,
  type HouseholdMutation,
  type SavedContact,
} from "@/lib/access/household-contracts";
import { HouseholdNavigationContext } from "./HouseholdNavigationContext";
import { failureMessages, HouseholdFeedback } from "./HouseholdWorkspace";
import { ContactFieldsEditor } from "./ContactForm";
import { householdApi } from "./household-api";

type BatchSave = Extract<HouseholdMutation, { action: "saveContacts" }>;
type ContactDraft = {
  key: string;
  value: ContactFields;
  original?: SavedContact;
  removed?: boolean;
};
const emptyContact = {
  kind: "phone",
  value: "",
  label: null,
  visibility: "managers",
} satisfies ContactFields;

function toDraft({ id, ...value }: SavedContact): ContactDraft {
  return { key: id, value, original: { id, ...value } };
}

function getChanges(drafts: ContactDraft[]) {
  return drafts.flatMap<ContactChange>(({ value, original, removed }) => {
    if (!original) return [{ action: "addContact", contact: value }];
    const { id, ...expected } = original;
    if (removed) return [{ action: "deleteContact", id, expected }];
    if (sameContact(value, expected)) return [];
    return [{ action: "updateContact", id, contact: value, expected }];
  });
}

export function HouseholdContactEditor({ id }: { id: string }) {
  const workspace = useContext(HouseholdNavigationContext);
  const router = useRouter();
  const { t } = useI18n();
  if (!workspace) throw new Error("Household contact editing requires the household layout.");
  const { resource } = workspace;
  const contacts = resource.data?.ownContacts;
  const status = contacts === null ? "unavailable" : resource.status;
  const action = usePrivateAction(
    `${id}:${status === "expired" || status === "unavailable" ? status : ""}`,
  );
  const backHref = `/household/${id}`;

  return (
    <section className="min-w-0 space-y-4">
      <h2 className="text-2xl font-bold">{t("homeEditContacts")}</h2>
      <ContactEditorForm
        contacts={status === "expired" || status === "unavailable" ? null : contacts}
        disabled={resource.status !== "ready"}
        busy={action.busy}
        error={action.error}
        backHref={backHref}
        onRefresh={resource.refresh}
        onClearError={action.clear}
        onSave={async (input) => {
          const result = await action.run(
            (signal) => householdApi.update(id, input, signal),
            resource.invalidate,
          );
          if (!result) return;
          resource.refresh();
          router.replace(backHref);
        }}
      />
      {!contacts && <HouseholdFeedback status={status} onRefresh={resource.refresh} />}
    </section>
  );
}

export function ContactEditorForm({
  contacts,
  disabled = false,
  busy,
  error,
  backHref,
  onSave,
  onRefresh,
  onClearError,
}: {
  contacts: SavedContact[] | null | undefined;
  disabled?: boolean;
  busy: boolean;
  error: string | null;
  backHref: string;
  onSave: (input: BatchSave) => Promise<void>;
  onRefresh: () => void;
  onClearError: () => void;
}) {
  const { t } = useI18n();
  const [drafts, setDrafts] = useState<ContactDraft[] | null>(() => contacts?.map(toDraft) ?? null);
  useEffect(() => {
    if (contacts === null) setDrafts(null);
    else if (contacts && drafts === null) setDrafts(contacts.map(toDraft));
  }, [contacts, drafts]);
  if (!contacts || !drafts) return null;

  const input = householdMutation.safeParse({
    action: "saveContacts",
    changes: getChanges(drafts),
  });
  const originals = drafts.flatMap((draft) => (draft.original ? [draft.original] : []));
  const stale =
    error === "STALE_HOUSEHOLD" ||
    originals.length !== contacts.length ||
    originals.some((original, index) => {
      const saved = contacts[index];
      return original.id !== saved.id || !sameContact(original, saved);
    });
  const activeDrafts = drafts.filter((draft) => !draft.removed);
  const remove = ({ key, original }: ContactDraft) => {
    if (original && !window.confirm(t("homeDeleteHint"))) return;
    setDrafts(
      original
        ? drafts.map((draft) => (draft.key === key ? { ...draft, removed: true } : draft))
        : drafts.filter((draft) => draft.key !== key),
    );
    if (!stale) onClearError();
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (!disabled && !busy && !stale && input.success && input.data.action === "saveContacts")
          void onSave(input.data);
      }}
    >
      <fieldset disabled={busy} className="min-w-0 space-y-4">
        <p className="text-sm text-muted-foreground">{t("homeGlobalContacts")}</p>
        {activeDrafts.length === 0 && <p>{t("homeNoContacts")}</p>}
        {activeDrafts.map((draft) => (
          <ContactFieldsEditor
            key={draft.key}
            value={draft.value}
            adding={!draft.original}
            onChange={(patch) => {
              setDrafts(
                drafts.map((entry) =>
                  entry.key === draft.key
                    ? { ...entry, value: { ...entry.value, ...patch } }
                    : entry,
                ),
              );
              if (!stale) onClearError();
            }}
          >
            <Button
              type="button"
              variant="outline"
              aria-label={
                draft.value.value ? t("homeDeleteContact", { value: draft.value.value }) : undefined
              }
              onClick={() => remove(draft)}
            >
              {t("delete")}
            </Button>
          </ContactFieldsEditor>
        ))}
        {(stale || error) && (
          <p role="alert" className="text-sm text-destructive">
            {t(stale ? "homeStale" : (failureMessages[error ?? ""] ?? "homeUncertain"))}
          </p>
        )}
        {stale && (
          <Button type="button" variant="outline" onClick={onRefresh}>
            {t("refreshDirectory")}
          </Button>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={activeDrafts.length >= 10}
            onClick={() =>
              setDrafts([...drafts, { key: crypto.randomUUID(), value: emptyContact }])
            }
          >
            {t("homeAddContact")}
          </Button>
          <Button type="submit" disabled={disabled || !input.success || stale}>
            {t(busy ? "saving" : "save")}
          </Button>
          <Button variant="outline" loading={busy} asChild>
            <Link href={backHref}>{t("cancel")}</Link>
          </Button>
        </div>
      </fieldset>
    </form>
  );
}
