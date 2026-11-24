"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/context";
import { ContactAction } from "./ContactAction";
import type { Visibility } from "./VisibilitySelector";

export function ContactCard({ children }: { children: ReactNode }) {
  return <div className="min-w-0 space-y-2 rounded-xl border bg-card p-3">{children}</div>;
}

// The caller supplies only contact fields the viewer is authorized to see.
export function ContactCardDetails({
  kind,
  value,
  label,
  visibility,
  actions,
}: {
  kind: "phone" | "email" | "whatsapp";
  value: string;
  label?: string | null;
  visibility?: Visibility;
  actions?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-start gap-2">
      <div className="min-w-0 flex-[1_1_10rem] space-y-1">
        <p className="text-sm font-medium">{t(kind)}</p>
        <p className="min-w-0 break-all text-sm tabular-nums">
          <bdi dir="ltr">{value}</bdi>
        </p>
        {label && (
          <p className="break-words text-sm text-muted-foreground">
            <bdi>{label}</bdi>
          </p>
        )}
        {visibility && (
          <p className="text-sm text-muted-foreground">
            {t(
              visibility === "admins"
                ? "vis_managers"
                : visibility === "building"
                  ? "vis_building"
                  : "vis_project",
            )}
          </p>
        )}
      </div>
      <div className="flex min-w-0 max-w-full flex-wrap gap-1">
        {actions ?? <ContactAction kind={kind} value={value} />}
      </div>
    </div>
  );
}
