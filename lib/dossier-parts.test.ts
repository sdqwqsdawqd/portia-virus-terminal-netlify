import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Files holding parts that Phase 17.1 reuses; 17-03 and 17-04 append one line each.
const partFiles = ["portia-editor-dossier.tsx"];

test("17.1 parts stay server-agnostic (D-03)", () => {
  for (const file of partFiles) {
    const source = readFileSync(new URL(`../components/${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /\bfetch\(/, `${file} calls fetch`);
    assert.doesNotMatch(source, /["'`]\/api\//, `${file} mentions an /api/ route`);
    assert.doesNotMatch(source, /supabase/i, `${file} mentions Supabase`);
    assert.doesNotMatch(source, /\brevision\b/, `${file} mentions revisions`);
    for (const lib of ["supabase", "request-json", "image-upload", "portia-cdn", "editor-access"]) {
      assert.doesNotMatch(source, new RegExp(`from\\s+["']@/lib/${lib}`), `${file} imports @/lib/${lib}`);
    }
  }
});
