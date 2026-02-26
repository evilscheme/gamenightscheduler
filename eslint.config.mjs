import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintPluginBetterTailwindcss from "eslint-plugin-better-tailwindcss";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Test coverage output:
    "coverage/**",
  ]),
  // Tailwind CSS linting (canonical classes, shorthands, duplicates, etc.)
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "better-tailwindcss": eslintPluginBetterTailwindcss,
    },
    settings: {
      "better-tailwindcss": {
        entryPoint: "src/app/globals.css",
        rootFontSize: 16,
      },
    },
    rules: {
      "better-tailwindcss/enforce-canonical-classes": "warn",
      "better-tailwindcss/enforce-shorthand-classes": "warn",
      "better-tailwindcss/no-duplicate-classes": "warn",
      "better-tailwindcss/no-deprecated-classes": "warn",
      "better-tailwindcss/no-unnecessary-whitespace": "warn",
    },
  },
  // Disable React hooks rules in e2e tests (Playwright's `use` is not a React hook)
  {
    files: ["e2e/**/*.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
]);

export default eslintConfig;
