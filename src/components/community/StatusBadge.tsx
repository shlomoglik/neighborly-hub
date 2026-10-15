"use client";
import { useI18n } from "@/lib/i18n/context";
import { Badge } from "../ui/badge";
export type ResidentStatus =
  "owner-resident" | "owner-absent" | "tenant" | "pending" | "approved" | "rejected";
const keys = {
  "owner-resident": "owner_resident",
  "owner-absent": "owner_non_resident",
  tenant: "tenant",
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
} as const;
export function StatusBadge({ status }: { status: ResidentStatus }) {
  const { t } = useI18n();
  return (
    <Badge
      variant={
        status === "rejected" ? "destructive" : status === "pending" ? "secondary" : "outline"
      }
      className={status === "pending" ? "bg-warning/20 text-foreground" : undefined}
    >
      {t(keys[status])}
    </Badge>
  );
}
