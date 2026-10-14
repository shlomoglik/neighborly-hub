import { Mail, MessageCircle, Phone } from "lucide-react";
import { toWhatsApp } from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const base = "grid h-11 w-11 place-items-center rounded-full transition-transform active:scale-95";

export function QuickActions({ phone, email, className }: { phone?: string | null; email?: string | null; className?: string }) {
  const { t } = useI18n();
  return (
    <div className={cn("flex gap-2", className)} onClick={(e) => e.stopPropagation()}>
      {phone && (
        <>
          <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} aria-label={t("call")} className={cn(base, "bg-primary text-primary-foreground")}>
            <Phone className="h-5 w-5" />
          </a>
          <a href={toWhatsApp(phone)} target="_blank" rel="noreferrer" aria-label={t("whatsapp")} className={cn(base, "bg-success text-success-foreground")}>
            <MessageCircle className="h-5 w-5" />
          </a>
        </>
      )}
      {email && (
        <a href={`mailto:${email}`} aria-label={t("mail")} className={cn(base, "bg-secondary text-secondary-foreground")}>
          <Mail className="h-5 w-5" />
        </a>
      )}
    </div>
  );
}
