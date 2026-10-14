import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      ".next/**", "node_modules/**", "dist/**", ".output/**", ".vinxi/**",
      "src/routes/**", "src/integrations/**", "src/router.tsx",
      "src/routeTree.gen.ts", "src/start.ts", "src/server.ts", "src/test/**",
      "vite.config.ts", "vitest.config.ts",
    ],
  },
  {
    files: ["src/app/**/*.{ts,tsx}", "src/features/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}", "src/lib/**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { "react-hooks": reactHooks },
    rules: { ...reactHooks.configs.recommended.rules, "@typescript-eslint/no-unused-vars": "off" },
  },
  prettier,
);
