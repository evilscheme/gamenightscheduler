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
    // Nested git worktrees (e.g. Conductor workspaces) are ephemeral copies of
    // the repo; linting them re-lints the whole project and floods output.
    ".claude/**",
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
  // Data-layer boundary: UI code must query Supabase through src/lib/data
  // functions, never inline .from() calls (remediation plan P2.3). Server
  // routes (src/app/api), the OAuth callback, and the dev-only login action
  // own their queries; lib/data and lib/api are the layer itself.
  {
    files: [
      "src/app/**/*.{ts,tsx}",
      "src/components/**/*.{ts,tsx}",
      "src/contexts/**/*.{ts,tsx}",
      "src/hooks/**/*.{ts,tsx}",
    ],
    ignores: [
      "src/app/api/**",
      "src/app/auth/**",
      "src/app/dev-login/**",
      "**/*.test.*",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.property.name='from'][callee.object.name=/^(supabase|admin|client)$/]",
          message:
            "Query Supabase through src/lib/data functions instead of inline .from() calls (see docs/plans/2026-07-06-architecture-remediation-plan.md, P2.3).",
        },
      ],
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
