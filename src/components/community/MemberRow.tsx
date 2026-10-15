"use client";
import { useI18n } from "@/lib/i18n/context";
import { FamilyAvatar } from "../FamilyAvatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import type { Visibility } from "./VisibilitySelector";
import { ContactAction } from "./ContactAction";
// Values must already be authorized by the caller. Hidden contacts never carry a value.
export type ContactView = { kind: "phone" | "email" | "whatsapp" } & (
  { visible: false; value?: never } | { visible: true; value: string; visibility?: Visibility }
);
export type MemberView = {
  id: string;
  name: string;
  child?: boolean;
  relation?: string;
  age?: number;
  primary?: boolean;
  contacts: readonly ContactView[];
  birthdayLabel?: string;
};
export function MemberRow({
  member,
  onEdit,
}: {
  member: MemberView;
  onEdit?: (id: string) => void;
}) {
  const { t } = useI18n();
  return (
    <article className="community-enter community-interactive flex flex-wrap items-start gap-3 rounded-xl border bg-card p-4">
      <FamilyAvatar name={member.name} size={44} className="rounded-full" />
      <div className="min-w-0 flex-1 space-y-2">
        <h3 className="break-words font-semibold">
          <bdi>{member.name}</bdi>
        </h3>
        <div className="flex flex-wrap gap-2 text-sm">
          {member.primary && <Badge>{t("primary")}</Badge>}
          {member.child && (
            <span>
              {t("child")}
              {member.age !== undefined && ` · ${t("age", { n: member.age })}`}
            </span>
          )}
          {member.relation && <bdi>{member.relation}</bdi>}
          {member.birthdayLabel && <bdi>{member.birthdayLabel}</bdi>}
        </div>
        <div className="flex flex-wrap gap-2">
          {member.contacts.map((c, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              {c.visible && (
                <bdi dir="ltr" className="break-all text-sm tabular-nums">
                  {c.value}
                </bdi>
              )}
              {c.visible && c.visibility && (
                <Badge variant="outline">
                  {t(
                    c.visibility === "admins"
                      ? "vis_managers"
                      : c.visibility === "building"
                        ? "vis_building"
                        : "vis_project",
                  )}
                </Badge>
              )}
              <ContactAction {...c} />
            </div>
          ))}
        </div>
      </div>
      {onEdit && (
        <Button variant="ghost" onClick={() => onEdit(member.id)}>
          {t("edit")}
        </Button>
      )}
    </article>
  );
}
