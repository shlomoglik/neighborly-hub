"use client";
import { useRef, type ReactNode, type RefObject } from "react";
import { useI18n } from "@/lib/i18n";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/** One accessible dialog: a bottom sheet on mobile and a centered panel on desktop. */
export function ResponsiveFormDialog({
  open,
  onOpenChange,
  title,
  description,
  trigger,
  busy,
  fallbackFocus,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  trigger: ReactNode;
  busy: boolean;
  fallbackFocus: RefObject<HTMLHeadingElement | null>;
  children: ReactNode;
}) {
  const { t, dir } = useI18n();
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <SheetTrigger ref={triggerRef} asChild>
        {trigger}
      </SheetTrigger>
      <SheetContent
        side="bottom"
        dir={dir}
        closeLabel={t("close")}
        closeDisabled={busy}
        className="max-h-[90dvh] overflow-y-auto rounded-t-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%_-_2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95"
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onPointerDownOutside={(event) => {
          if (busy) event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          if (!triggerRef.current?.isConnected) {
            event.preventDefault();
            fallbackFocus.current?.focus();
          }
        }}
      >
        <SheetHeader className="mb-4 pe-10 text-start sm:text-start">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}
