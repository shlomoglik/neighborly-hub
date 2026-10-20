"use client";
import { RefreshButton } from "@/components/community/RefreshButton";
import { useState } from "react";
import { useI18n, type TKey } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import type { StructureEditTarget } from "@/lib/access/structure-management-contracts";
import { structurePayload } from "./structure-api";
export type StructureEditorProps = {
  target: StructureEditTarget;
  busy: boolean;
  refreshing?: boolean;
  error: TKey | null;
  onSave: (value: string, address?: string) => Promise<void>;
  onClose: () => void;
  onReload: () => void;
  onRestoreFocus?: () => void;
};
export function StructureEditor(p: StructureEditorProps) {
  const { t, dir } = useI18n();
  const [value, setValue] = useState(p.target.mode === "update" ? String(p.target.expected) : "");
  const [address, setAddress] = useState(
    p.target.mode === "update" && p.target.entity === "building" ? (p.target.address ?? "") : "",
  );
  let valid = true;
  try {
    structurePayload(p.target, value, p.target.entity === "building" ? address : undefined);
  } catch {
    valid = false;
  }
  const unchanged =
    p.target.mode === "update" &&
    String(p.target.expected) === value.trim() &&
    (p.target.entity !== "building" || (p.target.address ?? "") === address.trim());
  const blocked = p.busy || !!p.refreshing;
  const title = t(p.target.mode === "create" ? "structureAdd" : "structureEdit");
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !p.busy) p.onClose();
      }}
    >
      <AlertDialogContent
        className="max-h-[90dvh] overflow-y-auto"
        dir={dir}
        onCloseAutoFocus={(event) => {
          if (p.onRestoreFocus) {
            event.preventDefault();
            p.onRestoreFocus();
          }
        }}
        onEscapeKeyDown={(event) => {
          if (p.busy) event.preventDefault();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {title} — {t(p.target.entity)}
          </AlertDialogTitle>
          <AlertDialogDescription>{t("structureEditHint")}</AlertDialogDescription>
        </AlertDialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (valid && !blocked && !unchanged) {
              if (p.target.entity === "building") await p.onSave(value, address);
              else await p.onSave(value);
            }
          }}
        >
          <label className="block space-y-2">
            <span>{t(p.target.entity === "building" ? "name" : "structureNumber")}</span>
            <Input
              autoFocus
              required
              disabled={blocked}
              type={p.target.entity === "floor" ? "number" : "text"}
              step={p.target.entity === "floor" ? 1 : undefined}
              min={p.target.entity === "floor" ? -2147483648 : undefined}
              max={p.target.entity === "floor" ? 2147483647 : undefined}
              maxLength={200}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
          {p.target.entity === "building" && (
            <label className="block space-y-2">
              <span>{t("buildingAddress")}</span>
              <Input
                maxLength={500}
                value={address}
                disabled={blocked}
                onChange={(e) => setAddress(e.target.value)}
                autoComplete="street-address"
              />
            </label>
          )}
          {p.target.entity === "floor" && (
            <p className="text-sm text-muted-foreground">{t("structureFloorHint")}</p>
          )}
          {blocked && <p role="status">{t(p.busy ? "saving" : "loading")}</p>}
          {p.error && (
            <div role="alert" className="space-y-2">
              <p>{t(p.error)}</p>
              <div className="flex justify-end">
                <RefreshButton
                  type="button"
                  disabled={p.busy}
                  onClick={p.onReload}
                  label={t("refreshManagement")}
                />
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={p.busy}>{t("cancel")}</AlertDialogCancel>
            <Button
              type="submit"
              disabled={
                !valid ||
                blocked ||
                unchanged ||
                p.error === "structureStale" ||
                p.error === "structureUncertain"
              }
            >
              {t("save")}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
