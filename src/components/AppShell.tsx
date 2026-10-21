"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookUser, Search, CircleUserRound, Settings2, UserPlus, Users } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { LangSwitcher } from "./LangSwitcher";
import { AppHeaderMenu } from "./AppHeaderMenu";
export function AppShell({
  children,
  title,
  wide = false,
}: {
  children: ReactNode;
  title?: string;
  wide?: boolean;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const nav = [
    { to: "/directory", label: t("directory"), icon: BookUser },
    { to: "/household", label: t("homeMine"), icon: Users },
    { to: "/join", label: t("join"), icon: UserPlus },
    { to: "/manage", label: t("manage"), icon: Settings2 },
  ];
  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3 sm:gap-3">
          <Link
            href="/directory"
            className="flex min-w-0 flex-1 items-center gap-2 lg:flex-initial"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center" aria-hidden="true">
              <svg viewBox="0 0 32 32" className="h-9 w-9">
                <rect width="32" height="32" rx="9" className="fill-primary" />
                <path
                  d="M16 6.2 25.5 14q.5.5.5 1.2V24q0 2-2 2H8q-2 0-2-2v-8.8q0-.7.5-1.2Z"
                  className="fill-primary-foreground"
                />
                <path
                  d="M13.2 26v-5.6q0-1.4 1.4-1.4h2.8q1.4 0 1.4 1.4V26Z"
                  className="fill-primary"
                />
              </svg>
            </span>
            <span className="min-w-0 wrap-break-word text-xl font-bold leading-tight">
              {title ?? t("appName")}
            </span>
          </Link>
          <nav className="ms-4 hidden gap-1 lg:flex">
            {nav.map((n) => (
              <Link
                key={n.to}
                href={n.to}
                className={`whitespace-nowrap rounded-full px-2 py-1.5 text-sm font-medium ${pathname === n.to || pathname?.startsWith(`${n.to}/`) ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ms-auto flex shrink-0 items-center gap-1">
            <Link
              href="/search"
              aria-label={t("globalSearch")}
              className="grid size-11 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-primary"
            >
              <Search className="size-5" aria-hidden="true" />
            </Link>
            <Link
              href="/account"
              aria-label={t("authAccount")}
              className="hidden size-11 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-primary sm:grid"
            >
              <CircleUserRound className="size-5" aria-hidden="true" />
            </Link>
            <LangSwitcher className="hidden sm:inline-flex" />
            <AppHeaderMenu />
          </div>
        </div>
      </header>
      <main className={`mx-auto min-w-0 px-4 py-4 ${wide ? "max-w-7xl" : "max-w-3xl"}`}>
        {children}
      </main>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-3xl">
          {nav.map((n) => (
            <Link
              key={n.to}
              href={n.to}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${pathname === n.to || pathname?.startsWith(`${n.to}/`) ? "text-primary" : "text-muted-foreground"}`}
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
