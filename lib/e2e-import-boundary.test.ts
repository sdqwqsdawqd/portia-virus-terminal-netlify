import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const productionRoots = ["app", "components", "lib"];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (![".ts", ".tsx"].includes(extname(path)) || path.endsWith(".test.ts")) return [];
    return [path];
  });
}

test("production source never imports Phase 15 e2e support", () => {
  const offenders = productionRoots.flatMap((root) =>
    sourceFiles(fileURLToPath(new URL(`../${root}`, import.meta.url))).filter((path) =>
      /tests[\\/]e2e/.test(readFileSync(path, "utf8")),
    ));
  assert.deepEqual(offenders, [], `production imports test support: ${offenders.join(", ")}`);
});
