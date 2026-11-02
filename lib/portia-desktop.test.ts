import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { componentFamily } from "./component-source.ts";

const desktopFamily = componentFamily("portia-desktop");
const editorFamily = componentFamily("portia-editor");
const source = desktopFamily.map((part) => part.text).join("\n");
const editorSource = editorFamily.map((part) => part.text).join("\n");
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
  const handle = /<[a-z]+\b[^>]*className="order-drag-handle"[^>]*>/.exec(editorSource)?.[0] ?? "";
  assert.ok(handle, "handle not found");
  assert.ok(!handle.includes("title="), handle);
});

test("the editor imports rich-text-style once and ships no joke or empty labels (TEST-02, A11Y-03)", () => {
  for (const part of editorFamily) assert.ok(part.text.split('from "@/lib/rich-text-style"').length - 1 <= 1, `${part.file} imports rich-text-style twice`);
  assert.ok(editorSource.includes('from "@/lib/rich-text-style"'));
  assert.doesNotMatch(editorSource, /<small>\s*<\/small>|<small\s*\/>/);
  for (const word of ["\u0444\u0438\u0433\u043d\u0438", "\u0434\u0440\u0443\u0436\u043e\u043a", "\u043f\u0438\u0440\u043e\u0436\u043e\u043a"]) {
    assert.ok(!editorSource.includes(word), `joke word ${word} is back`);
  }
});

test("component families start with the full main file", () => {
  const mainFile = (name: string) => readFileSync(new URL(`../components/${name}.tsx`, import.meta.url), "utf8");
  assert.equal(desktopFamily[0].text, mainFile("portia-desktop"));
  assert.equal(editorFamily[0].text, mainFile("portia-editor"));
});

test("component families import only their own seams and the known shared components", () => {
  const allowed = {
    "portia-desktop": ["portia-icons", "portia-wallpaper", "custom-color-picker", "portia-promotion"],
    "portia-editor": ["custom-color-picker", "portia-promotion-editor"],
  } as const;
  for (const [main, family] of [["portia-desktop", desktopFamily], ["portia-editor", editorFamily]] as const) {
    const members = family.map((part) => part.file.replace(/\.tsx$/, ""));
    for (const part of family) {
      for (const match of part.text.matchAll(/(from |import\()\s*"@\/components\/([a-z0-9-]+)"/g)) {
        const name = match[2];
        const dynamic = match[1] === "import(";
        if (main === "portia-desktop" && name === "portia-editor") {
          assert.ok(dynamic, `${part.file}: the editor must stay behind next/dynamic, not a static import`);
          continue;
        }
        assert.ok(members.includes(name) || (allowed[main] as readonly string[]).includes(name), `${part.file} imports components/${name}, which is not a ${main} seam or a known shared component`);
      }
    }
  }
});

test("STAB-DESK-07: app ids, storage keys and API endpoints stay as pinned", () => {
  const keys = (text: string) => [...new Set([...text.matchAll(/"(portia-[a-z0-9-]+-v\d+)"/g)].map((match) => match[1]))].sort();
  const endpoints = (text: string) => {
    const found: Record<string, number> = {};
    for (const match of text.matchAll(/["`](\/api\/[a-z/-]+)/g)) found[match[1]] = (found[match[1]] ?? 0) + 1;
    return found;
  };
  assert.equal(/type AppId = ([^;]+);/.exec(source)?.[1], '"archive" | "employees" | "search" | "info" | "guide" | "promotion" | "settings" | "broadcasts" | "trash" | "sheet" | "charter" | "editor"');
  assert.deepEqual(keys(source), ["portia-broadcasts-read-signature-v1", "portia-content-last-success-v1", "portia-desktop-shortcuts-v3", "portia-employees-last-success-v1", "portia-guide-collapsed-v2", "portia-quests-seen-v1", "portia-taskbar-order-v1"]);
  assert.deepEqual(keys(editorSource), ["portia-format-panel-v1"]);
  assert.deepEqual(endpoints(source), { "/api/content": 2, "/api/access": 1, "/api/employees": 1 });
  assert.deepEqual(endpoints(editorSource), { "/api/uploads": 1, "/api/employees/editor": 1, "/api/employees": 3, "/api/editors": 4 });
});

test("every desktop shortcut owns a default position and saved positions override only itself", () => {
  const layout = /const defaultShortcutLayout:[\s\S]*?\n};/.exec(source)?.[0] ?? "";
  for (const id of ["search", "archive", "employees", "broadcasts", "info", "guide", "promotion", "settings", "charter", "sheet", "trash"]) {
    assert.match(layout, new RegExp(`\\n  ${id}: shortcutLayout\\(`), `missing independent layout for ${id}`);
  }
  assert.ok(source.includes("position ? savedShortcutLayout(position) : defaultShortcutLayout[shortcutId]"));
  assert.ok(source.includes('"--shortcut-left": `max(8px, min(${position.x}px, calc(100% - 118px)))`'));
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

test("global search covers applications, employees and every existing content collection", () => {
  assert.ok(source.includes("globalSearchAppIds.map"));
  assert.ok(source.includes('type: "employee" as const'));
  assert.ok(source.includes('type: "app" as const'));
  assert.ok(source.includes('openApp("employees")'));
  for (const collection of ["content.viruses", "content.infoSections", "content.guideSections", "content.broadcasts", "content.recycleFiles", "recycledViruses"]) {
    assert.ok(source.includes(collection), collection);
  }
});

test("editor collections scroll inside bounded panes and the table of contents no longer follows the page", () => {
  assert.match(styles, /\.editor-record-list\s*\{[^}]*max-height:[^;}]+;[^}]*overflow-y:\s*auto/);
  assert.match(styles, /\.editor-record-list\s*\{[^}]*overflow-x:\s*hidden/);
  assert.match(styles, /\.virus-editor-layout\s*\{[^}]*grid-template-columns:\s*clamp\(240px, 28vw, 300px\)/);
  assert.match(styles, /\.editor-toc\s*\{[^}]*position:\s*relative/);
  assert.match(styles, /\.promotion-request-list, \.promotion-bank-list\s*\{[^}]*overflow-y:\s*auto/);
  assert.match(styles, /\.promotion-bank-editor, \.promotion-preview\s*\{[^}]*overflow-y:\s*auto/);
});

test("editor scrolls as one page and its tabs use the whole window", () => {
  assert.doesNotMatch(styles, /\.content-editor\s*\{\s*overflow-y:\s*hidden/);
  assert.doesNotMatch(styles, /\.flat-editor-form\s*\{[^}]*max-width/);
  for (const cap of [/\.compact-editor\s*\{/, /\.assistant-editor\s*\{/, /\.access-editor\s*\{/]) assert.doesNotMatch(styles, cap);
  assert.match(styles, /\.content-editor > \.promotion-editor\s*\{[^}]*flex:\s*1 1 0/);
  assert.match(styles, /\.recommendation-order-list\s*\{[^}]*max-width:\s*720px/);
  assert.match(styles, /\.access-editor-list\s*\{[^}]*max-width:\s*760px/);
});

test("window tiles keep their own size and every recommendation is shown", () => {
  assert.match(styles, /\.broadcast-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(min\(100%,\s*340px\),\s*340px\)\)/);
  assert.match(styles, /\.broadcast-grid\s*\{[^}]*align-items:\s*start/);
  assert.match(styles, /\.broadcast-grid > \.broadcast-empty\s*\{[^}]*grid-column:\s*1 \/ -1/);
  assert.match(styles, /\.guide-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(min\(100%,\s*176px\),\s*176px\)\)/);
  assert.ok(source.includes("content.searchRecommendations.map("));
});

test("editor form cards keep one fixed width set by a single variable and fill columns on desktop only (D-15)", () => {
  assert.equal(styles.match(/--editor-card-width:/g)?.length, 1);
  assert.match(styles, /--editor-card-width:\s*340px/); // 18-MOTION-APPROVAL item 5
  const desktop = /@media \(min-width: 901px\) \{\s*\.editor-card-columns \{[^}]*\}/.exec(styles)?.[0] ?? "";
  assert.match(desktop, /grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(min\(100%,\s*var\(--editor-card-width\)\),\s*var\(--editor-card-width\)\)\)/);
  assert.match(desktop, /align-items:\s*start/);
  assert.match(styles, /\.editor-card-columns > :not\(\.nested-editor-card\)\s*\{[^}]*grid-column:\s*1 \/ -1/);
  assert.match(styles, /\.editor-card-columns > \.nested-editor-card \+ \.nested-editor-card\s*\{[^}]*margin-top:\s*0/);
  // It must follow .flat-editor-form (same specificity) to win the cascade, and the sorted lists stay one column.
  assert.ok(styles.indexOf(".editor-card-columns {") > styles.indexOf(".flat-editor-form { display: grid"));
  for (const list of [".recommendation-order-list", ".access-editor-list"]) assert.doesNotMatch(styles, new RegExp(`\\${list}\\s*\\{[^}]*grid-template-columns`));
  for (const lead of ["Каждый блок становится", "Справочник на рабочем столе", "Публикуйте новости"]) {
    assert.ok(editorSource.includes(`<div className="editor-form flat-editor-form editor-card-columns">\n          <p className="editor-guidance">${lead}`), `${lead}: form must be in columns`);
  }
  assert.equal(editorSource.match(/editor-card-columns/g)?.length, 3); // never the sorted recommendation or access lists (D-15)
});

test("drag sorting in columns decides by reading order and slides rows along both axes", () => {
  const dossier = readFileSync(new URL("../components/portia-editor-dossier.tsx", import.meta.url), "utf8");
  assert.ok(dossier.includes('from "@/lib/sort-order"'));
  assert.match(dossier, /passesTarget\(/);
  assert.match(dossier, /offsetLeft/);
  assert.match(dossier, /translate\(\$\{previous\.left - left\}px, \$\{previous\.top - top\}px\)/);
  assert.ok(dossier.includes("if (!row) { moveAcross(parent, hits, x, y); return; }")); // moveAcross and the same-parent rule are untouched
});

test("on phone Vivian is hidden while a window is open and is a sibling of the workspace (STAB-DESK-04)", () => {
  const phone = /@media \(max-width: 900px\) \{\s*\.quest-toast[\s\S]*?\n\}/.exec(styles)?.[0] ?? "";
  assert.match(phone, /\.workspace\.mobile-app-open ~ \.desktop-assistant\s*\{\s*display:\s*none;\s*\}/);
  assert.match(source, /<main className=\{`workspace\$\{[^`]*" mobile-app-open"/);
  assert.ok(source.indexOf('className={`desktop-assistant') > source.indexOf("</main>"), "the sibling selector needs the assistant after <main>");
});

test("Vivian follows the interface accent without painful overexposure or greying the image itself", () => {
  assert.match(styles, /\.assistant-button\s*\{[^}]*filter:\s*var\(--assistant-filter\) brightness\(1\.1\) saturate\(1\.08\)/);
  assert.match(styles, /\.assistant-button img\s*\{[^}]*filter:\s*none/);
});

test("shortcut motion survives pointer exit until every delayed icon part reaches its terminal frame", () => {
  assert.ok(source.includes("const shortcutAnimationMs = 700"));
  assert.ok(source.includes("function useShortcutAnimation()"));
  assert.ok(source.includes('iconAnimation.playing ? " is-icon-animating"'));
  assert.ok(source.includes("<StartPanelButton"));
  assert.match(styles, /\.desktop-icon\.is-icon-animating/);
  assert.match(styles, /\.start-panel > button\.is-icon-animating/);
  assert.doesNotMatch(styles, /\.desktop-icon:is\(:hover, :focus-visible, \.is-icon-animating\)/);
});

test("active remote media receives connection and fetch priority while background collections stay lazy", () => {
  assert.match(source, /import \{ preconnect, preload \} from "react-dom"/);
  assert.match(source, /preload\(src, \{ as: "image", fetchPriority: "high", referrerPolicy: "no-referrer" \}\)/);
  assert.match(source, /function LoadingMedia[\s\S]*loading="eager"[\s\S]*fetchPriority="high"/);
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

test("the five refreshed shortcut icons animate semantic parts except in «Выключены»", () => {
  for (const part of ["icon-virus-core", "icon-broadcast-signal-inner", "icon-info-lines", "icon-guide-front", "icon-settings-knob-a"]) {
    assert.ok(icons.includes(part), `missing semantic icon part ${part}`);
    const animationLine = styles.split("\n").find((line) => line.includes(`.${part}`) && line.includes("animation:")) ?? "";
    assert.ok(animationLine.startsWith('html:not([data-motion="off"])'), `${part} is not gated by html:not([data-motion="off"])`);
  }
  for (const retired of ["icon-turn", "icon-spike", "icon-ripple", "icon-blink", "icon-folder-index", "icon-slide-left", "icon-slide-right"]) {
    assert.ok(!styles.includes(`@keyframes ${retired}`), `retired animation ${retired} is still shipped`);
  }
  // Explicitly excluded by the owner: employees, charter, sheet and trash retain their established gestures.
  for (const kept of ["icon-hop", "icon-lift", "icon-stamp", "icon-write-32", "icon-lid"]) assert.ok(styles.includes(`@keyframes ${kept}`), kept);
});

test("the virus shortcut uses a contained diagnostic scan and returns to its exact resting artwork", () => {
  assert.ok(icons.includes('className="icon-virus-scan"'));
  assert.ok(icons.includes('className="icon-virus-detail"'));
  assert.ok(styles.includes("@keyframes icon-virus-scan"));
  assert.ok(styles.includes("@keyframes icon-virus-detail"));
  assert.match(styles, /@keyframes icon-virus-scan \{[\s\S]*100% \{[^}]*opacity:\s*0/);
});

test("promotion shortcut builds momentum through its levels before the arrow launches", () => {
  for (const part of ["icon-promotion-base", "icon-promotion-level-low", "icon-promotion-level-high", "icon-promotion-arrow"]) {
    assert.ok(icons.includes(part), `missing semantic promotion part ${part}`);
    const animationLine = styles.split("\n").find((line) => line.includes(`.${part}`) && line.includes("animation:")) ?? "";
    assert.ok(animationLine.startsWith('html:not([data-motion="off"])'), `${part} is not gated by html:not([data-motion="off"])`);
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
  assert.ok(source.includes("useState<string[]>(() => sections.map((section) => section.id))"));
  assert.doesNotMatch(source, /initialCollapsed\.current/);
  const back = /\.guide-back-bar \{([^}]*)\}/.exec(styles)?.[1] ?? "";
  assert.match(back, /height:\s*36px/);
  assert.match(back, /margin:\s*0 0 16px/);
  assert.doesNotMatch(back, /position:\s*(sticky|absolute|fixed)/);
  assert.doesNotMatch(back, /margin:\s*-/);
});

// ---- Shortcut cycle system (Phase 18-03, 18-MOTION-APPROVAL.md item 1) ----
const shortcutCycleMs = 560; // approved cycle
const shortcutStaggerMs = 90; // max offset between parts
const shortcutMaxMs = 700; // whole cycle incl. offsets
const shortcutsSource = readFileSync(new URL("../components/portia-desktop-shortcuts.tsx", import.meta.url), "utf8");
const cyclePrefix = 'html:not([data-motion="off"]) :is(.desktop-icon.is-icon-animating .desktop-icon-symbol, .start-panel > button.is-icon-animating .start-panel-icon)';

// Every animation declaration that targets one shortcut icon: line, keyframes name, duration/delay (ms), easing token.
function iconCycles(icon: string) {
  return styles.split("\n").filter((line) => line.includes(`[data-icon="${icon}"]`) && line.includes("animation:")).map((line) => {
    const tokens = /animation:([^;}]*)/.exec(line)![1].trim().split(/\s+/);
    const ms = tokens.filter((token) => /^\d+ms$/.test(token)).map((token) => parseInt(token, 10));
    return { line, name: tokens[0], duration: ms[0], delay: ms[1] ?? 0, easing: tokens.find((token) => token.startsWith("var(--ease") || token.startsWith("cubic-bezier")), tokens };
  });
}

function keyframesBody(name: string) {
  const open = styles.indexOf("{", styles.indexOf(`@keyframes ${name} {`));
  return styles.slice(open + 1, closingBrace(styles, open));
}

function assertIconCycle(icon: string) {
  const cycles = iconCycles(icon);
  assert.ok(cycles.length > 0, `${icon}: no cycle rules`);
  for (const cycle of cycles) {
    assert.ok(cycle.line.startsWith(cyclePrefix), `${icon}: rule is not gated by html:not([data-motion="off"]) at top level: ${cycle.name}`);
    assert.equal(cycle.duration, shortcutCycleMs, `${icon}/${cycle.name}: duration`);
    assert.ok(cycle.delay <= shortcutStaggerMs, `${icon}/${cycle.name}: offset ${cycle.delay}ms`);
    assert.ok(cycle.duration + cycle.delay <= shortcutMaxMs, `${icon}/${cycle.name}: whole cycle`);
    assert.equal(cycle.easing, "var(--ease-out)", `${icon}/${cycle.name}: easing must be the token`);
    const body = keyframesBody(cycle.name);
    assert.ok(body, `${icon}: missing @keyframes ${cycle.name}`);
    const final = /(?:100%|to)\s*\{([^}]*)\}/.exec(body)?.[1];
    if (final !== undefined) {
      // The last frame is the resting frame (the virus scan layer rests invisible).
      const rest: Record<string, string[]> = { translate: ["0 0"], opacity: cycle.name === "icon-virus-scan" ? ["0"] : ["1"], scale: ["1", "1 1"], rotate: ["0deg"], "stroke-dashoffset": ["0"] };
      for (const declaration of final.split(";").map((part) => part.trim()).filter(Boolean)) {
        const [property, value] = declaration.split(/:\s*/);
        if (cycle.name === "icon-virus-scan" && property !== "opacity") continue;
        assert.ok(rest[property]?.includes(value), `${cycle.name}: 100% frame ${property}: ${value} is not the resting frame`);
      }
    }
    if (/(?<![\d.])(?!0%|100%)\d+%\s*\{/.test(body)) {
      assert.ok(body.includes("animation-timing-function: var(--ease-in)"), `${cycle.name}: return segment must use --ease-in`);
    }
  }
}

const shortcutIcons = ["search", "virus", "employees", "broadcasts", "info", "guide", "settings", "promotion", "charter", "sheet", "trash", "editor"];

test("shortcut cycle: all 12 icons follow the approved system and end on the resting frame", () => {
  for (const icon of shortcutIcons) assertIconCycle(icon);
  assert.deepEqual(iconCycles("settings").map((cycle) => cycle.delay).sort((a, b) => a - b), [0, 0, 45, 90]);
});

// Frames of one @keyframes body as { at: 0..100, declarations }, "from"/"to" read as 0/100.
function keyframeFrames(name: string) {
  return [...keyframesBody(name).matchAll(/([^{}]+)\{([^}]*)\}/g)].flatMap((match) =>
    match[1].split(",").map((selector) => selector.trim()).map((selector) => ({ at: selector === "from" ? 0 : selector === "to" ? 100 : parseFloat(selector), declarations: match[2] })));
}
const cycleKeyframeNames = () => [...new Set(shortcutIcons.flatMap((icon) => iconCycles(icon).map((cycle) => cycle.name)))];

test("shortcut cycle: the segment into the resting frame runs on the rule's --ease-out, so the icon settles instead of clicking into place (quick 261102-d7r)", () => {
  for (const name of cycleKeyframeNames()) {
    const frames = keyframeFrames(name);
    const inner = frames.filter((frame) => frame.at > 0 && frame.at < 100).sort((a, b) => b.at - a.at);
    if (inner.length) assert.ok(frames.some((frame) => frame.at === 100), `${name}: has intermediate frames but no explicit 100% / to`);
    const last = [...frames.filter((frame) => frame.at < 100)].sort((a, b) => b.at - a.at)[0];
    assert.ok(last, `${name}: no frames`);
    assert.ok(!last.declarations.includes("animation-timing-function: var(--ease-in)"), `${name}: the last frame before the rest (${last.at}%) is on --ease-in`);
  }
});

test("shortcut cycle: write-on lines are drawn in full before the class is removed (quick 261102-d7r)", () => {
  // stroke-dasharray is discrete: inside keyframes it flips mid-cycle instead of animating.
  for (const name of cycleKeyframeNames()) assert.doesNotMatch(keyframesBody(name), /stroke-dasharray/, `${name}: dasharray inside keyframes`);
  // non-scaling-stroke makes dashes count in screen px; the largest shortcut symbol sets the worst case.
  const widths = [...styles.matchAll(/\.desktop-icon-symbol\s*\{[^}]*?\bwidth:\s*(\d+)px/g)].map((match) => Number(match[1]));
  const screenPerUnit = (Math.max(...widths) * 0.58) / 24;
  assert.ok(Math.max(...widths) >= 62);
  // Longest sub-path of the animated element in viewBox units (components/portia-icons.tsx): sheet `M4 9h16M4 14h16M10 9v11`, editor `v16`, info `h7`.
  const longest: Record<string, number> = { sheet: 16, editor: 16, info: 7 };
  for (const [icon, units] of Object.entries(longest)) {
    const dashed = iconCycles(icon).filter((cycle) => /stroke-dasharray:\s*\d+/.test(cycle.line));
    assert.ok(dashed.length > 0, `${icon}: no dashed write-on rule`);
    for (const cycle of dashed) {
      const length = Number(/stroke-dasharray:\s*(\d+)/.exec(cycle.line)![1]);
      assert.ok(length >= units && length >= units * screenPerUnit, `${icon}: dasharray ${length} does not cover ${units} units / ${(units * screenPerUnit).toFixed(1)}px`);
      const start = keyframeFrames(cycle.name).find((frame) => frame.at === 0);
      assert.match(start?.declarations ?? "", new RegExp(`stroke-dashoffset:\\s*${length}\\b`), `${cycle.name}: starts fully undrawn`);
      assert.match(keyframeFrames(cycle.name).find((frame) => frame.at === 100)?.declarations ?? "", /stroke-dashoffset:\s*0/, `${cycle.name}: ends fully drawn`);
    }
  }
});

test("«База вирусов» is about 0.86 of the other shortcut icons on the desktop and in «Пуск» (size only, artwork untouched)", () => {
  const desktop = /\.desktop-icon-symbol\[data-icon="virus"\] svg\s*\{([^}]*)\}/.exec(styles)?.[1] ?? "";
  const start = /\.start-panel-icon\[data-icon="virus"\] svg\s*\{([^}]*)\}/.exec(styles)?.[1] ?? "";
  for (const side of ["width", "height"]) {
    const percent = Number(new RegExp(`${side}:\\s*([\\d.]+)%`).exec(desktop)?.[1]);
    const pixels = Number(new RegExp(`${side}:\\s*([\\d.]+)px`).exec(start)?.[1]);
    assert.ok(percent >= 46 && percent <= 52, `desktop ${side} ${percent}% (others 58%)`);
    assert.ok(pixels >= 15 && pixels <= 18, `start panel ${side} ${pixels}px (others 19px)`);
  }
});

test("shortcut animation timer outlasts the longest cycle and does not depend on animationend", () => {
  const timer = /const shortcutAnimationMs = (\d+);/.exec(shortcutsSource)?.[1];
  assert.equal(timer, String(shortcutMaxMs));
  assert.doesNotMatch(shortcutsSource, /onAnimationEnd|addEventListener\("animationend"/);
  for (const icon of shortcutIcons) for (const cycle of iconCycles(icon)) assert.ok(cycle.duration + cycle.delay <= Number(timer));
});

test("the soft-motion blanket rule leaves shortcut icon artwork alone so the cycle plays in Уменьшены", () => {
  const soft = styles.split("\n").find((line) => line.startsWith('html[data-motion="reduced"], html[data-motion="reduced"] *')) ?? "";
  assert.ok(soft, "soft-motion blanket rule not found");
  const exclusion = ":not(:is(.desktop-icon-symbol, .start-panel-icon) svg, :is(.desktop-icon-symbol, .start-panel-icon) svg *)";
  for (const target of ["*", "*::before", "*::after"]) {
    const selector = target.replace("*", `*${exclusion}`);
    assert.ok(soft.includes(`html[data-motion="reduced"] ${selector}`), `soft rule is missing the shortcut exclusion on ${target}`);
  }
});

test("shortcut rules sit outside any hover media query and keep no private easing curves", () => {
  const from = styles.indexOf("/* Hover, keyboard focus and touch on app icons");
  const to = styles.indexOf("@keyframes icon-scan");
  assert.ok(from > 0 && to > from);
  const block = styles.slice(from, to);
  assert.doesNotMatch(block, /@media/);
  assert.doesNotMatch(block, /cubic-bezier/);
  assert.doesNotMatch(block, /^\s+html\[data-motion/m, "no indented (media-wrapped) or full-only shortcut rules");
  assert.ok(block.includes('html:not([data-motion="off"]) :is(.desktop-icon-symbol, .start-panel-icon) svg > * { transform-box: fill-box; transform-origin: center; }'));
  for (const retired of ["cubic-bezier(.2,.72,.25,1)", "cubic-bezier(.2,.85,.25,1)"]) assert.ok(!styles.includes(retired));
});

test("the promotion arrow is not silenced by the soft-mode rule: it plays in Уменьшены and is static only in Выключены", () => {
  const rule = styles.split("\n").find((line) => line.startsWith('html:is([data-motion="reduced"], [data-motion="off"]) :is(.promotion-card')) ?? "";
  assert.ok(rule);
  assert.ok(!rule.includes("icon-promotion-arrow"));
  assert.ok(iconCycles("promotion").some((cycle) => cycle.name === "icon-promotion-launch"));
});

test("shortcut artwork is not redrawn: the cycle animates only translate/scale/rotate/opacity/dash offset", () => {
  for (const icon of shortcutIcons) for (const cycle of iconCycles(icon)) {
    const body = keyframesBody(cycle.name);
    assert.doesNotMatch(body, /(?<![\w-])(filter|transform|viewBox|d):/, `${cycle.name} must not touch filter, transform or geometry`);
  }
});

// Phase 19-08: one set of state components inside the existing window bodies (D-05..D-08, STAB-DESK-08, STAB-APP-10).
const statesSource = desktopFamily.find((part) => part.file === "portia-desktop-states.tsx")?.text ?? "";
const desktopMain = desktopFamily[0].text;
const count = (text: string, needle: string) => text.split(needle).length - 1;

test("the fatal panel and the skeleton are exported once, with one retry label and the alert on the text only (D-06, D-08)", () => {
  assert.equal(statesSource.match(/^export function (AppFatalPanel|AppSkeleton)\b/gm)?.length, 2);
  assert.equal(count(statesSource, "Повторить загрузку"), 1);
  assert.ok(statesSource.includes("Загружаем…"));
  // role="alert" sits on the heading and body, not on the button, so a retry never re-announces the panel.
  const fatal = statesSource.slice(statesSource.indexOf("export function AppFatalPanel"), statesSource.indexOf("export function AppDeniedPanel"));
  assert.equal(count(fatal, 'role="alert"'), 1);
  assert.ok(fatal.indexOf('role="alert"') < fatal.indexOf("<button") && fatal.indexOf("</div>") < fatal.indexOf("<button"), "the alert closes before the retry button");
  assert.match(statesSource, /aria-busy="true"/);
  assert.ok(statesSource.includes("failureCopy") && statesSource.includes("iframeFailureCopy"));
});

test("skeleton and state-panel CSS: shimmer only under data-motion=full, 150ms delayed show, only 11/13/16px fonts", () => {
  assert.ok(styles.includes('html[data-motion="full"] .skeleton-block'));
  assert.ok(/\.skeleton-block\s*\{[^}]*var\(--panel-2\)/.test(styles));
  assert.ok(/\.app-skeleton\s*\{[^}]*loader-appear 1ms linear 150ms forwards/.test(styles));
  assert.ok(/\.app-fatal-panel[^{]*\{[^}]*padding: 32px 24px/.test(styles));
  const rules = styles.split("\n").filter((line) => /^(?:html\[[^\]]*\] )?\.(app-fatal-panel|app-denied-panel|app-skeleton|skeleton-)/.test(line));
  assert.ok(rules.length >= 4);
  for (const rule of rules) for (const size of rule.matchAll(/font(?:-size)?:\s*(?:\d+\s+)?(\d+(?:\.\d+)?)px/g)) assert.ok(["11", "13", "16"].includes(size[1]), `unexpected font size in: ${rule.slice(0, 60)}`);
});

test("«Справочник» body picks its render by appViewState: skeleton, fatal panel with retry, stale strip (D-05, D-06)", () => {
  const start = desktopMain.indexOf('<AppWindow app="guide"');
  const body = desktopMain.slice(start, desktopMain.indexOf("</AppWindow>", start));
  assert.ok(body.includes('<AppSkeleton shape="guide"'));
  assert.match(body, /<AppFatalPanel|contentFatal\(/);
  assert.match(body, /<AppStaleBanner|contentStaleBanner/);
  assert.ok(!body.includes("Загрузка справочника"));
  // the shared fatal panel and stale strip of the content apps both retry through retryContent
  assert.match(desktopMain, /const contentStaleBanner = .*retryContent\(\)/);
  assert.match(desktopMain, /const contentFatal = .*retryContent\(\)/);
  assert.ok(desktopMain.includes("const guideView = appViewState("));
});

function windowBody(app: string) {
  const start = desktopMain.indexOf(`<AppWindow app="${app}"`);
  assert.ok(start >= 0, `window ${app}`);
  return desktopMain.slice(start, desktopMain.indexOf("</AppWindow>", start));
}

test("every data window picks skeleton, fatal panel, stale strip and the shared empty text from appViewState (D-05..D-08)", () => {
  assert.ok(count(desktopMain, "appViewState(") >= 6, "one appViewState call per data window");
  const rows: [string, string, string[]][] = [
    ["archive", "archive", ["archive"]],
    ["employees", "employees", ["employees"]],
    ["info", "info", ["info"]],
    ["broadcasts", "broadcasts", ["[broadcastTab]"]],
    ["trash", "trash", ["trash"]],
  ];
  for (const [app, shape, keys] of rows) {
    const body = windowBody(app);
    assert.ok(body.includes(`<AppSkeleton shape="${shape}"`), `${app} skeleton`);
    assert.match(body, /<AppFatalPanel|contentFatal\(/, `${app} fatal`);
    assert.match(body, /<AppStaleBanner|contentStaleBanner/, `${app} stale`);
    for (const key of keys) assert.ok(body.includes(key.startsWith("[") ? `emptyCopy${key}` : `emptyCopy.${key}`), `${app} empty ${key}`);
    assert.ok(!body.includes("<LoadingState"), `${app} no spinner loader`);
  }
  assert.ok(!desktopMain.includes("В базе пока нет вирусов") && !desktopMain.includes("Квестов и задач пока нет"));
});

test("a failed roster fetch writes employeesSync and never touches the roster; only a complete answer moves lastGoodAt (STAB-APP-02)", () => {
  const start = desktopMain.indexOf("const fetchEmployees = useCallback");
  const body = desktopMain.slice(start, desktopMain.indexOf("useEffect(", start));
  const failed = body.slice(body.indexOf("if (!response.ok)"), body.indexOf("const payload"));
  assert.ok(failed.includes("failureFromResponse(response.status"));
  assert.ok(!failed.includes("setEmployees("));
  assert.ok(body.includes("contentSyncFailed(") && body.includes("contentSyncSucceeded("));
  assert.ok(/degraded !== false/.test(body), "only degraded === false is a complete roster");
  // the last good roster survives in the same state the failure leaves untouched
  assert.equal(count(body, "setEmployees("), 1);
  assert.ok(desktopMain.includes("retryEmployees"));
});

test("«Корзина» shows no restore or delete control on the desktop; the editor's permanent delete says it cannot be restored and refuses by name (STAB-APP-05, T-19-19)", () => {
  const trash = windowBody("trash");
  assert.doesNotMatch(trash, /Восстановить|Удалить навсегда|УДАЛИТЬ НАВСЕГДА|onRestore|onDelete/);
  for (const dialog of ["delete", "delete-file"]) {
    const start = editorSource.indexOf(`dialog === "${dialog}"`);
    assert.ok(start >= 0, dialog);
    const block = editorSource.slice(start, editorSource.indexOf("/>", start));
    assert.ok(block.includes("её не восстановить"), `${dialog} says it cannot be restored`);
    assert.ok(block.includes('label: "УДАЛИТЬ НАВСЕГДА"'), `${dialog} keeps the action label`);
    assert.ok(block.includes('label: "Не удалять"') && !block.includes("ОТМЕНА"), `${dialog} names the refusal`);
  }
});

test("«Таблица» and «Устав»: skeleton until onLoad, fatal panel after the 15s timeout, retry remounts the frame; sandbox and zoom stay (STAB-APP-06, T-19-20)", () => {
  const documents = desktopFamily.find((part) => part.file === "portia-desktop-documents.tsx")?.text ?? "";
  const start = documents.indexOf("export function EmbeddedDocument");
  const embedded = documents.slice(start, documents.indexOf("// v2 starts every section folded", start));
  assert.match(embedded, /<iframe[^>]*key=\{frameKey\}[^>]*onLoad=/);
  assert.ok(embedded.includes("sandbox={embedSandbox}"));
  assert.equal(count(documents, "sandbox={embedSandbox}"), 2, "the document frame and the YouTube frame");
  assert.match(embedded, /useState<"loading" \| "loaded" \| "failed">\("loading"\)/);
  // The timer is armed only while loading, fires after iframeLoadTimeoutMs and is cleared on unmount, on load and on retry.
  assert.match(embedded, /window\.setTimeout\(\(\) => setFrameState\("failed"\), iframeLoadTimeoutMs\)/);
  assert.match(embedded, /return \(\) => window\.clearTimeout\(/);
  assert.match(embedded, /onLoad=\{\(\) => setFrameState\("loaded"\)\}/);
  assert.ok(embedded.includes('<AppSkeleton shape="document"'));
  assert.match(embedded, /<AppFatalPanel failure="iframe"[^>]*extra=\{/);
  assert.match(embedded, /setFrameKey\(\(key\) => key \+ 1\)/);
  assert.ok(embedded.includes('href={external}'));
  // zoom and fullscreen-facing handlers are unchanged
  for (const kept of ['aria-label="Уменьшить"', 'aria-label="Увеличить"', "onClick={() => setZoom(1)}", "step(event.deltaY < 0 ? 1 : -1)", "zoomModifier(event)"]) assert.ok(embedded.includes(kept), kept);
});

test("AppDeniedPanel shows only «Доступ закрыт» (and one fixed caller line) as an alert, without buttons (D-07)", () => {
  assert.equal(statesSource.match(/^export function AppDeniedPanel\b/gm)?.length, 1);
  const start = statesSource.indexOf("export function AppDeniedPanel");
  const panel = statesSource.slice(start, statesSource.indexOf("\n}\n", start));
  assert.ok(panel.includes("Доступ закрыт") && panel.includes('role="alert"') && panel.includes("detail"));
  assert.ok(!panel.includes("<button") && !panel.includes("onClick"));
});
