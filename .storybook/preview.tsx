import type { Preview } from "@storybook/react-vite";
import React from "react";
import "../src/styles.css";

const preview: Preview = {
  globalTypes: {
    locale: {
      description: "Preview locale and text direction",
      toolbar: {
        icon: "globe",
        items: [
          { value: "he", title: "עברית (RTL)" },
          { value: "en", title: "English (LTR)" },
          { value: "ru", title: "Русский (LTR)" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { locale: "he" },
  decorators: [
    (Story, context) => {
      const locale = String(context.globals.locale ?? "he");
      const direction = locale === "he" ? "rtl" : "ltr";
      return (
        <div lang={locale} dir={direction} className="min-h-screen bg-background p-6 text-foreground">
          <Story />
        </div>
      );
    },
  ],
  parameters: {
    layout: "fullscreen",
    controls: { expanded: true },
  },
};

export default preview;
