import test from "node:test";
import assert from "node:assert/strict";
import { componentFamily } from "./component-source.ts";
import { exitedWindow, openedWindow, originOf, visibleWindowCount, windowAppears, type OpenOrigin, type WindowState } from "./window-open.ts";

const bounds = { width: 1200, height: 800 };
const minimum = { width: 520, height: 420 };
const origin: OpenOrigin = { x: 40, y: 50, kind: "icon" };
const oldOrigin: OpenOrigin = { x: 900, y: 790, kind: "taskbar" };
const created = { x: 100, y: 80, width: 700, height: 500 };
const closed: WindowState = { open: false, minimized: false, maximized: false, z: 10 };

test("a closed window opens visible with the new origin and a cascaded geometry", () => {
  let calls = 0;
  const next = openedWindow(closed, origin, bounds, minimum, () => { calls += 1; return created; });
  assert.deepEqual(next, { open: true, minimized: false, maximized: false, z: 10, exiting: undefined, openOrigin: origin, geometry: created });
  assert.equal(calls, 1);
  assert.equal(windowAppears(closed), true);
});

test("a minimized window with a remembered geometry is restored, refitted and keeps maximized and z", () => {
  const state: WindowState = { open: true, minimized: true, maximized: true, z: 14, geometry: { x: 120, y: 90, width: 640, height: 480 }, openOrigin: oldOrigin };
  let calls = 0;
  const next = openedWindow(state, origin, bounds, minimum, () => { calls += 1; return created; });
  assert.equal(next.minimized, false);
  assert.equal(next.maximized, true);
  assert.equal(next.z, 14);
  assert.deepEqual(next.openOrigin, origin);
  assert.deepEqual(next.geometry, { x: 120, y: 90, width: 640, height: 480 });
  assert.equal(calls, 0);
});

test("re-opening a window that is closing or minimising cancels the exit", () => {
  for (const exiting of ["close", "minimize"] as const) {
    const state: WindowState = { open: true, minimized: false, maximized: false, z: 11, exiting, geometry: { x: 20, y: 20, width: 600, height: 450 }, openOrigin: oldOrigin };
    const next = openedWindow(state, origin, bounds, minimum, () => created);
    assert.equal(next.exiting, undefined);
    assert.equal(next.open, true);
    assert.deepEqual(next.openOrigin, origin);
    assert.equal(windowAppears(state), true);
  }
});

test("a visible window behind others only keeps its origin, so its animation is not replayed (D-05)", () => {
  const state: WindowState = { open: true, minimized: false, maximized: false, z: 12, geometry: { x: 20, y: 20, width: 600, height: 450 }, openOrigin: oldOrigin };
  assert.equal(windowAppears(state), false);
  const next = openedWindow(state, origin, bounds, minimum, () => created);
  assert.deepEqual(next, { ...state, exiting: undefined });
  assert.equal(next.openOrigin, oldOrigin);
});

test("a remembered geometry bigger than the screen is refitted inside the bounds and above the minimum", () => {
  const state: WindowState = { open: true, minimized: true, maximized: false, z: 10, geometry: { x: 700, y: 500, width: 2000, height: 1500 } };
  const next = openedWindow(state, origin, { width: 900, height: 600 }, minimum, () => created);
  const geometry = next.geometry!;
  assert.ok(geometry.x >= 0 && geometry.y >= 0);
  assert.ok(geometry.x + geometry.width <= 900);
  assert.ok(geometry.y + geometry.height <= 600);
  assert.ok(geometry.width >= minimum.width && geometry.height >= minimum.height);
});

test("only open, unminimised, non-exiting windows count as visible", () => {
  const windows: Record<string, WindowState> = {
    a: { open: true, minimized: false, maximized: false, z: 1 },
    b: { open: true, minimized: true, maximized: false, z: 1 },
    c: { open: true, minimized: false, maximized: false, z: 1, exiting: "close" },
    d: closed,
    e: { open: true, minimized: false, maximized: true, z: 1 },
  };
  assert.equal(visibleWindowCount(windows), 2);
});

test("openedWindow does not mutate its argument", () => {
  const state: WindowState = { open: true, minimized: true, maximized: false, z: 10, exiting: "minimize", geometry: { x: 20, y: 20, width: 600, height: 450 }, openOrigin: oldOrigin };
  const snapshot = structuredClone(state);
  openedWindow(state, origin, bounds, minimum, () => created);
  assert.deepEqual(state, snapshot);
});

test("closing resets open, minimized and maximized but keeps geometry, z and origin", () => {
  const geometry = { x: 20, y: 20, width: 600, height: 450 };
  const state: WindowState = { open: true, minimized: false, maximized: true, z: 17, exiting: "close", geometry, openOrigin: oldOrigin };
  assert.deepEqual(exitedWindow(state, "close"), { open: false, minimized: false, maximized: false, z: 17, exiting: undefined, geometry, openOrigin: oldOrigin });
});

test("minimising keeps the window open and maximized", () => {
  const state: WindowState = { open: true, minimized: false, maximized: true, z: 17, exiting: "minimize", openOrigin: oldOrigin };
  assert.deepEqual(exitedWindow(state, "minimize"), { open: true, minimized: true, maximized: true, z: 17, exiting: undefined, openOrigin: oldOrigin });
});

test("originOf is the centre of the element and keeps the kind", () => {
  const element = { getBoundingClientRect: () => ({ left: 10, top: 20, width: 40, height: 60 }) } as unknown as Element;
  assert.deepEqual(originOf(element, "taskbar"), { x: 30, y: 50, kind: "taskbar" });
});

// Source tests follow the desktop family, so they survive moving AppWindow and the icons into seam modules (17-06).
const source = componentFamily("portia-desktop").map((part) => part.text).join("\n").replace(/\r\n/g, "\n");

/** Text of the `{ ... }` body that opens at the end of `marker`; asserts the marker exists exactly once so no check passes on an empty match. */
function bodyAfter(marker: string): string {
  assert.equal(source.split(marker).length, 2, `expected exactly one: ${marker}`);
  const open = source.indexOf(marker) + marker.length - 1;
  assert.equal(source[open], "{", `marker must end at an opening brace: ${marker}`);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}" && (depth -= 1) === 0) return source.slice(open + 1, index);
  }
  throw new Error(`unbalanced braces after: ${marker}`);
}

const lockGuard = 'if (qualificationLocked && appId !== "promotion") return;';

test("openApp is declared once and, like focusApp, starts with the qualification guard (STAB-DESK-01, T-17-10)", () => {
  assert.ok(bodyAfter("const openApp = (appId: AppId, origin?: OpenOrigin) => {").trimStart().startsWith(lockGuard));
  assert.ok(bodyAfter("const focusApp = (appId: AppId) => {").trimStart().startsWith(lockGuard));
});

test("every desktop icon, start panel button and search result opens its window through openApp", () => {
  const icons = source.match(/<DesktopIcon app="\w+"[^\n]*\/>/g) ?? [];
  assert.equal(icons.length, 11);
  for (const icon of icons) assert.ok(icon.includes("onOpen={openApp}"), icon.slice(0, 40));
  const buttons = source.match(/<StartPanelButton [^\n]*\/>/g) ?? [];
  assert.equal(buttons.length, 5);
  for (const button of buttons) assert.ok(button.includes("openApp("), button.slice(0, 60));
  const search = bodyAfter("const openSearchResult = (result: (typeof searchResults)[number]) => {");
  assert.equal(search.split("openApp(").length - 1, 7);
  assert.ok(!/setWindows|open: true/.test(search));
});

test("a taskbar button restores a minimised or leaving window, minimises the active one, else focuses", () => {
  const restore = source.indexOf('openApp(app, originOf(event.currentTarget, "taskbar"))');
  const minimize = source.indexOf("else if (activeApp === app) minimizeApp(app);");
  const focus = source.indexOf("else focusApp(app);");
  assert.ok(restore > 0 && restore < minimize && minimize < focus);
  assert.ok(source.slice(restore - 70, restore).includes("windows[app].minimized || windows[app].exiting"));
});

test("a window is opened only by openedWindow, apart from the forced qualification window", () => {
  const literal = source.match(/\bopen: true\b/g) ?? [];
  assert.equal(literal.length, 1);
  assert.ok(bodyAfter("const updateQualificationLock = useCallback((locked: boolean) => {").includes("open: true"));
  assert.ok(bodyAfter("const openApp = (appId: AppId, origin?: OpenOrigin) => {").includes("openedWindow(state[appId]"));
});

test("each app id has exactly one AppWindow surface, which unmounts when closed but not when minimised", () => {
  for (const id of ["archive", "employees", "search", "info", "guide", "promotion", "broadcasts", "trash", "settings", "editor"]) {
    assert.equal(source.split(`<AppWindow app="${id}"`).length - 1, 1, id);
  }
  assert.equal(source.split('(["sheet", "charter"] as const).map((app) => <AppWindow').length - 1, 1);
  assert.equal(source.split("<AppWindow ").length - 1, 11);
  assert.ok(source.indexOf("function AppWindow(") < source.indexOf("if (!state.open) return null;"));
});

test("leaving a window only touches window, active app and editor close request state", () => {
  const allowed = new Set(["setWindows", "setActiveApp", "setEditorCloseRequest"]);
  for (const marker of ['const finishExit = (appId: AppId, kind: "close" | "minimize") => {', 'const requestExit = (appId: AppId, kind: "close" | "minimize", force = false) => {']) {
    const calls = new Set(bodyAfter(marker).match(/(?<![.\w])set[A-Z]\w*(?=\()/g) ?? []);
    for (const call of calls) assert.ok(allowed.has(call), `${call} in ${marker.slice(0, 22)}`);
  }
  assert.ok(bodyAfter('const finishExit = (appId: AppId, kind: "close" | "minimize") => {').includes("exitedWindow(state[appId], kind)"));
});

/** True when `text` declares `name` as a useState pair. */
function declaresState(text: string, name: string): boolean {
  const at = text.indexOf(`const [${name}, set`);
  return at >= 0 && text.slice(at, at + 90).includes("] = useState");
}

test("state kept when a window is closed lives in PortiaDesktop, state reset on close lives inside the window body (D-06)", () => {
  const start = source.indexOf("export function PortiaDesktop");
  assert.ok(start >= 0);
  const desktop = source.slice(start, source.indexOf("\n}\n", start));
  const kept = ["activeVirusId", "virusQuery", "openLog", "globalQuery", "selectedEmployeeId", "employeeQuery", "selectedInfoId", "guideCardId", "broadcastTab", "activeTrashFileId", "desktopSettings", "shortcutPositions", "accentPickerOpen", "accentDraft", "settingsSavedVisible", "broadcastUnread", "openTabs", "canEdit"];
  for (const name of kept) assert.ok(declaresState(desktop, name), `${name} must be PortiaDesktop state`);
  for (const name of ["zoom", "ctrlHeld", "frameLoading"]) {
    assert.ok(!declaresState(desktop, name), `${name} must not be PortiaDesktop state`);
    assert.ok(declaresState(source, name), `${name} is expected in EmbeddedDocument`);
  }
  assert.ok(source.includes("if (!state.open) return null;"));
  assert.ok(!/if \([^)\n]*minimized[^)\n]*\) return null/.test(source));
});

test("re-opening a visible window nods it only without the qualification lock, and only through Web Animations (D-14, T-18-07)", () => {
  const open = bodyAfter("const openApp = (appId: AppId, origin?: OpenOrigin) => {");
  const bounce = "if (windowAppears(windows[appId])) bounceTaskbarEntry(appId);\n    else if (!qualificationLocked) nodWindow(appId);";
  assert.ok(open.trimStart().startsWith(lockGuard));
  assert.ok(open.includes(bounce), "nodWindow must follow bounceTaskbarEntry as its else branch");
  assert.equal(source.split("nodWindow(").length - 1, 2, "one declaration and one call");
  const nod = bodyAfter("export function nodWindow(app: AppId) {");
  assert.ok(nod.includes('motion === "reduced" || motion === "off"'));
  assert.ok(nod.includes('[data-window-app="${app}"]'));
  assert.ok(nod.includes("--ease-out"));
  const frames = nod.slice(nod.indexOf("animate(")).match(/\{ translate: [^}]+\}/g) ?? [];
  assert.equal(frames.length, 3);
  assert.ok(!/\b(width|height|top|left)\b\s*:/.test(nod.slice(nod.indexOf("animate("))));
  assert.ok(!nod.includes("setWindows") && !nod.includes("onGeometry"), "the nod must not touch window state");
  const duration = Number(source.match(/export const WINDOW_NOD_MS = (\d+);/)?.[1]);
  assert.ok(duration > 0 && duration <= 240);
  assert.equal(source.split("data-window-app={app}").length - 1, 1);
});
