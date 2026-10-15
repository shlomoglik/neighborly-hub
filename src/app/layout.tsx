import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { I18nProvider } from "@/lib/i18n";
import {
  DEFAULT_LANG,
  LANG_COOKIE,
  directionFor,
  isLang,
  translate,
  type Lang,
} from "@/lib/i18n/dictionary";
import "./globals.css";

async function getLanguage(): Promise<Lang> {
  const value = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(value) ? value : DEFAULT_LANG;
}

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLanguage();
  return { title: translate(lang, "appName"), description: translate(lang, "tagline") };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const lang = await getLanguage();
  return (
    <html lang={lang} dir={directionFor(lang)}>
      <body>
        <I18nProvider initialLang={lang}>{children}</I18nProvider>
      </body>
    </html>
  );
}
