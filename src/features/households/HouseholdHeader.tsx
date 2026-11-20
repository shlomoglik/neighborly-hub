"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import type { HouseholdDetail } from "@/lib/access/household-contracts";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
export function HouseholdHeader({
  household,
  family,
}: {
  household: HouseholdDetail;
  family: boolean;
}) {
  const { t } = useI18n();
  const own = household.ownContacts !== null;
  const root = own ? "/household" : "/directory";
  const href = `/household/${household.id}`;
  const tabs = [
    { href, label: t("details"), active: !family },
    ...(household.canRename
      ? [{ href: `${href}/members`, label: t("familyManage"), active: family }]
      : []),
  ];
  return (
    <div className="min-w-0 space-y-3">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={root}>{t(own ? "homeMine" : "directory")}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>\</BreadcrumbSeparator>
          <BreadcrumbItem className="min-w-0">
            <BreadcrumbLink asChild>
              <Link href={href} className="wrap-break-word">
                <bdi>{household.name}</bdi>
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>\</BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbPage>{t(family ? "familyManage" : "details")}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <header className="min-w-0 space-y-1">
        <h1 className="wrap-break-word font-heading text-2xl font-normal sm:text-3xl">
          <bdi>{household.name}</bdi>
        </h1>
        <p className="text-sm text-muted-foreground">
          <bdi>{household.project}</bdi> · {t("building")} <bdi>{household.building}</bdi> ·{" "}
          {t("apartment")} <bdi>{household.apartment}</bdi>
        </p>
      </header>
      <nav
        aria-label={t("householdSections")}
        className="max-w-full overflow-x-auto border-b border-border/60"
      >
        <div className="flex w-max min-w-full gap-5">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={`relative flex min-h-11 shrink-0 items-center whitespace-nowrap px-1 text-sm font-medium ${tab.active ? "text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
