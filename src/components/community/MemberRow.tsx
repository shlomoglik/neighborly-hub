"use client";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
import { FamilyAvatar } from "../FamilyAvatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import type { Visibility } from "./VisibilitySelector";
import { ContactAction } from "./ContactAction";
import { ContactCard, ContactCardDetails } from "./ContactCard";
// Values must already be authorized by the caller. Hidden contacts never carry a value.
export type ContactView = { kind: "phone" | "email" | "whatsapp" } & (
  | { visible: false; value?: never }
  | { visible: true; value: string; label?: string | null; visibility?: Visibility }
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
  contactEditHref?: string;
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
    <article className="community-enter community-interactive min-w-0 space-y-3 rounded-xl border bg-card p-4">
      <div className="flex min-w-0 items-start gap-3">
        <FamilyAvatar name={member.name} size={44} className="shrink-0 rounded-full" />
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
        </div>
        {member.contactEditHref && (
          <Button variant="ghost" size="icon" className="shrink-0" asChild>
            <Link href={member.contactEditHref} aria-label={t("homeEditContacts")}>
              <Pencil aria-hidden="true" />
            </Link>
          </Button>
        )}
        {onEdit && (
          <Button variant="ghost" onClick={() => onEdit(member.id)}>
            {t("edit")}
          </Button>
        )}
      </div>
      <div className="min-w-0 space-y-2">
        {member.contacts.map((contact, index) => (
          <ContactCard key={index}>
            {contact.visible ? (
              <ContactCardDetails {...contact} />
            ) : (
              <ContactAction kind={contact.kind} visible={false} />
            )}
          </ContactCard>
        ))}
      </div>
    </article>
  );
}
