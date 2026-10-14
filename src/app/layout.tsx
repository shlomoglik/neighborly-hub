import type { Metadata } from "next";
import type { ReactNode } from "react";
import { I18nProvider } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = { title: "ספר השכנים", description: "ספר שכנים קהילתי" };
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="he" dir="rtl"><body><I18nProvider>{children}</I18nProvider></body></html>;
}
