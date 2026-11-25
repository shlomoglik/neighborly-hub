"use client";

import { useContext, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePrivateAction } from "@/features/shared/use-private-action";
import {
  householdMutation,
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
      {!contacts && (
        <>
          <HouseholdFeedback status={status} onRefresh={resource.refresh} />
          <Button variant="outline" asChild>
            <Link href={backHref}>{t("back")}</Link>
          </Button>
        </>
      )}
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
  const [pendingRemoval, setPendingRemoval] = useState<ContactDraft | null>(null);
  useEffect(() => {
    if (contacts === null) {
      setDrafts(null);
      setPendingRemoval(null);
    } else if (contacts && drafts === null) {
      setDrafts(contacts.map(toDraft));
    }
  }, [contacts, drafts]);
  if (!contacts || !drafts) return null;

  const changes = getChanges(drafts);
  const input = householdMutation.safeParse({ action: "saveContacts", changes });
  const originals = drafts.flatMap((draft) => (draft.original ? [draft.original] : []));
  const stale =
    error === "STALE_HOUSEHOLD" ||
    originals.length !== contacts.length ||
    originals.some((original, index) => {
      const saved = contacts[index];
      return original.id !== saved.id || !sameContact(original, saved);
    });
  const activeCount = drafts.filter((draft) => !draft.removed).length;
  const remove = (key: string) => {
    setDrafts(
      (current) =>
        current?.flatMap((draft) => {
          if (draft.key !== key) return [draft];
          return draft.original ? [{ ...draft, removed: true }] : [];
        }) ?? null,
    );
    onClearError();
  };

  return (
    <>
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
          {activeCount === 0 && <p>{t("homeNoContacts")}</p>}
          {drafts
            .filter((draft) => !draft.removed)
            .map((draft) => (
              <ContactFieldsEditor
                key={draft.key}
                value={draft.value}
                adding={!draft.original}
                onChange={(patch) => {
                  setDrafts(
                    (current) =>
                      current?.map((entry) =>
                        entry.key === draft.key
                          ? { ...entry, value: { ...entry.value, ...patch } }
                          : entry,
                      ) ?? null,
                  );
                  if (!stale) onClearError();
                }}
              >
                <Button
                  type="button"
                  variant="outline"
                  aria-label={
                    draft.value.value
                      ? t("homeDeleteContact", { value: draft.value.value })
                      : undefined
                  }
                  onClick={() => (draft.original ? setPendingRemoval(draft) : remove(draft.key))}
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
              disabled={activeCount >= 10}
              onClick={() =>
                setDrafts([...drafts, { key: crypto.randomUUID(), value: emptyContact }])
              }
            >
              {t("homeAddContact")}
            </Button>
            <Button type="submit" disabled={disabled || !input.success || stale}>
              {t(busy ? "saving" : "save")}
            </Button>
            {busy ? (
              <Button type="button" variant="outline" disabled>
                {t("cancel")}
              </Button>
            ) : (
              <Button variant="outline" asChild>
                <Link href={backHref}>{t("cancel")}</Link>
              </Button>
            )}
          </div>
        </fieldset>
      </form>
      <AlertDialog
        open={!!pendingRemoval}
        onOpenChange={(open) => !open && setPendingRemoval(null)}
      >
        <AlertDialogContent>
          <AlertDialogTitle>{t("homeDeleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("homeDeleteHint")}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingRemoval && remove(pendingRemoval.key)}>
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
