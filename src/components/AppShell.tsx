"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookUser, Settings2, UserPlus } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { LangSwitcher } from "./LangSwitcher";
export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const nav = [
    { to: "/directory", label: t("directory"), icon: BookUser },
    { to: "/join", label: t("join"), icon: UserPlus },
    { to: "/manage", label: t("manage"), icon: Settings2 },
  ];
  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link href="/directory" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-lg text-primary-foreground">
              🏡
            </span>
            <span className="text-lg font-bold">{title ?? t("appName")}</span>
          </Link>
          <nav className="ms-6 hidden gap-1 md:flex">
            {nav.map((n) => (
              <Link
                key={n.to}
                href={n.to}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${pathname === n.to ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ms-auto">
            <LangSwitcher />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-4">{children}</main>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-3xl">
          {nav.map((n) => (
            <Link
              key={n.to}
              href={n.to}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${pathname === n.to ? "text-primary" : "text-muted-foreground"}`}
            >
              <n.icon className="h-5 w-5" />
              {n.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
