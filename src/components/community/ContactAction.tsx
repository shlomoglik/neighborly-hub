"use client";
import { useI18n } from "@/lib/i18n/context";
import { LockKeyhole, Phone, Mail, MessageCircle } from "lucide-react";
import { Button } from "../ui/button";
export function ContactAction({
  kind,
  value,
  visible = true,
}: {
  kind: "phone" | "email" | "whatsapp";
  value?: string;
  visible?: boolean;
}) {
  const { t } = useI18n();
  const Icon = kind === "email" ? Mail : kind === "whatsapp" ? MessageCircle : Phone;
  const label = kind === "email" ? t("mail") : kind === "whatsapp" ? t("whatsapp") : t("call");
  if (!visible || !value)
    return (
      <span className="community-enter community-interactive inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
        <LockKeyhole aria-hidden="true" className="size-4" />
        {t("contactHidden")}
      </span>
    );
  const digits = value.replace(/\D/g, "");
  const href =
    kind === "email"
      ? `mailto:${encodeURIComponent(value)}`
      : kind === "whatsapp"
        ? `https://wa.me/${digits}`
        : `tel:${digits}`;
  return (
    <Button variant="outline" size="sm" asChild>
      <a href={href} aria-label={label}>
        <Icon aria-hidden="true" />
        {label}
      </a>
    </Button>
  );
}
