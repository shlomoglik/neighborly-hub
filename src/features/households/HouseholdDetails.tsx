"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { FamilyAvatar } from "@/components/FamilyAvatar";
import { QuickActions } from "@/components/QuickActions";
import { useI18n } from "@/lib/i18n";
import { households } from "@/lib/mock-data";
export function HouseholdDetails({ id }: { id: string }) {
  const { t } = useI18n();
  const h = households.find((h) => h.id === id);
  return (
    <AppShell>
      <Link
        href="/directory"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowRight className="h-4 w-4 ltr:rotate-180" />
        {t("back")}
      </Link>
      {!h ? (
        <p>{t("noResults")}</p>
      ) : (
        <>
          <div className="rounded-3xl bg-hero p-5 text-center shadow-warm">
            <FamilyAvatar name={h.name} size={96} className="mx-auto" />
            <h1 className="mt-3 text-2xl font-bold">{h.name}</h1>
            <p className="text-sm text-muted-foreground">
              {h.building} · {t("apartment")} {h.apartment} · {t("floor")} {h.floor}
            </p>
            <span className="mt-2 inline-block rounded-full bg-card px-3 py-1 text-xs">
              {t(h.ownership)}
            </span>
          </div>
          <h2 className="mb-2 mt-5 font-bold">{t("family")}</h2>
          <ul className="space-y-2.5">
            {h.contacts.map((c, i) => (
              <li key={i} className="rounded-2xl bg-card p-4 shadow-warm">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.relation}</div>
                  </div>
                  <QuickActions
                    phone={c.visibility === "managers" ? undefined : c.phone}
                    email={c.email}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </AppShell>
  );
}
