import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Files holding parts that Phase 17.1 reuses; each extraction plan appends one line.
const partFiles = ["portia-editor-dossier.tsx", "portia-desktop-dossier.tsx", "portia-editor-rich-text.tsx"];

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

test("ImageEditorField works without onUpload (D-03)", () => {
  const source = readFileSync(new URL("../components/portia-editor-dossier.tsx", import.meta.url), "utf8");
  assert.ok(source.includes("onUpload?: (file: File) => void;"));
  assert.ok(source.includes('uploadState = "idle"'));
  assert.ok(source.includes("if (file && onUpload) onUpload(file);"));
  assert.ok(source.includes('{onUpload && <label className="editor-dropzone"'));
});
