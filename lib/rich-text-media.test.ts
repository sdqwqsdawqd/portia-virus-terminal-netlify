import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { embeddedMediaUrl, splitEmbeddedMedia, type EmbeddedMediaSegment } from "./rich-text-media.ts";

const describeSegments = (text: string, segments: EmbeddedMediaSegment[]) =>
  segments.map((segment) => segment.kind === "media" ? ["media", text.slice(segment.start, segment.end)] : ["text", text.slice(segment.start, segment.end)]);

test("IN-01: trailing period stays out of the GIF link", () => {
  const text = "см. https://x.example/a.gif.";
  assert.deepEqual(describeSegments(text, splitEmbeddedMedia(text)), [["text", "см. "], ["media", "https://x.example/a.gif"], ["text", "."]]);
});

test("IN-01: closing parenthesis stays out of the GIF link", () => {
  const text = "(https://x.example/a.gif)";
  assert.deepEqual(describeSegments(text, splitEmbeddedMedia(text)), [["text", "("], ["media", "https://x.example/a.gif"], ["text", ")"]]);
});

test("IN-01: a link that is not media stays plain text", () => {
  const text = "https://example.com/page";
  assert.deepEqual(describeSegments(text, splitEmbeddedMedia(text)), [["text", text]]);
});

test("IN-01: giphy page link maps to the media gif", () => {
  const segments = splitEmbeddedMedia("https://giphy.com/gifs/funny-cat-abc123");
  assert.equal(segments.length, 1);
  assert.equal(segments[0].kind === "media" && segments[0].url, "https://media.giphy.com/media/abc123/giphy.gif");
});

test("IN-01: known klipy link maps to its static url", () => {
  const segments = splitEmbeddedMedia("https://klipy.com/gifs/anime-tsundere-6");
  assert.equal(segments[0].kind === "media" && segments[0].url, embeddedMediaUrl("https://klipy.com/gifs/anime-tsundere-6"));
  assert.match(String(segments[0].kind === "media" && segments[0].url), /^https:\/\/static2\.klipy\.com\/.+\.gif$/);
});

test("IN-01: segments rebuild the original mixed Cyrillic text with two links", () => {
  const text = "Привет! Смотри https://x.example/a.gif, а затем (https://media.tenor.com/b/c.gif) и https://example.com/page?.. конец.";
  const segments = splitEmbeddedMedia(text);
  assert.equal(segments.map((segment) => text.slice(segment.start, segment.end)).join(""), text);
  assert.equal(segments.filter((segment) => segment.kind === "media").length, 2);
  segments.forEach((segment, index) => { if (index > 0) assert.equal(segment.start, segments[index - 1].end); });
});

test("IN-01: dossier uses splitEmbeddedMedia and shows a Russian fallback for a broken inline image", () => {
  // The formatted text moved with the virus card to components/portia-virus-card.tsx (D-55); the dossier re-exports it.
  const source = readFileSync(new URL("../components/portia-virus-card.tsx", import.meta.url), "utf8");
  assert.ok(readFileSync(new URL("../components/portia-desktop-dossier.tsx", import.meta.url), "utf8").includes("export { DossierSection, FormattedText }"));
  assert.ok(source.includes('import { splitEmbeddedMedia } from "@/lib/rich-text-media"'));
  assert.ok(source.includes("onError"));
  assert.ok(source.includes("Изображение недоступно"));
  assert.ok(!source.includes('alt="GIF"'));
  assert.ok(!source.includes("function embeddedMediaUrl"));
});
