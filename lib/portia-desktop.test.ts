import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../components/portia-desktop.tsx", import.meta.url), "utf8");

// Index of the "}" that closes the "{" at `open`; braces inside strings or template literals are not special-cased.
function closingBrace(text: string, open: number) {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}" && --depth === 0) return i;
  }
  return -1;
}

test("state updaters stay pure: no storage access, state setter or timer inside one", () => {
  // set<Name>((arg) => { ... }) with a block body; Strict Mode replays these, so a side effect runs twice.
  const header = /\bset[A-Z]\w*\(\s*\(\s*\w+(?:\s*:[^)]*)?\)\s*=>\s*\{/g;
  const offenders: string[] = [];
  let updaters = 0;
  for (const match of source.matchAll(header)) {
    const open = match.index + match[0].length - 1;
    const body = source.slice(open, closingBrace(source, open) + 1);
    updaters += 1;
    const line = source.slice(0, match.index).split("\n").length;
    if (/\blocalStorage\b|\bsessionStorage\b|\bset[A-Z]\w*\(/.test(body)) offenders.push(`line ${line}: ${match[0].slice(0, 40)}`);
  }
  assert.ok(updaters >= 3, `expected at least 3 block-bodied updaters, found ${updaters}`);
  assert.deepEqual(offenders, []);
});

test("every embedded frame is sandboxed with the one shared set (SEC-03)", () => {
  const tags = source.match(/<iframe\b[^>]*>/g) ?? [];
  assert.equal(tags.length, 2);
  for (const tag of tags) assert.ok(tag.includes("sandbox={embedSandbox}"), `missing shared sandbox: ${tag.slice(0, 60)}`);
  const value = /const embedSandbox = "([^"]+)"/.exec(source)?.[1] ?? "";
  for (const flag of ["allow-scripts", "allow-same-origin", "allow-popups", "allow-popups-to-escape-sandbox"]) assert.ok(value.split(" ").includes(flag), flag);
  assert.ok(!value.includes("allow-top-navigation"));
  assert.ok((tags.find((tag) => tag.includes("youtube-nocookie")) ?? "").includes("allowFullScreen"));
});

test("zoom listens to Ctrl, Cmd only on a Mac, and clears on every way out (ZOOM-01)", () => {
  const metaLines = source.split("\n").filter((line) => line.includes("metaKey"));
  assert.equal(metaLines.length, 1);
  assert.ok(metaLines[0].includes("const zoomModifier"));
  const start = source.indexOf("function EmbeddedDocument");
  const body = source.slice(start, source.indexOf("\nfunction ", start + 1));
  for (const call of ['addEventListener("visibilitychange"', 'removeEventListener("visibilitychange"', 'addEventListener("blur"', 'removeEventListener("blur"']) assert.ok(body.includes(call), call);
  const layer = /<div className="document-app-zoom-layer"[^\n]*\/>/.exec(body)?.[0] ?? "";
  assert.ok(layer.includes("onPointerMove") && layer.includes("onPointerDown"), layer);
});

test("the zoom reset button is named by its percent (ZOOM-02)", () => {
  const button = /<button\b[^\n]*?>\{Math\.round\(zoom \* 100\)\}%<\/button>/.exec(source)?.[0] ?? "";
  assert.ok(button, "reset button not found");
  assert.ok(!button.includes("aria-label") && !button.includes("title="), button);
  assert.ok(source.includes('aria-label="Масштаб документа"'));
});

test("the quest notice is not a live region itself and closes on Escape from anywhere (A11Y-01)", () => {
  const start = source.indexOf("function QuestToast");
  const body = source.slice(start, source.indexOf("\nfunction ", start + 1));
  const aside = /<aside\b[^>]*>/.exec(body)?.[0] ?? "";
  assert.ok(aside.includes("quest-toast") && !aside.includes("role=") && !aside.includes("onKeyDown"), aside);
  assert.ok(body.includes('<span role="status" className="sr-only">Новый квест: '));
  for (const call of ['window.document.addEventListener("keydown"', 'window.document.removeEventListener("keydown"', "defaultPrevented", "dialog[open]"]) assert.ok(body.includes(call), call);
});

test("virus rows are options of the listbox only when there are rows (A11Y-01)", () => {
  const row = /<button key=\{virus\.id\}[^\n]*>/.exec(source)?.[0] ?? "";
  assert.ok(row.includes('role="option"') && row.includes("aria-selected={virus.id === activeVirus?.id}"), row);
  assert.ok(source.includes("const virusListbox = contentReady && filteredViruses.length > 0;"));
  const list = /<div className="virus-list"[^\n]*>/.exec(source)?.[0] ?? "";
  assert.ok(list.includes('role={virusListbox ? "listbox" : undefined}') && list.includes('aria-label={virusListbox ? "Записи вирусов" : undefined}'), list);
});

test("the Roblox portrait link has its tooltip and the plain portrait none (A11Y-02)", () => {
  const link = /<a className="personnel-portrait"[^>]*>/.exec(source)?.[0] ?? "";
  assert.ok(link.includes("title={`Профиль Roblox: ${selectedEmployee.nickname}`}"), link);
  assert.ok(!/<figure className="personnel-portrait"[^>]*title=/.test(source));
  assert.equal(source.match(/title=\{`Профиль Roblox:/g)?.length, 1);
});

test("the ≡ handle keeps no tooltip (D-18)", () => {
  const editor = readFileSync(new URL("../components/portia-editor.tsx", import.meta.url), "utf8");
  const handle = /<[a-z]+\b[^>]*className="order-drag-handle"[^>]*>/.exec(editor)?.[0] ?? "";
  assert.ok(handle, "handle not found");
  assert.ok(!handle.includes("title="), handle);
});
