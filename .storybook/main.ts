import type { StorybookConfig } from "@storybook/react-vite";
import { transformWithEsbuild } from "vite";
import { fileURLToPath, URL } from "node:url";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y"],
  viteFinal: async (viteConfig) => {
    viteConfig.resolve ??= {};
    viteConfig.resolve.alias = {
      ...(Array.isArray(viteConfig.resolve.alias)
        ? Object.fromEntries(
            viteConfig.resolve.alias.map(({ find, replacement }) => [find, replacement]),
          )
        : (viteConfig.resolve.alias ?? {})),
      "@": fileURLToPath(new URL("../src", import.meta.url)),
      // The React/Vite Storybook framework does not mock Next.js navigation.
      // Avoid bundling next/link's Node-dependent runtime into browser stories.
      "next/link": fileURLToPath(new URL("./next-link.tsx", import.meta.url)),
    };
    viteConfig.plugins = [
      ...(viteConfig.plugins ?? []),
      {
        name: "storybook-transform-app-tsx",
        enforce: "pre",
        async transform(code, id) {
          if (!/\/src\/.*\.tsx(?:\?.*)?$/.test(id)) return null;
          return transformWithEsbuild(code, id, { loader: "tsx", jsx: "automatic" });
        },
      },
    ];
    return viteConfig;
  },
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
};

export default config;
