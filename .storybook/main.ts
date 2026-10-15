import type { StorybookConfig } from "@storybook/react-vite";
import { transformWithEsbuild } from "vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y"],
  viteFinal: async (viteConfig) => {
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
