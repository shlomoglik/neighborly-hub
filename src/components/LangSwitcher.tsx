"use client";
import { useI18n, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const langs: { id: Lang; label: string }[] = [
  { id: "he", label: "עב" },
  { id: "en", label: "EN" },
  { id: "ru", label: "РУ" },
];

export function LangSwitcher({ className }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <div className={cn("inline-flex rounded-full bg-secondary p-0.5 text-xs font-semibold", className)} dir="ltr">
      {langs.map((l) => (
        <button
          key={l.id}
          onClick={() => setLang(l.id)}
          className={cn(
            "rounded-full px-2.5 py-1 transition-colors",
            lang === l.id ? "bg-primary text-primary-foreground" : "text-secondary-foreground",
          )}
          aria-pressed={lang === l.id}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
