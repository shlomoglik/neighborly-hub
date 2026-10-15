import type { Preview } from "@storybook/react-vite";
import React, { useEffect } from "react";
import { I18nContext } from "../src/lib/i18n/context";
import { directionFor, isLang, translate, type Lang } from "../src/lib/i18n/dictionary";
import "../src/styles.css";
function LocalePreview({
  children,
  lang,
  setLang,
}: {
  children: React.ReactNode;
  lang: Lang;
  setLang: (lang: Lang) => void;
}) {
  const dir = directionFor(lang);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);
  return (
    <I18nContext.Provider
      value={{ lang, dir, setLang, t: (key, vars) => translate(lang, key, vars) }}
    >
      <div lang={lang} dir={dir} className="min-h-screen bg-background p-4 text-foreground sm:p-6">
        {children}
      </div>
    </I18nContext.Provider>
  );
}
const preview: Preview = {
  globalTypes: {
    locale: {
      description: "Preview locale and direction",
      toolbar: {
        icon: "globe",
        items: [
          { value: "he", title: "עברית" },
          { value: "en", title: "English" },
          { value: "ru", title: "Русский" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { locale: "he" },
  decorators: [
    (Story, context) => (
      <LocalePreview
        lang={isLang(context.globals.locale) ? context.globals.locale : "he"}
        setLang={() => {}}
      >
        <Story />
      </LocalePreview>
    ),
  ],
  parameters: { layout: "fullscreen", controls: { expanded: true }, a11y: { test: "error" } },
};
export default preview;
