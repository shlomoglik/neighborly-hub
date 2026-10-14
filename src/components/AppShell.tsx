import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BookUser, LogOut, Settings2, UserPlus } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { useMe } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { LangSwitcher } from "./LangSwitcher";

export function AppShell({ children, title }: { children: ReactNode; title?: string }) {
  const { t } = useI18n();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const nav = [
    { to: "/directory" as const, label: t("directory"), icon: BookUser },
    { to: "/join" as const, label: t("join"), icon: UserPlus },
    ...(me?.isStaff ? [{ to: "/manage" as const, label: t("manage"), icon: Settings2 }] : []),
  ];

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/directory" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-lg text-primary-foreground">🏡</span>
            <span className="text-lg font-bold">{title ?? t("appName")}</span>
          </Link>
          <nav className="ms-6 hidden gap-1 md:flex">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <LangSwitcher />
            <button onClick={signOut} aria-label={t("signOut")} className="rounded-full p-2 text-muted-foreground hover:bg-secondary">
              <LogOut className="h-4 w-4 rtl:rotate-180" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-4">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-auto flex max-w-3xl">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium text-muted-foreground"
              activeProps={{ className: "text-primary" }}
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
