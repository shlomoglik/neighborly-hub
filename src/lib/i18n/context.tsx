"use client";
import { createContext, useContext } from "react";
import type { Lang, TKey } from "./dictionary";
type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: TKey, vars?: Record<string, string | number>) => string;
  dir: "rtl" | "ltr";
};
export const I18nContext = createContext<Ctx | null>(null);

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n outside provider");
  return context;
}
