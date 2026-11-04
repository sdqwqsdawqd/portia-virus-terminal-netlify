import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "next-env.d.ts",
    // GSD history contains standalone audit scripts, not application source.
    ".planning/**",
    // Local untracked agent tooling (skills, worktrees). Ignored by git, so it is
    // absent from a clean checkout; on HEAD all 32 lint errors came from these dirs.
    ".agents/**",
    ".claude/**",
    ".codex/**",
  ]),
]);

export default eslintConfig;
