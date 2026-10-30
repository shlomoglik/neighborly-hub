import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DEFAULT_LANG, isLang, LANG_COOKIE, translate } from "@/lib/i18n/dictionary";
import { Vision } from "./vision";

export async function generateMetadata(): Promise<Metadata> {
  const value = (await cookies()).get(LANG_COOKIE)?.value;
  const lang = isLang(value) ? value : DEFAULT_LANG;
  return {
    title: `${translate(lang, "visionTitle")} | ${translate(lang, "appName")}`,
    description: translate(lang, "visionIntro"),
  };
}

export default function VisionPage() {
  return <Vision />;
}
