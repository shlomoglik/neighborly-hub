"use client";
import { Home, BookUser, Cake, House, Settings2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/context";
export type CommunityTab = "home" | "directory" | "birthdays" | "myHome" | "manage";
const tabs = [
  { id: "home", key: "home", Icon: Home },
  { id: "directory", key: "directory", Icon: BookUser },
  { id: "birthdays", key: "birthdaysShort", Icon: Cake },
  { id: "myHome", key: "myHome", Icon: House },
  { id: "manage", key: "manage", Icon: Settings2 },
] as const;
export function CommunityNavigation({
  active,
  onChange,
  manager = false,
}: {
  active: CommunityTab;
  onChange: (tab: CommunityTab) => void;
  manager?: boolean;
}) {
  const { t } = useI18n();
  return (
    <nav
      aria-label={t("navigation")}
      className="community-enter community-interactive w-full rounded-2xl bg-sidebar p-2 sm:w-20 lg:w-60"
    >
      <ul className="flex sm:flex-col">
        {tabs
          .filter((x) => manager || x.id !== "manage")
          .map(({ id, key, Icon }) => (
            <li key={id} className="min-w-0 flex-1">
              <button
                type="button"
                aria-current={active === id ? "page" : undefined}
                onClick={() => onChange(id)}
                className={`community-interactive flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs focus-visible:outline-2 focus-visible:outline-primary lg:flex-row lg:justify-start lg:gap-3 lg:px-4 lg:text-sm ${active === id ? "bg-card text-primary" : "text-sidebar-foreground"}`}
              >
                <Icon aria-hidden="true" className="size-5 shrink-0" />
                <span className="break-words text-center lg:text-start">{t(key)}</span>
              </button>
            </li>
          ))}
      </ul>
    </nav>
  );
}
