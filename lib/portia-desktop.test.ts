import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../components/portia-desktop.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/portia.css", import.meta.url), "utf8");
const icons = readFileSync(new URL("../components/portia-icons.tsx", import.meta.url), "utf8");

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

test("the editor imports rich-text-style once and ships no joke or empty labels (TEST-02, A11Y-03)", () => {
  const editor = readFileSync(new URL("../components/portia-editor.tsx", import.meta.url), "utf8");
  assert.equal(editor.split('from "@/lib/rich-text-style"').length - 1, 1);
  assert.doesNotMatch(editor, /<small>\s*<\/small>|<small\s*\/>/);
  for (const word of ["\u0444\u0438\u0433\u043d\u0438", "\u0434\u0440\u0443\u0436\u043e\u043a", "\u043f\u0438\u0440\u043e\u0436\u043e\u043a"]) {
    assert.ok(!editor.includes(word), `joke word ${word} is back`);
  }
});

test("every desktop shortcut owns a default position and saved positions override only itself", () => {
  const layout = /const defaultShortcutLayout:[\s\S]*?\n};/.exec(source)?.[0] ?? "";
  for (const id of ["search", "archive", "employees", "broadcasts", "info", "guide", "promotion", "settings", "charter", "sheet", "trash"]) {
    assert.match(layout, new RegExp(`\\n  ${id}: shortcutLayout\\(`), `missing independent layout for ${id}`);
  }
  assert.ok(source.includes("position ? savedShortcutLayout(position) : defaultShortcutLayout[shortcutId]"));
  assert.ok(source.includes('"--shortcut-left": `max(0px, min(${position.x}px, calc(100% - 100px)))`'));
  assert.doesNotMatch(styles, /\.desktop-icon\[data-shortcut=/);
  assert.ok(source.includes('const shortcutPositionsStorageKey = "portia-desktop-shortcuts-v3"'));
});

test("promotion is a standalone desktop application with its own window geometry", () => {
  assert.match(source, /type AppId = [^;]*"promotion"/);
  assert.match(source, /promotion: \{ label: "Повышение", path: "Повышение", icon: "promotion" \}/);
  assert.match(source, /promotion: \[760, 620\]/);
  assert.match(source, /promotion: \{ width: 620, height: 480 \}/);
  assert.ok(source.includes('<DesktopIcon app="promotion"'));
  assert.ok(source.includes('<AppWindow app="promotion"'));
  assert.ok(source.includes("visible={activeApp === \"promotion\" && !windows.promotion.minimized}"));
  assert.ok(source.includes('meta="Повышение"'));
  assert.ok(!source.includes('meta="Portia Promotion"'));
});

test("window drag uses the live frame width and symmetric workspace bounds", () => {
  assert.ok(source.includes("width: rect.width"));
  assert.ok(source.includes("width: operation.parentWidth"));
  assert.ok(source.includes("dragGeometry(operation"));
  const geometry = readFileSync(new URL("./window-geometry.ts", import.meta.url), "utf8");
  assert.ok(geometry.includes("bounds.width - width - margin"));
  assert.doesNotMatch(geometry, /bounds\.width - 160/);
});

test("shared shortcut hover feedback never translates the icon container", () => {
  const hover = /\.desktop-icon:hover \.desktop-icon-symbol[^\{]*\{([^}]*)\}/.exec(styles)?.[1] ?? "";
  assert.ok(hover);
  assert.doesNotMatch(hover, /transform\s*:/);
  const transition = /html\[data-motion="full"\][^{]*\.desktop-icon-symbol[^\{]*\{([^}]*)\}/.exec(styles)?.[1] ?? "";
  assert.doesNotMatch(transition, /transform/);
  assert.ok(styles.includes('[data-icon="promotion"] .icon-promotion-arrow'));
});

test("shortcut motion is uniform, opt-in, and the guide has its own animation", () => {
  assert.ok(styles.includes('html[data-motion="full"] .desktop-icon.is-dragging'));
  assert.ok(styles.includes('html[data-motion="full"] .desktop-icon.is-dropping'));
  assert.ok(styles.includes('[data-icon="guide"] .icon-guide-front'));
  assert.ok(styles.includes('@keyframes icon-guide-front'));
  const base = /\.desktop-icon \{[\s\S]*?\n}/.exec(styles)?.[0] ?? "";
  assert.doesNotMatch(base, /transition:/, "base shortcut must not move when animations are disabled");
});

test("the five refreshed shortcut icons animate semantic parts only in full motion", () => {
  for (const part of ["icon-virus-core", "icon-broadcast-signal-inner", "icon-info-lines", "icon-guide-front", "icon-settings-knob-a"]) {
    assert.ok(icons.includes(part), `missing semantic icon part ${part}`);
    const animationLine = styles.split("\n").find((line) => line.includes(`.${part}`) && line.includes("animation:")) ?? "";
    assert.ok(animationLine.startsWith('  html[data-motion="full"]'), `${part} is not gated by full motion`);
  }
  for (const retired of ["icon-turn", "icon-spike", "icon-ripple", "icon-blink", "icon-folder-index", "icon-slide-left", "icon-slide-right"]) {
    assert.ok(!styles.includes(`@keyframes ${retired}`), `retired animation ${retired} is still shipped`);
  }
  // Explicitly excluded by the owner: employees, charter, sheet and trash retain their established gestures.
  for (const kept of ["icon-hop", "icon-lift", "icon-stamp", "icon-write-16", "icon-lid"]) assert.ok(styles.includes(`@keyframes ${kept}`), kept);
});

test("promotion shortcut builds momentum through its levels before the arrow launches", () => {
  for (const part of ["icon-promotion-base", "icon-promotion-level-low", "icon-promotion-level-high", "icon-promotion-arrow"]) {
    assert.ok(icons.includes(part), `missing semantic promotion part ${part}`);
    const animationLine = styles.split("\n").find((line) => line.includes(`.${part}`) && line.includes("animation:")) ?? "";
    assert.ok(animationLine.startsWith('  html[data-motion="full"]'), `${part} is not gated by full motion`);
  }
  assert.ok(styles.includes("@keyframes icon-promotion-launch"));
  assert.ok(!styles.includes("@keyframes icon-promotion-rise"));
});

test("animated shortcuts keep one precise vector artwork through the resting handoff", () => {
  assert.ok(icons.includes('<svg viewBox="0 0 24 24"'));
  assert.match(styles, /\.desktop-icon-symbol svg[^{]*\{[^}]*shape-rendering:\s*geometricPrecision/);
  assert.match(styles, /\.desktop-icon-symbol svg \*[^{]*\{[^}]*vector-effect:\s*non-scaling-stroke/);
  assert.doesNotMatch(styles, /\[data-icon[^\n]*svg\s*\{[^}]*scale:/);
  const refreshed = [
    "icon-virus-core", "icon-virus-spikes", "icon-virus-tips",
    "icon-broadcast-beacon", "icon-broadcast-wave",
    "icon-info-page", "icon-info-fold", "icon-info-line",
    "icon-guide-back", "icon-guide-front",
    "icon-settings-rails", "icon-settings-a", "icon-settings-b", "icon-settings-c",
    "icon-promotion-base", "icon-promotion-level", "icon-promotion-launch",
  ];
  for (const name of refreshed) {
    const keyframes = new RegExp(`@keyframes ${name} \\{[\\s\\S]*?100% \\{`).exec(styles)?.[0] ?? "";
    assert.ok(keyframes, `${name} has no explicit resting frame`);
  }
  const refreshedAnimationLines = styles.split("\n").filter((line) => refreshed.some((name) => line.includes(`animation: ${name} `)));
  assert.ok(refreshedAnimationLines.length >= refreshed.length);
  assert.ok(refreshedAnimationLines.every((line) => line.includes(" both;")), "refreshed icon animation must retain its exact terminal frame");
});

test("guide sections start folded and the compact back control does not cover card content", () => {
  assert.ok(source.includes('const guideCollapsedStorageKey = "portia-guide-collapsed-v2"'));
  assert.ok(source.includes("const initialCollapsed = useRef(sections.map((section) => section.id))"));
  assert.ok(source.includes("useState<string[]>(() => initialCollapsed.current)"));
  const back = /\.guide-back-bar \{([^}]*)\}/.exec(styles)?.[1] ?? "";
  assert.match(back, /height:\s*36px/);
  assert.match(back, /margin:\s*0 0 16px/);
  assert.doesNotMatch(back, /position:\s*(sticky|absolute|fixed)/);
  assert.doesNotMatch(back, /margin:\s*-/);
});
