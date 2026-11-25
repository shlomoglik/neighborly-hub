"use client";

import { useState, type ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
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
}: {
  kind: "phone" | "email" | "whatsapp";
  value: string;
  label?: string | null;
  visibility?: Visibility;
}) {
  const { t } = useI18n();
  const [showValue, setShowValue] = useState(false);
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium">{t(kind)}</p>
          <TooltipProvider>
            <Tooltip open={showValue} onOpenChange={setShowValue}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="block max-w-full cursor-help truncate text-sm tabular-nums"
                  onClick={(event) => {
                    event.preventDefault();
                    setShowValue(true);
                  }}
                  dir="ltr"
                >
                  {value}
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-[calc(100vw-2rem)] wrap-anywhere" dir="ltr">
                {value}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <ContactAction kind={kind} value={value} />
      </div>
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
  );
}
