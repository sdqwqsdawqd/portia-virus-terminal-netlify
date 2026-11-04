import assert from "node:assert/strict";
import test from "node:test";
import {
  createStandaloneHtml,
  emptyTemplateDraft,
  emptyTemplateText,
  escapeTemplateHtml,
  hasTemplateText,
  templateSnapshotKey,
  type TemplateDraft,
} from "./portia-template-export.ts";

const withText = (patch: Partial<Record<keyof TemplateDraft, string>>): TemplateDraft => ({ ...emptyTemplateDraft(), ...patch });

test("escapeTemplateHtml neutralises markup and quotes", () => {
  assert.equal(escapeTemplateHtml(`<img src=x onerror="a()"> & 'b'`), "&lt;img src=x onerror=&quot;a()&quot;&gt; &amp; &#39;b&#39;");
});

test("standalone HTML escapes typed text and carries no script, link or external request", () => {
  const html = createStandaloneHtml(withText({
    name: `<script>alert(1)</script>`,
    external: `Line 1\n<b onmouseover="x()">два</b>`,
    mutationName: `"><img src=//evil.example/p.png>`,
  }));
  assert.ok(!/<script/i.test(html));
  assert.ok(!/<img/i.test(html));
  assert.ok(!/<b /i.test(html));
  assert.ok(!/<link/i.test(html));
  assert.ok(!/<[^>]*[ "'](?:src|href)=/i.test(html));
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(html.includes("Content-Security-Policy"));
  assert.ok(html.includes("default-src 'none'"));
});

test("a partial draft shows empty fields honestly instead of inventing values", () => {
  const html = createStandaloneHtml(withText({ name: "Вирус А" }));
  assert.ok(html.includes("Вирус А"));
  assert.ok(html.includes(emptyTemplateText));
  assert.ok(!html.includes("undefined"));
});

test("an empty draft has no text and is not exportable", () => {
  assert.equal(hasTemplateText(emptyTemplateDraft()), false);
  assert.equal(hasTemplateText(withText({ physiology: "   " })), false);
  assert.equal(hasTemplateText(withText({ physiology: "x" })), true);
});

test("the snapshot key changes with any edit so a stale download is not counted as saved", () => {
  const a = withText({ name: "A" });
  assert.equal(templateSnapshotKey(a), templateSnapshotKey({ ...a }));
  assert.notEqual(templateSnapshotKey(a), templateSnapshotKey({ ...a, name: "AB" }));
});
