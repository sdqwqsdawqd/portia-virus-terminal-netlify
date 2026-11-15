// Source contract of the visitor side of Phase 24 (plan 24-04): how the desktop and the gate apply a changed level, a revoke
// and the device cache, and how the dossier reads scientist logs. The browser, live roles and a real downgrade/revoke are
// BLOCKED until plan 24-11 / Phase 25 prove them; nothing here claims them. These tests read sources only.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lf } from "./component-source.ts";
import { CONTENT_CACHE_KEY, EMPLOYEES_CACHE_KEY } from "./device-cache.ts";

const withoutComments = (text: string) => lf(text).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const read = (path: string) => withoutComments(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));

const desktop = read("components/portia-desktop.tsx");
const gate = read("components/portia-access-gate.tsx");

// Index of the "}" that closes the "{" at `open`; braces inside strings or template literals are not special-cased.
function closingBrace(text: string, open: number) {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}" && --depth === 0) return i;
  }
  return -1;
}

function bodyOf(text: string, header: string): string {
  const start = text.indexOf(header);
  assert.notEqual(start, -1, header);
  const open = text.indexOf("{", text.indexOf(")", start));
  return text.slice(open, closingBrace(text, open) + 1);
}

const fetchContentBody = bodyOf(desktop, "const fetchContent = useCallback(async () => {");

test("LVL-09: fetchContent orders answers by request number and accepts by revision or viewer", () => {
  assert.ok(fetchContentBody.includes("isNewerAnswer(requestSeq, contentAnsweredSeq.current)"));
  assert.ok(fetchContentBody.includes("viewerKeyOf(payload.viewer)"));
  assert.match(fetchContentBody, /acceptFetchedContent\(fetchedRevision, knownRevision\.current, savesAtSend, savesStarted\.current, fetchedViewer, knownViewerKey\.current\)/);
  // The order check comes before the accept rule, so a late old answer is dropped whatever its viewer key.
  assert.ok(fetchContentBody.indexOf("isNewerAnswer(") < fetchContentBody.indexOf("acceptFetchedContent("));
  assert.ok(fetchContentBody.includes("knownViewerKey.current = fetchedViewer"));
  assert.ok(fetchContentBody.includes("setDocuments(fetchedDocuments)"));
  assert.ok(fetchContentBody.includes("normalizeDocumentLinks(payload.documents)"));
});

test("D-21: a 401 access-required from /api/content clears both device copies and asks the gate at once", () => {
  assert.match(fetchContentBody, /response\.status === 401/);
  assert.match(fetchContentBody, /\.json\(\)\.catch\(\(\) => null\)/);
  assert.match(fetchContentBody, /code === "access-required"/);
  assert.ok(fetchContentBody.includes("clearDeviceContentCaches(() => window.localStorage)"));
  assert.ok(fetchContentBody.includes("onAccessLostRef.current?.()"));
  // The 401 branch is not recorded as a failure of the stale banner or as a good copy.
  assert.match(fetchContentBody, /if \(accessLost\) \{[^}]*\} else if \(failure === null\)/);
});

test("D-23: a visitor polls every 30 s, an editor every 10 s, and a new viewer key from the gate refreshes at once", () => {
  assert.ok(desktop.includes("const contentSyncMs = 30_000;"));
  assert.ok(desktop.includes("const editorContentSyncMs = 10_000;"));
  assert.ok(desktop.includes("canEditRef.current ? editorContentSyncMs : contentSyncMs"));
  assert.ok(!/setInterval\([^;]*contentSyncMs/.test(desktop), "the content poll reads its wait at every step");
  assert.match(desktop, /if \(viewerKey && viewerKey !== knownViewerKey\.current\) void fetchContent\(\);/);
  assert.ok(!desktop.includes("CDN-cached"));
});

test("LVL-05: the content cache is shown only for the viewer key of the gate decision and carries it when written", () => {
  const read = desktop.indexOf("window.localStorage.getItem(contentCacheStorageKey)");
  const check = desktop.indexOf("cacheMatchesViewer(JSON.parse(cached), viewerKeyRef.current)");
  const show = desktop.indexOf("const cachedContent = normalizePortiaContent(parsed.content)");
  assert.ok(read !== -1 && check > read && show > check, "the viewer check sits between the read and the show");
  assert.ok(desktop.includes("viewer: fetchedViewer"));
  assert.ok(desktop.includes("viewer: knownViewerKey.current"));
  // The desktop keeps the key literals (lib/portia-desktop.test.ts pins them); they must equal the keys that get cleared.
  assert.ok(desktop.includes(`const contentCacheStorageKey = "${CONTENT_CACHE_KEY}";`));
  assert.ok(desktop.includes(`const employeesCacheStorageKey = "${EMPLOYEES_CACHE_KEY}";`));
});

test("the gate clears device copies on a closed, not allowed decision and gives the desktop its viewer and access-lost hook", () => {
  assert.ok(gate.includes("shouldClearDeviceCaches(decision)"));
  assert.ok(gate.includes("clearDeviceContentCaches(() => window.localStorage)"));
  assert.ok(gate.indexOf("shouldClearDeviceCaches(decision)") < gate.indexOf("setView({ kind: \"decision\", decision })"));
  assert.match(gate, /<PortiaDesktop[^>]*viewerKey=\{viewerKey\(viewer\)\}/);
  assert.match(gate, /<PortiaDesktop[^>]*onAccessLost=\{onAccessLost\}/);
  assert.match(gate, /const onAccessLost = useCallback\(\(\) => \{ void refresh\(\); \}, \[refresh\]\)/);
});

// Phase 24 dossier. "withheld" is set by the server cut of plan 24-05; here only the client side is proved: a row is closed
// exactly when it carries the mark, and a closed record never feeds its text to anything.
const dossier = read("components/portia-desktop-dossier.tsx");
const romanName = "roman";

test("D-15: the dossier has no Roman numeral helper and no hard-coded level II", () => {
  assert.ok(!dossier.includes(romanName));
  assert.ok(!dossier.includes("<strong>II</strong>"));
  assert.ok(!dossier.includes("Текущий уровень: II"));
  assert.ok(dossier.includes("<strong>{viewerLevel}</strong>"));
  assert.ok(dossier.includes("levelCopy.currentLevelPlaque"));
  assert.ok(dossier.includes("levelCopy.logLevel(log.lockedLevel)"));
  assert.ok(dossier.includes("levelCopy.archivePath(level)"));
  assert.ok(dossier.includes("levelCopy.docDenied(viewerLevel, level)"));
  assert.ok(dossier.includes("<dd>{level}</dd>"));
});

test("D-12: a scientist record is closed by the server mark, not by a level comparison on the client", () => {
  assert.equal((dossier.match(/const isOpen = !log\.withheld;/g) ?? []).length, 2, "the row and the document");
  assert.ok(!/lockedLevel\s*<=/.test(dossier));
  assert.ok(!/viewerLevel\s*>=/.test(dossier));
});

test("T-24-13: the redacted bars are built from the record id only", () => {
  assert.ok(dossier.includes("generatedRedaction("));
  const body = bodyOf(dossier, "function RedactedDocument(");
  assert.ok(body.includes("generatedRedaction(id)"));
  assert.ok(!body.includes("scientistDocument("));
  assert.ok(!body.includes(".content"));
  assert.ok(!body.includes("log"), "no record object reaches the bars");
  assert.ok(dossier.includes("<RedactedDocument id={log.id} />"));
});

test("LVL-06: the block of scientist records exists only when the virus has records", () => {
  assert.ok(dossier.includes("after={virus.scientistLogs.length > 0 ? records : undefined}"));
  assert.ok(!dossier.includes("scientist-log-empty"));
  assert.ok(!dossier.includes("ЗАПИСИ ОТСУТСТВУЮТ"));
});

test("D-15: every dossier call of the desktop passes the shown viewer level", () => {
  const calls = desktop.match(/<(VirusRecord|ScientistDocument)\b[^>]*viewerLevel=\{shownViewerLevel\(content, viewerLevel\)\}/g) ?? [];
  assert.equal(calls.length, 3);
  assert.equal((desktop.match(/<VirusRecord\b/g) ?? []).length, 2);
  assert.equal((desktop.match(/<ScientistDocument\b/g) ?? []).length, 1);
});
