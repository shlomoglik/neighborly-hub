"use client";
import { HouseholdNavigationContext } from "./HouseholdNavigationContext";
import { RefreshButton } from "@/components/community/RefreshButton";
import { useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { TKey } from "@/lib/i18n/dictionary";
import { HouseholdDetailsContent } from "@/components/community/HouseholdPanel";
import { toVisibility } from "./ContactForm";
import { CommunitySkeleton } from "@/components/community/CommunityLoading";
import { SystemFeedback } from "@/components/community/SystemFeedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ResourceStatus } from "@/features/shared/use-private-resource";
import {
  householdMutation,
  type HouseholdDetail,
  type HouseholdMutation,
} from "@/lib/access/household-contracts";

type Editor = { value: string; expected: string };
export const failureMessages: Partial<Record<string, TKey>> = {
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
  useEffect(() => {
    if (status === "expired" || status === "unavailable") {
      setEditor(null);
      setSaved(false);
    }
    if (status === "ready" && !refreshing && restoreFocus.current) {
      heading.current?.focus();
      restoreFocus.current = false;
    }
  }, [status, refreshing]);
  useEffect(() => {
    if (data && !data.canRename) setEditor(null);
  }, [data]);

  const closeEditor = () => {
    onClearError?.();
    setEditor(null);
  };
  const submit = async () => {
    if (!editor || busy) return;
    const result = householdMutation.safeParse({
      action: "rename",
      expected: editor.expected,
      name: editor.value,
    });
    if (!result.success) {
      setInvalid(true);
      return;
    }
    if (await onSave(result.data)) {
      closeEditor();
      setSaved(true);
      restoreFocus.current = true;
    }
  };
  const editHref = data && `/household/${data.id}/contacts/edit`;
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
            members={data.members.map((member) => {
              const own = member.id === data.ownPersonId ? data.ownContacts : null;
              return {
                ...member,
                contactEditHref: own && editHref ? editHref : undefined,
                contacts: own
                  ? own.map(({ kind, value, label, visibility }) => ({
                      kind,
                      value,
                      label,
                      visibility: toVisibility(visibility),
                      visible: true as const,
                    }))
                  : member.contacts.map((contact) => ({ ...contact, visible: true as const })),
              };
            })}
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
          {editHref &&
            data.ownContacts &&
            !data.members.some((member) => member.id === data.ownPersonId) && (
              <Button variant="outline" asChild>
                <Link href={editHref}>
                  <Pencil aria-hidden="true" />
                  {t("homeEditContacts")}
                </Link>
              </Button>
            )}
          {data.canRename && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                onClearError?.();
                setInvalid(false);
                setSaved(false);
                setEditor({ value: data.name, expected: data.name });
              }}
            >
              {t("homeRename")}
            </Button>
          )}
          {editor && (
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
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {t(failureMessages[error] ?? "homeUncertain")}
            </p>
          )}
          {saved && <p role="status">{t("homeSaved")}</p>}
        </div>
      )}
    </section>
  );
}
