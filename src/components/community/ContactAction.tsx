import { LockKeyhole, Phone, Mail, MessageCircle } from "lucide-react";
import { Button } from "../ui/button";
export function ContactAction({ kind, value, visible = true }: { kind: "phone" | "email" | "whatsapp"; value?: string; visible?: boolean }) {
 const Icon = kind === "email" ? Mail : kind === "whatsapp" ? MessageCircle : Phone;
 const label = kind === "email" ? "שליחת מייל" : kind === "whatsapp" ? "פתיחת וואטסאפ" : "חיוג";
 if (!visible || !value) return <span className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground"><LockKeyhole className="size-4"/>פרטי קשר מוסתרים</span>;
 const digits = value.replace(/\D/g, "");
 const href = kind === "email" ? `mailto:${encodeURIComponent(value)}` : kind === "whatsapp" ? `https://wa.me/${digits}` : `tel:${digits}`;
 return <Button variant="outline" size="sm" asChild><a href={href} aria-label={label}><Icon aria-hidden="true"/>{label}</a></Button>;
}
