"use client";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Skeleton } from "../ui/skeleton";
export type SkeletonVariant =
  | "household"
  | "member"
  | "birthday"
  | "details"
  | "map"
  | "form"
  | "navigation"
  | "request"
  | "directory";
function RowPlaceholder({ round = false }: { round?: boolean }) {
  return (
    <div className="flex min-h-20 items-center gap-3 rounded-xl border bg-card p-4">
      <Skeleton className={`size-12 shrink-0 ${round ? "rounded-full" : "rounded-2xl"}`} />
      <div className="flex-1 space-y-3">
        <Skeleton className="h-5 w-2/3 max-w-48" />
        <Skeleton className="h-4 w-1/2 max-w-32" />
      </div>
      <Skeleton className="h-11 w-16" />
    </div>
  );
}
function Placeholder({ variant }: { variant: SkeletonVariant }) {
  if (variant === "map")
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid grid-cols-[5rem_1fr] gap-3">
            <Skeleton className="mt-3 h-5 w-16" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[0, 1, 2, 3].map((j) => (
                <Skeleton key={j} className="min-h-20 rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  if (variant === "details")
    return (
      <div className="space-y-4">
        <RowPlaceholder />
        <RowPlaceholder round />
        <RowPlaceholder round />
      </div>
    );
  if (variant === "form")
    return (
      <div className="space-y-4 rounded-2xl border bg-card p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-11 w-full" />
            {i > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((j) => (
                  <Skeleton key={j} className="h-16" />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  if (variant === "navigation")
    return (
      <div className="flex gap-2 sm:w-20 sm:flex-col lg:w-60">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 flex-1 sm:flex-none" />
        ))}
      </div>
    );
  if (variant === "directory")
    return (
      <div className="space-y-4">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-5 w-24" />
        {[0, 1, 2].map((i) => (
          <RowPlaceholder key={i} />
        ))}
      </div>
    );
  if (variant === "request")
    return (
      <div className="space-y-3 rounded-2xl border bg-card p-4">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
        <div className="flex gap-2">
          <Skeleton className="h-11 w-24" />
          <Skeleton className="h-11 w-24" />
        </div>
      </div>
    );
  return <RowPlaceholder round={variant === "member"} />;
}
export function CommunitySkeleton({ variant = "household" }: { variant?: SkeletonVariant }) {
  const { t } = useI18n();
  return (
    <div role="status" aria-busy="true" className="community-enter">
      <span className="sr-only">{t("loading")}</span>
      <div aria-hidden="true">
        <Placeholder variant={variant} />
      </div>
    </div>
  );
}
// Use without data: placeholder geometry is independent of private resident values.
export function CommunityLoading({
  loading,
  variant,
  children,
}: {
  loading: boolean;
  variant: SkeletonVariant;
  children: ReactNode;
}) {
  return loading ? (
    <CommunitySkeleton variant={variant} />
  ) : (
    <div className="community-enter">{children}</div>
  );
}
