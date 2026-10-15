"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  DEFAULT_LANG,
  LANG_COOKIE,
  directionFor,
  translate,
  type Lang,
  type TKey,
} from "./i18n/dictionary";
export type { Lang, TKey } from "./i18n/dictionary";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: TKey, vars?: Record<string, string | number>) => string;
  dir: "rtl" | "ltr";
};
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({
  children,
  initialLang = DEFAULT_LANG,
}: {
  children: ReactNode;
  initialLang?: Lang;
}) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const router = useRouter();
  useEffect(() => {
    setLangState(initialLang);
  }, [initialLang]);
  const dir = directionFor(lang);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);
  const setLang = (next: Lang) => {
    document.cookie = `${LANG_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    setLangState(next);
    document.documentElement.lang = next;
    document.documentElement.dir = directionFor(next);
    router.refresh();
  };
  const t = (key: TKey, vars?: Record<string, string | number>) => translate(lang, key, vars);
  return <I18nContext.Provider value={{ lang, setLang, t, dir }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n outside provider");
  return context;
}
