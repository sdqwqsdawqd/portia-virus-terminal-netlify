"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { classificationOptions, portiaTextKey, type PortiaContent, type RecycleFile, type RichTextDocument, type ScientistLog, type Virus } from "@/lib/portia-content";
import type { PortiaEmployee } from "@/lib/portia-employees";
import { classificationIconFor, PortiaIcon, PortiaIllustration, type PortiaIconName } from "@/components/portia-icons";
import { DesktopWallpaper } from "@/components/portia-wallpaper";
import { accentIds, motionModes } from "@/lib/accent-boot";
import { fitGeometry, resizeGeometry, type ResizeEdge, type WindowGeometry } from "@/lib/window-geometry";

const PortiaEditor = dynamic(
  () => import("@/components/portia-editor").then((module) => module.PortiaEditor),
  { ssr: false, loading: () => <div className="editor-empty">Загрузка редактора…</div> },
);

type AppId = "archive" | "employees" | "search" | "info" | "settings" | "broadcasts" | "trash" | "sheet" | "charter" | "editor";

// Squad documents that live elsewhere, shown inside PORTIA as app windows.
const embeddedApps = {
  sheet: { src: "https://docs.google.com/spreadsheets/d/1IHAdgvHB27iW4s9aJe4L0GIpYrhS_R2EonUwugZIJww/htmlview?widget=true&headers=false", external: "https://docs.google.com/spreadsheets/d/1IHAdgvHB27iW4s9aJe4L0GIpYrhS_R2EonUwugZIJww/" },
  charter: { src: "https://sdqwqsdawqd.github.io/S.E-Portia/", external: "https://sdqwqsdawqd.github.io/S.E-Portia/" },
} as const;
// Where a window appears from: a desktop icon (zoom) or its taskbar button (scales back out of it).
type OpenOrigin = { x: number; y: number; kind: "icon" | "taskbar" };
type WindowState = { open: boolean; minimized: boolean; maximized: boolean; z: number; geometry?: WindowGeometry; exiting?: "close" | "minimize"; openOrigin?: OpenOrigin };
const originOf = (element: Element, kind: OpenOrigin["kind"]): OpenOrigin => {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, kind };
};
// Must equal the window-close / window-minimize (full motion) and window-fade-out (reduced) durations in app/portia.css.
const WINDOW_CLOSE_MS = 180;
const WINDOW_MINIMIZE_MS = 320;
const WINDOW_FADE_OUT_MS = 120;
type SaveState = "idle" | "saving" | "saved" | "error" | "conflict";
type DesktopSettings = { accent: string; wallpaper: string; iconSize: string; motion: string };
type DesktopShortcutId = "search" | "archive" | "employees" | "broadcasts" | "info" | "settings" | "charter" | "sheet" | "trash";
type ShortcutPosition = { x: number; y: number };

const defaultDesktopSettings: DesktopSettings = { accent: "teal", wallpaper: "radar", iconSize: "standard", motion: "system" };
// Every value a setting may hold; the same ids the «Настройки» groups offer.
const settingValues: Record<keyof DesktopSettings, readonly string[]> = {
  accent: accentIds,
  wallpaper: ["radar", "grid", "gel", "cells", "quiet"],
  iconSize: ["compact", "standard", "large"],
  motion: motionModes,
};

const appMeta: Record<AppId, { label: string; path: string; icon: PortiaIconName }> = {
  archive: { label: "База вирусов", path: "PORTIA://VIRUS_ARCHIVE", icon: "virus" },
  employees: { label: "Сотрудники", path: "PORTIA://PERSONNEL", icon: "employees" },
  search: { label: "Глобальный поиск", path: "PORTIA://GLOBAL_SEARCH", icon: "search" },
  info: { label: "Информация", path: "PORTIA://INFORMATION", icon: "info" },
  settings: { label: "Настройки", path: "PORTIA://DESKTOP_SETTINGS", icon: "settings" },
  broadcasts: { label: "Сводка", path: "PORTIA://NEWS", icon: "broadcasts" },
  trash: { label: "Корзина", path: "PORTIA://RECYCLE_BIN", icon: "trash" },
  sheet: { label: "Таблица", path: "PORTIA://SQUAD_SHEET", icon: "sheet" },
  charter: { label: "Устав", path: "PORTIA://CHARTER", icon: "charter" },
  editor: { label: "Редактор", path: "PORTIA://CONTENT_CONTROL", icon: "editor" },
};

const initialWindows: Record<AppId, WindowState> = {
  archive: { open: false, minimized: false, maximized: false, z: 11 },
  employees: { open: false, minimized: false, maximized: false, z: 10 },
  search: { open: false, minimized: false, maximized: false, z: 10 },
  info: { open: false, minimized: false, maximized: false, z: 10 },
  settings: { open: false, minimized: false, maximized: false, z: 10 },
  broadcasts: { open: false, minimized: false, maximized: false, z: 10 },
  trash: { open: false, minimized: false, maximized: false, z: 10 },
  sheet: { open: false, minimized: false, maximized: false, z: 10 },
  charter: { open: false, minimized: false, maximized: false, z: 10 },
  editor: { open: false, minimized: false, maximized: false, z: 10 },
};

function createWindowGeometry(appId: AppId, cascadeIndex: number): WindowGeometry | undefined {
  if (typeof window === "undefined" || window.innerWidth <= 900) return undefined;
  const workspaceWidth = window.innerWidth;
  const workspaceHeight = window.innerHeight - 88;
  const preferred = {
    archive: [1040, 720],
    employees: [960, 680],
    search: [760, 590],
    info: [820, 650],
    settings: [820, 650],
    broadcasts: [820, 650],
    trash: [980, 680],
    sheet: [1180, 760],
    charter: [980, 760],
    editor: [1120, 760],
  }[appId];
  const width = Math.min(preferred[0], workspaceWidth - 32);
  const height = Math.min(preferred[1], workspaceHeight - 24);
  const cascade = (cascadeIndex % 5) * 28;
  const x = Math.min(Math.max(12, (workspaceWidth - width) / 2 - 56 + cascade), Math.max(12, workspaceWidth - width - 12));
  const y = Math.min(Math.max(12, (workspaceHeight - height) / 2 - 28 + cascade), Math.max(12, workspaceHeight - height - 12));
  return fitGeometry({ x, y, width, height }, { width: workspaceWidth, height: workspaceHeight }, minimumWindowSize(appId));
}

function workspaceBounds() {
  const workspace = document.querySelector(".workspace")?.getBoundingClientRect();
  return { width: workspace?.width ?? window.innerWidth, height: workspace?.height ?? window.innerHeight - 88 };
}

function minimumWindowSize(appId: AppId) {
  return { width: appId === "editor" ? 680 : 440, height: 320 };
}

const resizeEdges: ResizeEdge[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

const escapeSearch = (value: string) => value.toLocaleLowerCase("ru").replace(/ё/g, "е");
const roman = (level: number) => ({ 1: "I", 2: "II", 3: "III", 4: "IV" })[level] ?? String(level);
const broadcastReadStorageKey = "portia-broadcasts-read-signature-v1";
const contentCacheStorageKey = "portia-content-last-success-v1";
const employeesCacheStorageKey = "portia-employees-last-success-v1";
// v2: the icon grid step grew with the new icon wells, so v1 positions would overlap.
const shortcutPositionsStorageKey = "portia-desktop-shortcuts-v2";
const taskbarOrderStorageKey = "portia-taskbar-order-v1";
const TASKBAR_BOUNCE_MS = 520;
const ASSISTANT_RECOVER_MS = 780;

type ContentResponse = {
  content?: PortiaContent;
  revision?: number;
  updatedAt?: string | null;
};

function isUsableContent(value: unknown): value is PortiaContent {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PortiaContent>;
  return Array.isArray(candidate.viruses)
    && Array.isArray(candidate.infoSections)
    && Array.isArray(candidate.broadcasts)
    && Array.isArray(candidate.recycleFiles)
    && Array.isArray(candidate.searchRecommendations);
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, milliseconds = 6_000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), milliseconds);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

function broadcastSignature(content: PortiaContent) {
  return JSON.stringify(content.broadcasts
    .filter((item) => item.published)
    .map((item) => ({ id: item.id, type: item.type, title: item.title, body: item.body, format: content.formattedText[portiaTextKey.broadcast(item.id)] })));
}

function shuffledUniqueIndices(items: string[], previousIndex = -1) {
  const seen = new Set<string>();
  const shuffled = items
    .map((item, index) => ({ item: item.trim(), index }))
    .filter(({ item }) => item && !seen.has(item) && Boolean(seen.add(item)))
    .map(({ index }) => index);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  if (shuffled.length > 1 && shuffled[0] === previousIndex) [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
  return shuffled;
}

function classificationLevel(key: keyof Virus["classification"], value: string) {
  const options = classificationOptions[key] as readonly { value: string; level?: number }[];
  return options.find((option) => option.value === value)?.level;
}

function sliceRichText(document: RichTextDocument | undefined, start: number, end: number) {
  if (!document?.runs?.length) return undefined;
  const runs: RichTextDocument["runs"] = [];
  let offset = 0;
  document.runs.forEach((run) => {
    const runStart = offset;
    const runEnd = offset + run.text.length;
    const from = Math.max(start, runStart);
    const to = Math.min(end, runEnd);
    if (from < to) runs.push({ text: run.text.slice(from - runStart, to - runStart), ...(run.style ? { style: run.style } : {}) });
    offset = runEnd;
  });
  return { runs };
}

function richTextLine(document: RichTextDocument | undefined, lines: string[], index: number) {
  const start = lines.slice(0, index).reduce((total, line) => total + line.length + 1, 0);
  return sliceRichText(document, start, start + (lines[index]?.length ?? 0));
}

const knownKlipyMedia: Record<string, string> = {
  "https://klipy.com/gifs/anime-tsundere-6": "https://static2.klipy.com/ii/e293a233a303a98e471f78d04e13a1b0/e0/d8/GIVgKXMP.gif",
};

function embeddedMediaUrl(value: string) {
  const trimmed = value.trim().replace(/[),.!?;:]+$/, "");
  if (!trimmed.startsWith("https://")) return null;

  if (knownKlipyMedia[trimmed]) return knownKlipyMedia[trimmed];

  try {
    const url = new URL(trimmed);
    if ((url.hostname === "giphy.com" || url.hostname === "www.giphy.com") && url.pathname.startsWith("/gifs/")) {
      const id = url.pathname.split("/").filter(Boolean).at(-1)?.split("-").at(-1);
      return id && /^[a-z0-9]+$/i.test(id) ? `https://media.giphy.com/media/${id}/giphy.gif` : null;
    }
    const isDirectImage = /\.(?:gif|png|jpe?g|webp)(?:$|[?#])/i.test(url.href);
    const isKnownMediaHost = url.hostname === "media.tenor.com"
      || url.hostname === "media.giphy.com"
      || url.hostname === "i.giphy.com"
      || /^(?:static\d*\.)?klipy\.com$/i.test(url.hostname);
    return isDirectImage || isKnownMediaHost ? url.href : null;
  } catch {
    return null;
  }
}

const recycleFileType = (kind: RecycleFile["kind"]) => kind === "virus" ? "Документ вируса" : kind === "image" ? "Изображение" : "Текстовый документ";

function recycleFileBody(file: RecycleFile, viruses: Virus[]) {
  if (file.kind !== "virus") return file.content;
  const virus = viruses.find((item) => item.id === file.virusId);
  if (!virus) return file.content;
  const dossier = [
    "PORTIA / АРХИВНАЯ КОПИЯ",
    `ОБЪЕКТ: ${virus.name}`,
    `КОД: ${virus.code}`,
    `СТАТУС: ${virus.status}`,
    "",
    "ВНЕШНИЕ ХАРАКТЕРИСТИКИ:",
    virus.external,
    "",
    "ФИЗИОЛОГИЯ:",
    virus.physiology,
  ].join("\n");
  return file.content.trim() ? `${dossier}\n\n${file.content}` : dossier;
}

export function PortiaDesktop({ initialContent }: { initialContent: PortiaContent }) {
  const [content, setContent] = useState<PortiaContent>(initialContent);
  // False until the cached copy or the first /api/content answer arrives; until then content windows show a loader, not defaults.
  const [contentReady, setContentReady] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [canManageEditors, setCanManageEditors] = useState(false);
  const [revision, setRevision] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [booting, setBooting] = useState(true);
  const [clock, setClock] = useState("--:--:--");
  const [startOpen, setStartOpen] = useState(false);
  const [windows, setWindows] = useState<Record<AppId, WindowState>>(initialWindows);
  const [activeApp, setActiveApp] = useState<AppId>("archive");
  const [, setTopZ] = useState(20);
  const [activeVirusId, setActiveVirusId] = useState(initialContent.viruses[0]?.id ?? "");
  const [virusQuery, setVirusQuery] = useState("");
  const [globalQuery, setGlobalQuery] = useState("");
  const [openLog, setOpenLog] = useState<string | null>(null);
  const [selectedInfoId, setSelectedInfoId] = useState(initialContent.infoSections[0]?.id ?? "");
  const [desktopSettings, setDesktopSettings] = useState<DesktopSettings>(defaultDesktopSettings);
  const [shortcutPositions, setShortcutPositions] = useState<Partial<Record<DesktopShortcutId, ShortcutPosition>>>({});
  const [shortcutPositionsLoaded, setShortcutPositionsLoaded] = useState(false);
  const [desktopSettingsLoaded, setDesktopSettingsLoaded] = useState(false);
  const [taskbarOrder, setTaskbarOrder] = useState<AppId[]>(() => Object.keys(appMeta) as AppId[]);
  const [taskbarOrderLoaded, setTaskbarOrderLoaded] = useState(false);
  const [bouncingApps, setBouncingApps] = useState<Partial<Record<AppId, boolean>>>({});
  const bounceTimers = useRef<Partial<Record<AppId, number>>>({});
  const taskbarDrag = useRef<null | { app: AppId; pointerId: number; startX: number; moved: boolean }>(null);
  const suppressTaskbarClick = useRef(false);
  const [settingsSavedVisible, setSettingsSavedVisible] = useState(false);
  const [activeTrashFileId, setActiveTrashFileId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<PortiaEmployee[]>([]);
  const [employeesReady, setEmployeesReady] = useState(false);
  const [employeesSyncedAt, setEmployeesSyncedAt] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [assistantTipIndex, setAssistantTipIndex] = useState(-1);
  const [assistantOffendedPhraseIndex, setAssistantOffendedPhraseIndex] = useState(-1);
  const [assistantIdlePhraseIndex, setAssistantIdlePhraseIndex] = useState(-1);
  const [assistantActivityPhraseIndex, setAssistantActivityPhraseIndex] = useState(-1);
  const [assistantAutomaticKind, setAssistantAutomaticKind] = useState<"idle" | "activity" | null>(null);
  const [assistantTipVisible, setAssistantTipVisible] = useState(false);
  const [assistantOffended, setAssistantOffended] = useState(false);
  // Vivian's reactions: annoyance 1-3 within a click streak, a parity flag that restarts the squash
  // animation without remounting her image, and a short recovery stage after a sulk.
  const [assistantMood, setAssistantMood] = useState(0);
  const [assistantSquish, setAssistantSquish] = useState(0);
  const [assistantRecovering, setAssistantRecovering] = useState(false);
  const [broadcastUnread, setBroadcastUnread] = useState(false);
  const assistantTipTimer = useRef<number | null>(null);
  const assistantClickResetTimer = useRef<number | null>(null);
  const assistantCooldownTimer = useRef<number | null>(null);
  const assistantRecoverTimer = useRef<number | null>(null);
  const assistantAutomaticTimer = useRef<number | null>(null);
  const settingsSavedTimer = useRef<number | null>(null);
  const exitTimers = useRef<Partial<Record<AppId, number>>>({});
  // The editor reports unsaved edits through a ref: closing is decided inside an event handler, never during render.
  const editorDirtyRef = useRef(false);
  const reportEditorDirty = useCallback((dirty: boolean) => { editorDirtyRef.current = dirty; }, []);
  const [editorCloseRequest, setEditorCloseRequest] = useState(0);
  const saveStateTimer = useRef<number | null>(null);
  const assistantClickStreak = useRef<{ startedAt: number; lastClickAt: number } | null>(null);
  const assistantAdviceBag = useRef<number[]>([]);
  const assistantAdviceSignature = useRef("");
  const assistantLastTipIndex = useRef(-1);
  const assistantOffendedBag = useRef<number[]>([]);
  const assistantOffendedSignature = useRef("");
  const assistantLastOffendedIndex = useRef(-1);
  const assistantCurrentPatience = useRef<number | null>(null);
  const assistantIdleBag = useRef<number[]>([]);
  const assistantIdleSignature = useRef("");
  const assistantLastIdleIndex = useRef(-1);
  const assistantActivityBag = useRef<number[]>([]);
  const assistantActivitySignature = useRef("");
  const assistantLastActivityIndex = useRef(-1);
  const assistantLastActivityAt = useRef(0);
  const assistantContentRef = useRef(content);
  const assistantOffendedRef = useRef(false);

  // Served from the CDN cache, which every save purges; the browser itself always revalidates.
  const fetchContent = useCallback(async () => {
    try {
      const response = await fetchWithTimeout("/api/content");
      if (!response.ok) return;
      const payload = (await response.json()) as ContentResponse;
      if (!payload.content) return;
      setContent(payload.content);
      setActiveVirusId((current) => payload.content!.viruses.some((virus) => virus.id === current) ? current : payload.content!.viruses[0]?.id ?? "");
      setSelectedInfoId((current) => payload.content!.infoSections.some((section) => section.id === current) ? current : payload.content!.infoSections[0]?.id ?? "");
      setRevision(payload.revision ?? 0);
      try {
        window.localStorage.setItem(contentCacheStorageKey, JSON.stringify({
          content: payload.content,
          revision: payload.revision ?? 0,
          updatedAt: payload.updatedAt ?? null,
          savedAt: new Date().toISOString(),
        }));
      } catch {}
    } catch {
      // The last copy saved on this device keeps the terminal usable while offline.
    } finally {
      // Even a failed answer ends the wait: what is on screen then is all there is.
      setContentReady(true);
    }
  }, []);

  const fetchAccess = useCallback(async () => {
    try {
      const response = await fetchWithTimeout("/api/access", { cache: "no-store" });
      if (!response.ok) return;
      const access = await response.json() as { canEdit?: boolean; canManageEditors?: boolean };
      setCanEdit(Boolean(access.canEdit));
      setCanManageEditors(Boolean(access.canManageEditors));
    } catch {}
  }, []);

  // Keeps the Personnel window in step with the editor without waiting for the next sync.
  const updateEmployee = useCallback((saved: PortiaEmployee) => {
    setEmployees((current) => {
      const next = current.map((employee) => employee.id === saved.id ? saved : employee);
      try {
        const cached = JSON.parse(window.localStorage.getItem(employeesCacheStorageKey) ?? "{}") as { syncedAt?: string | null };
        window.localStorage.setItem(employeesCacheStorageKey, JSON.stringify({ ...cached, employees: next }));
      } catch {}
      return next;
    });
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await fetchWithTimeout("/api/employees", {}, 15_000);
      if (!response.ok) return;
      const payload = await response.json() as { employees?: PortiaEmployee[]; syncedAt?: string | null };
      if (!Array.isArray(payload.employees) || !payload.employees.length) return;
      setEmployees(payload.employees);
      setEmployeesSyncedAt(payload.syncedAt ?? null);
      setSelectedEmployeeId((current) => payload.employees!.some((employee) => employee.id === current) ? current : payload.employees![0].id);
      try { window.localStorage.setItem(employeesCacheStorageKey, JSON.stringify(payload)); } catch {}
    } catch {
      // The last successful personnel snapshot remains visible on this device.
    } finally {
      setEmployeesReady(true);
    }
  }, []);

  useEffect(() => {
    const cacheTimer = window.setTimeout(() => {
      try {
        const cached = window.localStorage.getItem(contentCacheStorageKey);
        if (cached) {
          const parsed = JSON.parse(cached) as { content?: unknown; revision?: number };
          if (isUsableContent(parsed.content)) {
            const cachedContent = parsed.content;
            setContent(cachedContent);
            setRevision(typeof parsed.revision === "number" ? parsed.revision : 0);
            setActiveVirusId((current) => cachedContent.viruses.some((virus) => virus.id === current) ? current : cachedContent.viruses[0]?.id ?? "");
            setSelectedInfoId((current) => cachedContent.infoSections.some((section) => section.id === current) ? current : cachedContent.infoSections[0]?.id ?? "");
            setContentReady(true);
          }
        }
        const employeeCache = window.localStorage.getItem(employeesCacheStorageKey);
        if (employeeCache) {
          const parsed = JSON.parse(employeeCache) as { employees?: PortiaEmployee[]; syncedAt?: string | null };
          if (Array.isArray(parsed.employees) && parsed.employees.length) {
            setEmployees(parsed.employees);
            setEmployeesSyncedAt(parsed.syncedAt ?? null);
            setSelectedEmployeeId((current) => current || parsed.employees![0].id);
            setEmployeesReady(true);
          }
        }
      } catch {}
    }, 0);
    const bootTimer = window.setTimeout(() => setBooting(false), 1650);
    const tick = () => {
      const now = new Date();
      setClock(new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(now));
    };
    tick();
    const clockTimer = window.setInterval(tick, 1000);
    const initialFetchTimer = window.setTimeout(() => { void fetchContent(); void fetchAccess(); }, 0);
    const initialEmployeesTimer = window.setTimeout(() => void fetchEmployees(), 0);
    const syncTimer = window.setInterval(fetchContent, 30_000);
    // Cheap: answered by the CDN, so other visitors see profile edits within minutes.
    const employeeSyncTimer = window.setInterval(fetchEmployees, 5 * 60 * 1000);
    return () => {
      window.clearTimeout(cacheTimer);
      window.clearTimeout(bootTimer);
      window.clearTimeout(initialFetchTimer);
      window.clearTimeout(initialEmployeesTimer);
      window.clearInterval(clockTimer);
      window.clearInterval(syncTimer);
      window.clearInterval(employeeSyncTimer);
    };
  }, [fetchAccess, fetchContent, fetchEmployees]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const signature = broadcastSignature(content);
      if (signature === "[]") {
        setBroadcastUnread(false);
        return;
      }
      try { setBroadcastUnread(window.localStorage.getItem(broadcastReadStorageKey) !== signature); }
      catch { setBroadcastUnread(true); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [content]);

  useEffect(() => {
    // Stored settings are visitor-editable: keep only known values, field by field.
    const restored: Partial<DesktopSettings> = {};
    try {
      const saved: unknown = JSON.parse(window.localStorage.getItem("portia-desktop-settings-v1") ?? "{}");
      if (saved && typeof saved === "object" && !Array.isArray(saved)) {
        for (const key of Object.keys(settingValues) as (keyof DesktopSettings)[]) {
          const value = (saved as Record<string, unknown>)[key];
          if (typeof value === "string" && settingValues[key].includes(value)) restored[key] = value;
        }
      }
    } catch {}
    const restoreTimer = window.setTimeout(() => {
      setDesktopSettings((current) => ({ ...current, ...restored }));
      setDesktopSettingsLoaded(true);
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    let restoreTimer: number | undefined;
    try {
      const saved = window.localStorage.getItem(shortcutPositionsStorageKey);
      const parsed = saved ? JSON.parse(saved) as Record<string, ShortcutPosition> : {};
      const allowed = new Set<DesktopShortcutId>(["search", "archive", "employees", "broadcasts", "info", "settings", "charter", "sheet", "trash"]);
      const restored = Object.fromEntries(Object.entries(parsed).filter(([key, value]) => allowed.has(key as DesktopShortcutId) && Number.isFinite(value?.x) && Number.isFinite(value?.y))) as Partial<Record<DesktopShortcutId, ShortcutPosition>>;
      restoreTimer = window.setTimeout(() => {
        setShortcutPositions(restored);
        setShortcutPositionsLoaded(true);
      }, 0);
    } catch {}
    if (!restoreTimer) restoreTimer = window.setTimeout(() => setShortcutPositionsLoaded(true), 0);
    return () => { if (restoreTimer) window.clearTimeout(restoreTimer); };
  }, []);

  useEffect(() => {
    if (!shortcutPositionsLoaded) return;
    try { window.localStorage.setItem(shortcutPositionsStorageKey, JSON.stringify(shortcutPositions)); } catch {}
  }, [shortcutPositions, shortcutPositionsLoaded]);

  useEffect(() => () => {
    if (assistantTipTimer.current) window.clearTimeout(assistantTipTimer.current);
    if (assistantClickResetTimer.current) window.clearTimeout(assistantClickResetTimer.current);
    if (assistantCooldownTimer.current) window.clearTimeout(assistantCooldownTimer.current);
    if (assistantRecoverTimer.current) window.clearTimeout(assistantRecoverTimer.current);
    if (assistantAutomaticTimer.current) window.clearTimeout(assistantAutomaticTimer.current);
    if (settingsSavedTimer.current) window.clearTimeout(settingsSavedTimer.current);
    Object.values(exitTimers.current).forEach((timer) => window.clearTimeout(timer));
    Object.values(bounceTimers.current).forEach((timer) => window.clearTimeout(timer));
  }, []);

  // Taskbar order: only known apps, each once; apps missing from the saved list keep their default place at the end.
  useEffect(() => {
    let saved: unknown = [];
    try { saved = JSON.parse(window.localStorage.getItem(taskbarOrderStorageKey) ?? "[]"); } catch {}
    const known = Object.keys(appMeta) as AppId[];
    const restored = Array.isArray(saved) ? [...new Set(saved.filter((id): id is AppId => known.includes(id as AppId)))] : [];
    const timer = window.setTimeout(() => {
      setTaskbarOrder([...restored, ...known.filter((id) => !restored.includes(id))]);
      setTaskbarOrderLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!taskbarOrderLoaded) return;
    try { window.localStorage.setItem(taskbarOrderStorageKey, JSON.stringify(taskbarOrder)); } catch {}
  }, [taskbarOrder, taskbarOrderLoaded]);

  useEffect(() => {
    assistantContentRef.current = content;
  }, [content]);

  useEffect(() => {
    assistantOffendedRef.current = assistantOffended;
  }, [assistantOffended]);

  useEffect(() => {
    const markActivity = () => {
      assistantLastActivityAt.current = Date.now();
    };
    const activityEvents = ["pointerdown", "pointermove", "keydown", "scroll"] as const;
    activityEvents.forEach((eventName) => window.addEventListener(eventName, markActivity, { passive: true }));

    const scheduleNextPhrase = () => {
      const current = assistantContentRef.current;
      const fixedSeconds = Math.min(3600, Math.max(1, Number(current.assistantAutoIntervalSeconds) || 60));
      const minimum = Math.min(3600, Math.max(1, Number(current.assistantAutoMinSeconds) || 45));
      const maximum = Math.min(3600, Math.max(minimum, Number(current.assistantAutoMaxSeconds) || 120));
      const delaySeconds = current.assistantAutoTimingMode === "fixed"
        ? fixedSeconds
        : Math.floor(minimum + Math.random() * (maximum - minimum + 1));

      assistantAutomaticTimer.current = window.setTimeout(() => {
        const recentActivityWindow = Math.min(15, Math.max(3, delaySeconds / 3)) * 1000;
        const kind = Date.now() - assistantLastActivityAt.current <= recentActivityWindow ? "activity" : "idle";

        if (!assistantOffendedRef.current) {
          const latest = assistantContentRef.current;
          const enabled = kind === "activity" ? latest.assistantActivityEnabled !== false : latest.assistantIdleEnabled !== false;
          if (!enabled) {
            scheduleNextPhrase();
            return;
          }
          const phrases = kind === "activity" ? latest.assistantActivityPhrases : latest.assistantIdlePhrases;
          const signatureRef = kind === "activity" ? assistantActivitySignature : assistantIdleSignature;
          const bagRef = kind === "activity" ? assistantActivityBag : assistantIdleBag;
          const lastIndexRef = kind === "activity" ? assistantLastActivityIndex : assistantLastIdleIndex;
          const signature = phrases.join("\u001f");
          if (signatureRef.current !== signature) {
            signatureRef.current = signature;
            bagRef.current = [];
            lastIndexRef.current = -1;
          }
          if (!bagRef.current.length) bagRef.current = shuffledUniqueIndices(phrases, lastIndexRef.current);
          const nextIndex = bagRef.current.shift() ?? -1;
          if (nextIndex >= 0) {
            lastIndexRef.current = nextIndex;
            if (kind === "activity") setAssistantActivityPhraseIndex(nextIndex);
            else setAssistantIdlePhraseIndex(nextIndex);
            setAssistantAutomaticKind(kind);
            setAssistantTipVisible(true);
            if (assistantTipTimer.current) window.clearTimeout(assistantTipTimer.current);
            assistantTipTimer.current = window.setTimeout(() => setAssistantTipVisible(false), 5200);
          }
        }

        scheduleNextPhrase();
      }, delaySeconds * 1000);
    };

    scheduleNextPhrase();
    return () => {
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, markActivity));
      if (assistantAutomaticTimer.current) window.clearTimeout(assistantAutomaticTimer.current);
    };
  }, [content.assistantActivityEnabled, content.assistantAutoIntervalSeconds, content.assistantAutoMaxSeconds, content.assistantAutoMinSeconds, content.assistantAutoTimingMode, content.assistantIdleEnabled]);

  // Nothing is applied or saved until the stored settings are restored: writing the defaults first
  // would overwrite the visitor's choice and repaint the head script's accent and motion for a frame.
  useEffect(() => {
    if (!desktopSettingsLoaded) return;
    document.documentElement.dataset.accent = desktopSettings.accent;
    document.documentElement.dataset.wallpaper = desktopSettings.wallpaper;
    document.documentElement.dataset.iconSize = desktopSettings.iconSize;
    try { window.localStorage.setItem("portia-desktop-settings-v1", JSON.stringify(desktopSettings)); } catch {}
  }, [desktopSettings, desktopSettingsLoaded]);

  // Same rule as the head script: an explicit choice wins, otherwise the system setting, live.
  useEffect(() => {
    if (!desktopSettingsLoaded) return;
    const system = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      const { motion } = desktopSettings;
      document.documentElement.dataset.motion = motion === "on" ? "full" : motion === "off" ? "reduce" : system.matches ? "reduce" : "full";
    };
    apply();
    system.addEventListener("change", apply);
    return () => system.removeEventListener("change", apply);
  }, [desktopSettings, desktopSettingsLoaded]);

  const showSettingsSaved = () => {
    setSettingsSavedVisible(true);
    if (settingsSavedTimer.current) window.clearTimeout(settingsSavedTimer.current);
    settingsSavedTimer.current = window.setTimeout(() => setSettingsSavedVisible(false), 2400);
  };

  const updateDesktopSetting = (key: keyof DesktopSettings, value: string) => {
    if (desktopSettings[key] === value) return;
    setDesktopSettings((current) => ({ ...current, [key]: value }));
    showSettingsSaved();
  };

  const resetDesktopSettings = () => {
    const alreadyDefault = Object.entries(defaultDesktopSettings).every(([key, value]) => desktopSettings[key as keyof DesktopSettings] === value);
    const shortcutsAlreadyDefault = Object.keys(shortcutPositions).length === 0;
    if (alreadyDefault && shortcutsAlreadyDefault) return;
    setDesktopSettings(defaultDesktopSettings);
    setShortcutPositions({});
    showSettingsSaved();
  };

  const moveDesktopShortcut = (shortcutId: DesktopShortcutId, position: ShortcutPosition) => {
    setShortcutPositions((current) => ({ ...current, [shortcutId]: position }));
  };

  const focusApp = (appId: AppId) => {
    setTopZ((current) => {
      const next = current + 1;
      setWindows((state) => ({ ...state, [appId]: { ...state[appId], z: next } }));
      return next;
    });
    setActiveApp(appId);
  };

  // Taskbar entries are dragged with a mouse or pen; touch keeps scrolling the phone taskbar.
  // The entry follows the pointer and the order changes on release, so pointer capture is never lost to a DOM move.
  const beginTaskbarDrag = (app: AppId) => (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "touch" || event.button !== 0) return;
    // Capture at once: the release always comes back here, even if the pointer left the button.
    event.currentTarget.setPointerCapture(event.pointerId);
    taskbarDrag.current = { app, pointerId: event.pointerId, startX: event.clientX, moved: false };
  };

  const resetTaskbarButton = (button: HTMLButtonElement) => {
    button.style.translate = "";
    button.classList.remove("is-reordering");
  };

  const moveTaskbarDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = taskbarDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    // A release we never saw (window lost focus): end the drag instead of following a free pointer.
    if (!(event.buttons & 1)) {
      taskbarDrag.current = null;
      resetTaskbarButton(event.currentTarget);
      return;
    }
    if (!drag.moved) {
      if (Math.abs(event.clientX - drag.startX) < 5) return;
      drag.moved = true;
      event.currentTarget.classList.add("is-reordering");
    }
    event.currentTarget.style.translate = `${event.clientX - drag.startX}px 0`;
  };

  const endTaskbarDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = taskbarDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    taskbarDrag.current = null;
    const button = event.currentTarget;
    resetTaskbarButton(button);
    // Pointer capture sends the click here even when the press was released off the button.
    const rect = button.getBoundingClientRect();
    const releasedOutside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    if (event.type !== "pointerup" || (!drag.moved && !releasedOutside)) return;
    // The click that follows this drag must not minimise or focus the window; it fires right after
    // pointerup, so the flag only lives until the next task and can never swallow a later real click.
    suppressTaskbarClick.current = true;
    window.setTimeout(() => { suppressTaskbarClick.current = false; }, 0);
    if (!drag.moved) return;
    const others = [...(button.parentElement?.querySelectorAll<HTMLElement>("[data-taskbar-app]") ?? [])].filter((element) => element !== button);
    const before = others.find((element) => { const rect = element.getBoundingClientRect(); return event.clientX < rect.left + rect.width / 2; })?.dataset.taskbarApp as AppId | undefined;
    setTaskbarOrder((order) => {
      const without = order.filter((id) => id !== drag.app);
      const index = before ? without.indexOf(before) : without.length;
      return [...without.slice(0, index), drag.app, ...without.slice(index)];
    });
  };

  // Dock-style: the taskbar entry hops once when its window appears.
  const bounceTaskbarEntry = (appId: AppId) => {
    const previous = bounceTimers.current[appId];
    if (previous) window.clearTimeout(previous);
    setBouncingApps((current) => ({ ...current, [appId]: true }));
    bounceTimers.current[appId] = window.setTimeout(() => {
      delete bounceTimers.current[appId];
      setBouncingApps((current) => ({ ...current, [appId]: false }));
    }, TASKBAR_BOUNCE_MS);
  };

  const openApp = (appId: AppId, origin?: OpenOrigin) => {
    if (!windows[appId].open || windows[appId].minimized || windows[appId].exiting) bounceTaskbarEntry(appId);
    // Re-opening a window while it closes or minimises cancels the exit and keeps it.
    const pendingExit = exitTimers.current[appId];
    if (pendingExit) {
      window.clearTimeout(pendingExit);
      delete exitTimers.current[appId];
    }
    setWindows((state) => {
      const openCount = Object.values(state).filter((windowState) => windowState.open && !windowState.minimized && !windowState.exiting).length;
      // The origin only matters when the window appears; changing it on a visible window would replay its animation.
      const appears = !state[appId].open || state[appId].minimized || Boolean(state[appId].exiting);
      return {
        ...state,
        [appId]: {
          ...state[appId],
          open: true,
          minimized: false,
          exiting: undefined,
          openOrigin: appears ? origin : state[appId].openOrigin,
          // A size remembered from a bigger screen is refitted, so the window never opens past the edge.
          geometry: state[appId].geometry ? fitGeometry(state[appId].geometry, workspaceBounds(), minimumWindowSize(appId)) : createWindowGeometry(appId, openCount),
        },
      };
    });
    focusApp(appId);
    setStartOpen(false);
    if (appId === "broadcasts") {
      const signature = broadcastSignature(content);
      try { window.localStorage.setItem(broadcastReadStorageKey, signature); } catch {}
      setBroadcastUnread(false);
    }
  };

  // Functional update only: a late timer must never act on a stale render's windows.
  const finishExit = (appId: AppId, kind: "close" | "minimize") => {
    setWindows((state) => ({
      ...state,
      [appId]: kind === "close"
        ? { ...state[appId], open: false, minimized: false, maximized: false, exiting: undefined }
        : { ...state[appId], minimized: true, exiting: undefined },
    }));
  };

  // `force` is the editor's own dialog approving the close; minimize is never guarded (the window stays mounted).
  const requestExit = (appId: AppId, kind: "close" | "minimize", force = false) => {
    // A repeat is ignored, but a close may overtake a minimise that is still playing.
    const exiting = windows[appId].exiting;
    if (exiting === kind || exiting === "close") return;
    // The editor's unsaved-changes dialog decides closes while it has unsaved edits.
    if (appId === "editor" && kind === "close" && !force && editorDirtyRef.current) {
      setEditorCloseRequest((count) => count + 1);
      return;
    }
    const pending = exitTimers.current[appId];
    if (pending) window.clearTimeout(pending);
    if (activeApp === appId) {
      const fallback = (Object.keys(windows) as AppId[])
        .filter((id) => id !== appId && windows[id].open && !windows[id].minimized && !windows[id].exiting)
        .sort((a, b) => windows[b].z - windows[a].z)[0];
      setActiveApp(fallback ?? "archive");
    }
    // Reduced motion still gets a short fade, so the window visibly leaves instead of vanishing.
    const duration = document.documentElement.dataset.motion === "reduce" ? WINDOW_FADE_OUT_MS : kind === "close" ? WINDOW_CLOSE_MS : WINDOW_MINIMIZE_MS;
    setWindows((state) => ({ ...state, [appId]: { ...state[appId], exiting: kind } }));
    // A timer, not animationend: in a hidden tab the animation event may never fire.
    exitTimers.current[appId] = window.setTimeout(() => {
      delete exitTimers.current[appId];
      finishExit(appId, kind);
    }, duration);
  };

  const closeApp = (appId: AppId) => requestExit(appId, "close");

  const minimizeApp = (appId: AppId) => requestExit(appId, "minimize");

  // Shrinking the browser refits every window so its frame and controls stay reachable.
  useEffect(() => {
    const refit = () => {
      if (window.innerWidth <= 900) return;
      const bounds = workspaceBounds();
      setWindows((state) => Object.fromEntries((Object.keys(state) as AppId[]).map((id) => {
        const geometry = state[id].geometry;
        return [id, geometry ? { ...state[id], geometry: fitGeometry(geometry, bounds, minimumWindowSize(id)) } : state[id]];
      })) as Record<AppId, WindowState>);
    };
    window.addEventListener("resize", refit);
    return () => window.removeEventListener("resize", refit);
  }, []);

  const toggleMaximize = (appId: AppId) => {
    setWindows((state) => ({ ...state, [appId]: { ...state[appId], maximized: !state[appId].maximized } }));
    focusApp(appId);
  };

  const updateWindowGeometry = (appId: AppId, geometry: WindowGeometry) => {
    setWindows((state) => ({ ...state, [appId]: { ...state[appId], geometry } }));
  };

  const saveContent = async (next: PortiaContent) => {
    // An earlier «СОХРАНЕНО» timer must not flip a newer request back to idle mid-save.
    if (saveStateTimer.current !== null) window.clearTimeout(saveStateTimer.current);
    setSaveState("saving");
    try {
      const response = await fetchWithTimeout("/api/content", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: next, revision }),
      });
      if (response.status === 409) {
        setSaveState("conflict");
        throw new Error("PORTIA content changed by another editor");
      }
      if (!response.ok) throw new Error("save failed");
      const payload = (await response.json()) as { revision?: number };
      setContent(next);
      setRevision(payload.revision ?? revision + 1);
      try {
        window.localStorage.setItem(contentCacheStorageKey, JSON.stringify({
          content: next,
          revision: payload.revision ?? revision + 1,
          updatedAt: new Date().toISOString(),
          savedAt: new Date().toISOString(),
        }));
      } catch {}
      setSaveState("saved");
      saveStateTimer.current = window.setTimeout(() => setSaveState("idle"), 1800);
    } catch (error) {
      setSaveState((current) => current === "conflict" ? current : "error");
      throw error;
    }
  };

  const activeVirus = content.viruses.find((virus) => virus.id === activeVirusId) ?? content.viruses[0];
  const filteredViruses = content.viruses.filter((virus) => escapeSearch(`${virus.name} ${virus.code} ${virus.status}`).includes(escapeSearch(virusQuery)));
  const selectedInfo = content.infoSections.find((section) => section.id === selectedInfoId) ?? content.infoSections[0];
  const trashFiles = content.recycleFiles;
  const activeTrashFile = trashFiles.find((file) => file.id === activeTrashFileId) ?? null;
  const recycledViruses = useMemo(() => content.recycledViruses ?? [], [content.recycledViruses]);
  const trashOrder = useMemo(() => {
    const valid = new Set([
      ...content.recycleFiles.map((file) => `file:${file.id}`),
      ...recycledViruses.map((virus) => `virus:${virus.id}`),
    ]);
    return [...new Set([
      ...(content.recycleOrder ?? []).filter((key) => valid.has(key)),
      ...content.recycleFiles.map((file) => `file:${file.id}`),
      ...recycledViruses.map((virus) => `virus:${virus.id}`),
    ])];
  }, [content.recycleFiles, content.recycleOrder, recycledViruses]);
  const activeTrashVirus = activeTrashFileId?.startsWith("virus:")
    ? recycledViruses.find((virus) => virus.id === activeTrashFileId.slice(6)) ?? null
    : null;
  const filteredEmployees = employees.filter((employee) => escapeSearch(`${employee.nickname} ${employee.callsign} ${employee.title} ${employee.rank}`).includes(escapeSearch(employeeQuery)));
  const selectedEmployee = employees.find((employee) => employee.id === selectedEmployeeId) ?? employees[0] ?? null;

  const openTrashFile = (file: RecycleFile) => {
    setActiveTrashFileId(file.id);
  };

  const openTrashVirus = (virus: Virus) => setActiveTrashFileId(`virus:${virus.id}`);

  const activateAssistant = () => {
    if (assistantOffended) return;
    setAssistantAutomaticKind(null);

    const now = window.performance.now();
    const previousStreak = assistantClickStreak.current;
    const newStreak = !previousStreak || now - previousStreak.lastClickAt > 1250;
    const streak = newStreak
      ? { startedAt: now, lastClickAt: now }
      : { startedAt: previousStreak.startedAt, lastClickAt: now };

    if (newStreak) {
      const variants = (content.assistantPatienceVariants?.length ? content.assistantPatienceVariants : [content.assistantPatienceSeconds || 3])
        .map((value) => Math.min(60, Math.max(1, Number(value) || 3)));
      assistantCurrentPatience.current = variants[Math.floor(Math.random() * variants.length)] ?? 3;
    }

    assistantClickStreak.current = streak;
    if (assistantClickResetTimer.current) window.clearTimeout(assistantClickResetTimer.current);
    assistantClickResetTimer.current = window.setTimeout(() => {
      assistantClickStreak.current = null;
      setAssistantMood(0);
    }, 1250);

    const patienceMilliseconds = (assistantCurrentPatience.current ?? 3) * 1000;
    if (now - streak.startedAt >= patienceMilliseconds) {
      assistantClickStreak.current = null;
      assistantCurrentPatience.current = null;
      if (assistantClickResetTimer.current) window.clearTimeout(assistantClickResetTimer.current);
      const offendedPhrases = content.assistantOffendedPhrases?.length
        ? content.assistantOffendedPhrases
        : [content.assistantOffendedPhrase || "Я обиделась. Дайте мне немного времени."];
      const offendedSignature = offendedPhrases.join("\u001f");
      if (assistantOffendedSignature.current !== offendedSignature) {
        assistantOffendedSignature.current = offendedSignature;
        assistantOffendedBag.current = [];
        assistantLastOffendedIndex.current = -1;
      }
      if (!assistantOffendedBag.current.length) assistantOffendedBag.current = shuffledUniqueIndices(offendedPhrases, assistantLastOffendedIndex.current);
      const nextOffendedIndex = assistantOffendedBag.current.shift() ?? 0;
      assistantLastOffendedIndex.current = nextOffendedIndex;
      setAssistantOffendedPhraseIndex(nextOffendedIndex);
      assistantOffendedRef.current = true;
      setAssistantMood(0);
      setAssistantRecovering(false);
      setAssistantOffended(true);
      setAssistantTipVisible(true);
      if (assistantTipTimer.current) window.clearTimeout(assistantTipTimer.current);
      if (assistantCooldownTimer.current) window.clearTimeout(assistantCooldownTimer.current);
      assistantCooldownTimer.current = window.setTimeout(() => {
        assistantOffendedRef.current = false;
        setAssistantOffended(false);
        setAssistantTipVisible(false);
        // She glances back over her shoulder before turning round (must match vivian-recover in portia.css).
        setAssistantRecovering(true);
        assistantRecoverTimer.current = window.setTimeout(() => setAssistantRecovering(false), ASSISTANT_RECOVER_MS);
      }, 10000);
      return;
    }

    // Annoyance grows through the streak: the closer to her patience limit, the harder she squashes.
    setAssistantMood(Math.min(3, 1 + Math.floor((3 * (now - streak.startedAt)) / patienceMilliseconds)));
    setAssistantSquish((count) => count + 1);

    const tips = content.assistantAdvice ?? [];
    const signature = tips.join("\u001f");
    if (assistantAdviceSignature.current !== signature) {
      assistantAdviceSignature.current = signature;
      assistantAdviceBag.current = [];
      assistantLastTipIndex.current = -1;
    }
    if (assistantAdviceBag.current.length === 0) {
      assistantAdviceBag.current = shuffledUniqueIndices(tips, assistantLastTipIndex.current);
    }
    const nextTipIndex = assistantAdviceBag.current.shift() ?? -1;
    assistantLastTipIndex.current = nextTipIndex;
    setAssistantTipIndex(nextTipIndex);
    setAssistantTipVisible(true);
    if (assistantTipTimer.current) window.clearTimeout(assistantTipTimer.current);
    assistantTipTimer.current = window.setTimeout(() => setAssistantTipVisible(false), 5200);
  };

  const searchResults = useMemo(() => {
    const query = escapeSearch(globalQuery.trim());
    const items: Array<{ id: string; type: "virus" | "info" | "broadcast" | "file"; title: string; meta: string; body: string }> = [
      ...content.viruses.map((virus) => ({ id: virus.id, type: "virus" as const, title: virus.name, meta: virus.code, body: `${virus.status} ${virus.external} ${virus.physiology} ${Object.values(virus.classification).join(" ")} ${virus.mutations.map((mutation) => `${mutation.name} ${mutation.description}`).join(" ")}` })),
      ...content.infoSections.map((section) => ({ id: section.id, type: "info" as const, title: section.title, meta: "ИНФОРМАЦИЯ", body: section.body })),
      ...content.broadcasts.filter((item) => item.published).map((item) => ({ id: item.id, type: "broadcast" as const, title: item.title, meta: broadcastType(item.type), body: item.body })),
      ...content.recycleFiles.map((file) => ({ id: file.id, type: "file" as const, title: file.name, meta: recycleFileType(file.kind), body: recycleFileBody(file, [...content.viruses, ...recycledViruses]) })),
      ...recycledViruses.map((virus) => ({ id: `virus:${virus.id}`, type: "file" as const, title: virus.name, meta: "ВИРУС В КОРЗИНЕ", body: `${virus.code} ${virus.status} ${virus.external} ${virus.physiology}` })),
    ];
    if (!query) return items.slice(0, 8);
    return items.filter((item) => escapeSearch(`${item.title} ${item.meta} ${item.body}`).includes(query));
  }, [content, globalQuery, recycledViruses]);

  const openSearchResult = (result: (typeof searchResults)[number]) => {
    if (result.type === "virus") {
      setActiveVirusId(result.id);
      setOpenLog(null);
      openApp("archive");
    } else if (result.type === "info") {
      setSelectedInfoId(result.id);
      openApp("info");
    } else if (result.type === "broadcast") {
      openApp("broadcasts");
    } else {
      setActiveTrashFileId(result.id);
      openApp("trash");
    }
  };

  const idlePhrases = content.assistantIdlePhrases?.length
    ? content.assistantIdlePhrases
    : ["Вы давно ничего не делали. Я всё ещё здесь."];
  const activityPhrases = content.assistantActivityPhrases?.length
    ? content.assistantActivityPhrases
    : ["Вижу, работа идёт. Продолжайте в том же духе."];
  const assistantMessageHeading = assistantOffended
    ? "ВИВЬЯН // ОБИДЕЛАСЬ"
    : assistantAutomaticKind === "idle"
      ? "ВИВЬЯН // ВЫ ЗДЕСЬ?"
      : assistantAutomaticKind === "activity"
        ? "ВИВЬЯН // НАБЛЮДЕНИЕ"
        : "ВИВЬЯН // СОВЕТ";
  const assistantMessageText = assistantOffended
    ? (content.assistantOffendedPhrases?.[assistantOffendedPhraseIndex] ?? content.assistantOffendedPhrase)
    : assistantAutomaticKind === "idle"
      ? (idlePhrases[assistantIdlePhraseIndex] ?? idlePhrases[0])
      : assistantAutomaticKind === "activity"
        ? (activityPhrases[assistantActivityPhraseIndex] ?? activityPhrases[0])
        : assistantTipIndex >= 0
          ? content.assistantAdvice[assistantTipIndex]
          : "Добавьте советы в редакторе PORTIA.";
  const assistantMessageDocument = assistantOffended
    ? richTextLine(content.formattedText[portiaTextKey.assistantOffended], content.assistantOffendedPhrases ?? [content.assistantOffendedPhrase], Math.max(0, assistantOffendedPhraseIndex))
    : assistantAutomaticKind === "idle"
      ? richTextLine(content.formattedText[portiaTextKey.assistantIdle], idlePhrases, Math.max(0, assistantIdlePhraseIndex))
      : assistantAutomaticKind === "activity"
        ? richTextLine(content.formattedText[portiaTextKey.assistantActivity], activityPhrases, Math.max(0, assistantActivityPhraseIndex))
        : assistantTipIndex >= 0
          ? richTextLine(content.formattedText[portiaTextKey.assistantAdvice], content.assistantAdvice, assistantTipIndex)
          : undefined;
  return (
    <>
      <BootScreen visible={booting} />
      <div className="desktop" id="desktop">
        <DesktopWallpaper kind={desktopSettings.wallpaper} />
        <header className="system-bar">
          <div className="system-brand"><img className="portia-mark" src="/assets/portia-logo.png" alt="" /><span>PORTIA</span><span className="system-division">PORTIA OS</span></div>
          <div className="system-status" aria-label="Состояние системы"><span className="status-item"><i className="status-dot" />В СЕТИ</span><time>{clock}</time></div>
        </header>

        <main className={`workspace${windows[activeApp].open && !windows[activeApp].minimized ? " mobile-app-open" : ""}`}>
          <nav className="desktop-icons" aria-label="Рабочий стол PORTIA">
            <DesktopIcon app="search" onOpen={openApp} position={shortcutPositions.search} onMove={moveDesktopShortcut} />
            <DesktopIcon app="archive" onOpen={openApp} position={shortcutPositions.archive} onMove={moveDesktopShortcut} />
            <DesktopIcon app="employees" onOpen={openApp} position={shortcutPositions.employees} onMove={moveDesktopShortcut} />
            <DesktopIcon app="broadcasts" onOpen={openApp} position={shortcutPositions.broadcasts} onMove={moveDesktopShortcut} badge={broadcastUnread} />
            <DesktopIcon app="info" onOpen={openApp} position={shortcutPositions.info} onMove={moveDesktopShortcut} />
            <DesktopIcon app="settings" onOpen={openApp} position={shortcutPositions.settings} onMove={moveDesktopShortcut} />
            <DesktopIcon app="charter" onOpen={openApp} position={shortcutPositions.charter} onMove={moveDesktopShortcut} />
            <DesktopIcon app="sheet" onOpen={openApp} position={shortcutPositions.sheet} onMove={moveDesktopShortcut} />
            <DesktopIcon app="trash" onOpen={openApp} position={shortcutPositions.trash} onMove={moveDesktopShortcut} className="desktop-icon-trash" />
          </nav>


          <AppWindow app="archive" state={windows.archive} active={activeApp === "archive"} onFocus={focusApp} onMinimize={minimizeApp} onMaximize={toggleMaximize} onClose={closeApp} onGeometry={updateWindowGeometry} className="archive-window" meta="ДОПУСК II">
            <div className="archive-grid">
              <aside className="archive-browser" aria-label="Список вирусов">
                <div className="browser-heading"><div><h1>База вирусов</h1></div><span className="record-count">{String(content.viruses.length).padStart(2, "0")}</span></div>
                <label className="search-box"><span aria-hidden="true">⌕</span><span className="sr-only">Поиск по базе</span><input value={virusQuery} onChange={(event) => setVirusQuery(event.target.value)} type="search" placeholder="Поиск по имени или коду" /></label>
                <div className="browser-labels" aria-hidden="true"><span>СУБЪЕКТ</span><span>СТАТУС</span></div>
                <div className="virus-list" role="listbox" aria-label="Записи вирусов">
                  {!contentReady ? <LoadingState label="Загрузка архива…" /> : <>
                  {filteredViruses.map((virus, index) => (
                    <button key={virus.id} type="button" className={`virus-row${virus.id === activeVirus?.id ? " active" : ""}`} onClick={() => { setActiveVirusId(virus.id); setOpenLog(null); }}>
                      <span className="row-index">{String(index + 1).padStart(2, "0")}</span>
                      <span className="row-main"><strong>{virus.name}</strong><small>{virus.code}</small><RowBadges virus={virus} /></span>
                      <span className="row-status">{virus.status}</span>
                    </button>
                  ))}
                  {!filteredViruses.length && <div className="list-empty">Совпадений в архиве нет</div>}
                  </>}
                </div>
                <div className="browser-footer"><span><i className="status-dot" />СИНХРОНИЗИРОВАНО</span><span>РЕВИЗИЯ {String(revision).padStart(2, "0")}</span></div>
              </aside>
              <article className="record-view" aria-live="polite">
                {!contentReady ? <LoadingState label="Загрузка досье…" /> : activeVirus ? openLog ? <ScientistDocument key={openLog} virus={activeVirus} logId={openLog} onBack={() => setOpenLog(null)} /> : <VirusRecord virus={activeVirus} formattedText={content.formattedText} onOpenLog={setOpenLog} /> : <div className="record-empty empty-state"><PortiaIllustration name="dish" /><strong>В базе пока нет вирусов</strong></div>}
              </article>
            </div>
          </AppWindow>

          <AppWindow app="employees" state={windows.employees} active={activeApp === "employees"} onFocus={focusApp} onMinimize={minimizeApp} onMaximize={toggleMaximize} onClose={closeApp} onGeometry={updateWindowGeometry} className="utility-window personnel-window" meta={`${employees.length} ПРОФИЛЕЙ`}>
            <div className="personnel-app">
              <aside className="personnel-index">
                <header><h1>Сотрудники</h1></header>
                <label className="search-box"><span aria-hidden="true">⌕</span><span className="sr-only">Поиск сотрудника</span><input type="search" value={employeeQuery} onChange={(event) => setEmployeeQuery(event.target.value)} placeholder="Ник, позывной, звание" /></label>
                <div className="personnel-list">
                  {!employeesReady ? <LoadingState label="Загрузка сотрудников…" /> : <>
                  {filteredEmployees.map((employee, index) => <button key={employee.id} type="button" className={employee.id === selectedEmployee?.id ? "active" : ""} onClick={() => setSelectedEmployeeId(employee.id)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{employee.nickname}</strong><small>{[employee.callsign, employee.title, employee.rank].filter(Boolean).join(" · ")}</small></button>)}
                  {!filteredEmployees.length && <div className="list-empty">Сотрудники не найдены</div>}
                  </>}
                </div>
                <footer>СИНХРОНИЗАЦИЯ: {employeesSyncedAt ? new Date(employeesSyncedAt).toLocaleString("ru-RU") : "ОЖИДАНИЕ"}</footer>
              </aside>
              <article className="personnel-profile">
                {!employeesReady ? <LoadingState label="Загрузка профиля…" /> : selectedEmployee ? <div className="personnel-profile-body content-fade" key={selectedEmployee.id}>
                  <header className="personnel-profile-head">
                    <div className="personnel-avatar-stage">
                      <figure className="personnel-full-avatar">{selectedEmployee.robloxFullAvatarUrl ? <EmployeeImage src={selectedEmployee.robloxFullAvatarUrl} alt={`Roblox-аватар ${selectedEmployee.nickname} в полный рост`} /> : <div className="personnel-full-avatar-empty"><span>ROBLOX</span><small>ПОЛНЫЙ АВАТАР ПОЯВИТСЯ ПОСЛЕ СИНХРОНИЗАЦИИ</small></div>}</figure>
                      {selectedEmployee.robloxUserId ? <a className="personnel-portrait" href={`https://www.roblox.com/users/${selectedEmployee.robloxUserId}/profile`} target="_blank" rel="noreferrer" aria-label={`Профиль Roblox: ${selectedEmployee.nickname}`}><EmployeeImage src={selectedEmployee.photoUrl || selectedEmployee.robloxAvatarUrl} alt={`Портрет ${selectedEmployee.nickname}`} fallbackClassName="personnel-fallback" /></a> : <figure className="personnel-portrait"><EmployeeImage src={selectedEmployee.photoUrl || selectedEmployee.robloxAvatarUrl} alt={`Портрет ${selectedEmployee.nickname}`} fallbackClassName="personnel-fallback" /></figure>}
                    </div>
                    <div className="personnel-profile-identity"><h2>{selectedEmployee.nickname}</h2><p className="personnel-callsign">{selectedEmployee.callsign || "Без позывного"}</p></div>
                  </header>
                  <dl className="personnel-stats"><div><dt>ЗВАНИЕ</dt><dd>{selectedEmployee.title || "Не указано"}</dd></div><div><dt>РАНГ</dt><dd>{selectedEmployee.rank || "Не указан"}</dd></div><div><dt>ОЦЕНКА ЗНАНИЙ</dt><dd>{selectedEmployee.knowledgeRating} / 10</dd></div></dl>
                  <section className="personnel-biography"><span>БИОГРАФИЯ</span><p>{selectedEmployee.biography || "Биография сотрудника пока не заполнена."}</p></section>
                </div> : <div className="editor-empty">Данные сотрудников ещё не синхронизированы.</div>}
              </article>
            </div>
          </AppWindow>

          <AppWindow app="search" state={windows.search} active={activeApp === "search"} onFocus={focusApp} onMinimize={minimizeApp} onMaximize={toggleMaximize} onClose={closeApp} onGeometry={updateWindowGeometry} className="global-search-window" meta="ГЛОБАЛЬНЫЙ ПОИСК">
            <div className="global-search-app">
              <header className="global-search-header"><h1>Глобальный поиск</h1><p>Поиск по вирусам, характеристикам, информации.</p></header>
              <label className="global-search-box"><span aria-hidden="true">⌕</span><span className="sr-only">Глобальный поиск</span><input value={globalQuery} onChange={(event) => setGlobalQuery(event.target.value)} type="search" placeholder="Введите название, код или тему" /><kbd>Ctrl K</kbd></label>
              <div className="search-recommendations" aria-label="Рекомендации поиска"><span>РЕКОМЕНДАЦИИ</span><div>{content.searchRecommendations.slice(0, 6).map((item, index) => <button key={`${item}-${index}`} type="button" onClick={() => setGlobalQuery(item)}><FormattedText text={item} document={richTextLine(content.formattedText[portiaTextKey.searchRecommendations], content.searchRecommendations, index)} /></button>)}</div></div>
              <div className="global-search-summary"><span>{globalQuery ? `Результаты для «${globalQuery}»` : "Доступные записи"}</span><strong>{String(searchResults.length).padStart(2, "0")}</strong></div>
              <div className="global-search-results">
                {!contentReady ? <LoadingState label="Загрузка архива…" /> : <>
                {searchResults.map((result) => (
                  <button key={`${result.type}-${result.id}`} type="button" className="global-result" onClick={() => openSearchResult(result)}>
                    <span className="global-result-mark">{result.type === "virus" ? "VIS" : result.type === "info" ? "INF" : result.type === "file" ? "FILE" : "MSG"}</span>
                    <span className="global-result-main"><span className="global-result-heading"><strong>{result.title || "БЕЗ НАЗВАНИЯ"}</strong><small>{result.meta}</small></span><span className="global-result-preview">{result.body}</span></span>
                  </button>
                ))}
                {!searchResults.length && <div className="global-search-empty empty-state"><PortiaIllustration name="microscope" /><strong>Совпадений нет</strong><span>Измените запрос или выберите рекомендацию.</span></div>}
                </>}
              </div>
            </div>
          </AppWindow>

          <AppWindow app="info" state={windows.info} active={activeApp === "info"} onFocus={focusApp} onMinimize={minimizeApp} onMaximize={toggleMaximize} onClose={closeApp} onGeometry={updateWindowGeometry} className="utility-window info-window" meta="АРХИВ ЗНАНИЙ">
            {!contentReady ? <LoadingState label="Загрузка разделов…" /> : <div className="info-library">
              <aside className="info-index">{content.infoSections.map((section, index) => <button key={section.id} type="button" className={section.id === selectedInfo?.id ? "active" : ""} onClick={() => setSelectedInfoId(section.id)}><small>{String(index + 1).padStart(2, "0")}</small><span>{section.title}</span></button>)}</aside>
              <article className="info-document">{selectedInfo ? <div className="content-fade" key={selectedInfo.id}><h1>{selectedInfo.title}</h1><FormattedText className="info-document-copy" text={selectedInfo.body} document={content.formattedText[portiaTextKey.info(selectedInfo.id)]} /></div> : <div className="editor-empty">Разделов пока нет.</div>}</article>
            </div>}
          </AppWindow>

          <AppWindow app="broadcasts" state={windows.broadcasts} active={activeApp === "broadcasts"} onFocus={focusApp} onMinimize={minimizeApp} onMaximize={toggleMaximize} onClose={closeApp} onGeometry={updateWindowGeometry} className="utility-window broadcasts-window" meta="КАНАЛ СТАНЦИИ">
            <div className="broadcasts-app">
              <header><h1>Объявления</h1><p>Еженедельные квесты, задачи и новости.</p></header>
              {!contentReady ? <LoadingState label="Загрузка объявлений…" /> : <div className="broadcast-grid">
                {content.broadcasts.filter((item) => item.published).map((item) => <article className={`broadcast-card ${item.type}`} key={item.id}><span>{broadcastType(item.type)}</span><h2>{item.title || "БЕЗ НАЗВАНИЯ"}</h2><FormattedText className="broadcast-card-copy" text={item.body} document={content.formattedText[portiaTextKey.broadcast(item.id)]} /></article>)}
                {!content.broadcasts.some((item) => item.published) && <div className="broadcast-empty empty-state"><PortiaIllustration name="flask" /><strong>Сообщений пока нет</strong><span>Новые квесты, задачи и новости появятся здесь.</span></div>}
              </div>}
            </div>
          </AppWindow>

          {(["sheet", "charter"] as const).map((app) => <AppWindow key={app} app={app} state={windows[app]} active={activeApp === app} onFocus={focusApp} onMinimize={minimizeApp} onMaximize={toggleMaximize} onClose={closeApp} onGeometry={updateWindowGeometry} className="utility-window document-window" meta="ДОКУМЕНТ ОТРЯДА">
            <EmbeddedDocument src={embeddedApps[app].src} external={embeddedApps[app].external} title={appMeta[app].label} />
          </AppWindow>)}
          <AppWindow app="trash" state={windows.trash} active={activeApp === "trash"} onFocus={focusApp} onMinimize={minimizeApp} onMaximize={toggleMaximize} onClose={closeApp} onGeometry={updateWindowGeometry} className="utility-window trash-window" meta={`ФАЙЛОВ ${String(trashFiles.length + recycledViruses.length).padStart(2, "0")}`}>
            <div className={`trash-app${activeTrashFile || activeTrashVirus ? " is-viewing" : ""}`}>
              <header><h1>Корзина</h1><p>Бесполезный хлам — кому вообще придет в голову его перебирать?</p></header>
              {!contentReady ? <LoadingState label="Загрузка корзины…" /> : <div className="trash-layout">
                <div className="trash-files">
                  <div className="trash-list-head" aria-hidden="true"><span>ИМЯ</span><span>ИСХОДНОЕ РАСПОЛОЖЕНИЕ</span><span>ТИП</span></div>
                  {trashOrder.map((key) => {
                    if (key.startsWith("virus:")) {
                      const virus = recycledViruses.find((item) => item.id === key.slice(6));
                      return virus ? <button className={`trash-file-row${activeTrashFileId === `virus:${virus.id}` ? " active" : ""}`} type="button" key={key} onClick={() => openTrashVirus(virus)}><span className="trash-file-name"><i className="trash-file-icon virus">V</i><strong>{virus.name}</strong></span><span>C:\PORTIA\VIRUS_ARCHIVE</span><span>Вирус в корзине</span></button> : null;
                    }
                    const file = trashFiles.find((item) => item.id === key.slice(5));
                    return file ? <button className={`trash-file-row${activeTrashFileId === file.id ? " active" : ""}`} type="button" key={key} onClick={() => openTrashFile(file)}><span className="trash-file-name"><i className={`trash-file-icon ${file.kind}`}>{file.kind === "virus" ? "V" : file.kind === "image" ? "IMG" : "TXT"}</i><strong>{file.name}</strong></span><span>{file.location}</span><span>{recycleFileType(file.kind)}</span></button> : null;
                  })}
                  {!trashFiles.length && !recycledViruses.length && <div className="editor-empty empty-state"><PortiaIllustration name="flask" /><strong>Корзина пуста</strong></div>}
                </div>
                {activeTrashVirus && <div className="trash-viewer virus doc-open" key={activeTrashVirus.id}><div className="trash-viewer-head"><div><span>ВИРУС В КОРЗИНЕ</span><strong>{activeTrashVirus.name} / {activeTrashVirus.code}</strong></div><button type="button" onClick={() => setActiveTrashFileId(null)} aria-label="Закрыть файл">×</button></div><div className="trash-viewer-body trash-virus-document doc-print"><VirusRecord virus={activeTrashVirus} formattedText={content.formattedText} onOpenLog={() => undefined} /></div></div>}
                {activeTrashFile && <div className={`trash-viewer ${activeTrashFile.kind} doc-open`} key={activeTrashFile.id}>
                  <div className="trash-viewer-head"><div><span>ТОЛЬКО ДЛЯ ЧТЕНИЯ</span><strong>{activeTrashFile.name}</strong></div><button type="button" onClick={() => setActiveTrashFileId(null)} aria-label="Закрыть файл">×</button></div>
                  <div className="trash-viewer-body doc-print">
                    {activeTrashFile.kind === "image" ? (
                      <figure className="trash-image-document">
                        {activeTrashFile.image ? <img src={activeTrashFile.image} alt={activeTrashFile.name} decoding="async" referrerPolicy="no-referrer" /> : <div className="trash-image-missing">ИЗОБРАЖЕНИЕ НЕДОСТУПНО</div>}
                        {activeTrashFile.content && <figcaption><FormattedText text={activeTrashFile.content} document={content.formattedText[portiaTextKey.recycle(activeTrashFile.id)]} /></figcaption>}
                      </figure>
                    ) : (
                       <article className="trash-text-document"><div className="trash-document-meta">{recycleFileType(activeTrashFile.kind)} / {activeTrashFile.location}</div>{activeTrashFile.kind === "virus" ? <>{recycleFileBody({ ...activeTrashFile, content: "" }, [...content.viruses, ...recycledViruses]) && <pre>{recycleFileBody({ ...activeTrashFile, content: "" }, [...content.viruses, ...recycledViruses])}</pre>}{activeTrashFile.content && <FormattedText className="trash-formatted-text" text={activeTrashFile.content} document={content.formattedText[portiaTextKey.recycle(activeTrashFile.id)]} />}{!recycleFileBody({ ...activeTrashFile, content: "" }, [...content.viruses, ...recycledViruses]) && !activeTrashFile.content && <span>Файл не содержит текста.</span>}</> : <FormattedText className="trash-formatted-text" text={activeTrashFile.content || "Файл не содержит текста."} document={content.formattedText[portiaTextKey.recycle(activeTrashFile.id)]} />}</article>
                    )}
                  </div>
                </div>}
              </div>}
            </div>
          </AppWindow>

          <AppWindow app="settings" state={windows.settings} active={activeApp === "settings"} onFocus={focusApp} onMinimize={minimizeApp} onMaximize={toggleMaximize} onClose={closeApp} onGeometry={updateWindowGeometry} className="utility-window settings-window" meta="НАСТРОЙКИ">
            <div className="settings-app">
              <header><h1>Настройки рабочего стола</h1><p>Оформление и расположение ярлыков сохраняются на этом устройстве.</p></header>
              <SettingGroup title="Цвет интерфейса" values={[['teal','Portia'],['ice','Холодный'],['amber','Янтарный'],['red','Тревога']]} current={desktopSettings.accent} onSelect={(value) => updateDesktopSetting("accent", value)} />
              <SettingGroup title="Фон рабочего стола" values={[['radar','Паутина'],['grid','Спирали ДНК'],['gel','Гель'],['cells','Клетки'],['quiet','Чистый']]} current={desktopSettings.wallpaper} onSelect={(value) => updateDesktopSetting("wallpaper", value)} />
              <SettingGroup title="Размер ярлыков" values={[['compact','Компактный'],['standard','Стандартный'],['large','Крупный']]} current={desktopSettings.iconSize} onSelect={(value) => updateDesktopSetting("iconSize", value)} />
              <SettingGroup title="Анимации" values={[['system','Как в системе'],['on','Включены'],['off','Выключены']]} current={desktopSettings.motion} onSelect={(value) => updateDesktopSetting("motion", value)} />
              <section className="settings-section content-control-entry"><div><h2>Содержимое сайта</h2><p>{canEdit ? "Редактируйте вирусы, информацию, сообщения, поиск и советы помощника." : "Войдите в разрешённый аккаунт редактора."}</p></div><div className="content-control-actions"><button type="button" disabled={!canEdit} onClick={() => openApp("editor")}>ОТКРЫТЬ РЕДАКТОР</button><a href="/owner-login">{canEdit ? "УПРАВЛЕНИЕ ВХОДОМ" : "ВОЙТИ В РЕДАКТОР"}</a></div></section>
              <div className="settings-footer"><button className="factory-reset" type="button" onClick={resetDesktopSettings}>СБРОСИТЬ ДО ЗАВОДСКИХ</button><span className={`settings-saved-status${settingsSavedVisible ? " is-visible" : ""}`} role="status" aria-live="polite">Настройки сохранены</span></div>
            </div>
          </AppWindow>

          <AppWindow app="editor" state={windows.editor} active={activeApp === "editor"} onFocus={focusApp} onMinimize={minimizeApp} onMaximize={toggleMaximize} onClose={closeApp} onGeometry={updateWindowGeometry} className="editor-window" meta="ДОСТУП ВЛАДЕЛЬЦА">
            {canEdit ? <PortiaEditor content={content} saveState={saveState} canManageEditors={canManageEditors} active={activeApp === "editor" && !windows.editor.minimized} onDirtyChange={reportEditorDirty} closeRequest={editorCloseRequest} onCloseApproved={() => requestExit("editor", "close", true)} onSave={saveContent} onEmployeeSaved={updateEmployee} /> : <div className="editor-empty">У этого аккаунта нет доступа к редактору.</div>}
          </AppWindow>
        </main>

        <div className={`desktop-assistant${assistantTipVisible ? " is-speaking" : ""}${assistantOffended ? " is-offended" : ""}${assistantRecovering ? " is-recovering" : ""}`} data-mood={assistantMood || undefined} data-squish={assistantSquish ? (assistantSquish % 2 ? "a" : "b") : undefined} data-auto={assistantAutomaticKind ?? undefined}>
          {assistantTipVisible && <div className="assistant-bubble" role="status"><span>{assistantMessageHeading}</span><FormattedText className="assistant-formatted-text" text={assistantMessageText} document={assistantMessageDocument} /></div>}
          <button className="assistant-button" type="button" onClick={activateAssistant} onContextMenu={(event) => event.preventDefault()} aria-disabled={assistantOffended} aria-label="Получить совет Вивьян"><img src="/assets/portia-assistant.png" alt="" draggable={false} /></button>
          <span className="assistant-label">ВИВЬЯН // ПОМОЩНИК</span>
        </div>

        <footer className="taskbar">
          <button className="start-button" type="button" onClick={() => setStartOpen((value) => !value)} aria-expanded={startOpen}><img className="portia-mark" src="/assets/portia-logo.png" alt="" /><span>PORTIA</span></button>
          <div className="taskbar-apps" aria-label="Открытые программы">
            {taskbarOrder.filter((app) => windows[app].open).map((app) => <button key={app} data-taskbar-app={app} className={`taskbar-app${activeApp === app && !windows[app].minimized ? " active" : ""}${bouncingApps[app] ? " is-bouncing" : ""}`} type="button" onPointerDown={beginTaskbarDrag(app)} onPointerMove={moveTaskbarDrag} onPointerUp={endTaskbarDrag} onPointerCancel={endTaskbarDrag} onLostPointerCapture={endTaskbarDrag} onClick={(event) => {
              if (suppressTaskbarClick.current) { suppressTaskbarClick.current = false; return; }
              // A window on its way out comes back, like a minimised one.
              if (windows[app].minimized || windows[app].exiting) openApp(app, originOf(event.currentTarget, "taskbar"));
              else if (activeApp === app) minimizeApp(app);
              else focusApp(app);
            }}><span className="mini-app-icon"><PortiaIcon name={appMeta[app].icon} /></span><span>{appMeta[app].label}</span></button>)}
          </div>
          
        </footer>

        {startOpen && <div className="start-panel">
          <div className="start-panel-brand"><img className="portia-mark" src="/assets/portia-logo.png" alt="" /><div><strong>PORTIA OS</strong></div></div>
          <button type="button" onClick={() => openApp("search")}><span className="start-panel-icon" data-icon="search"><PortiaIcon name="search" /></span>Глобальный поиск</button>
          <button type="button" onClick={() => openApp("archive")}><span className="start-panel-icon" data-icon="virus"><PortiaIcon name="virus" /></span>База вирусов</button>
          <button type="button" onClick={() => openApp("employees")}><span className="start-panel-icon" data-icon="employees"><PortiaIcon name="employees" /></span>Сотрудники</button>
          <button type="button" onClick={() => openApp("settings")}><span className="start-panel-icon" data-icon="settings"><PortiaIcon name="settings" /></span>Настройки</button>
        </div>}

      </div>
    </>
  );
}

const bootLines = ["ПОДКЛЮЧЕНИЕ К АРХИВУ… OK", "ПРОВЕРКА ДОПУСКА… УРОВЕНЬ II", "ЗАГРУЗКА ДОСЬЕ… OK", "ТЕРМИНАЛ PORTIA ГОТОВ"];

function BootScreen({ visible }: { visible: boolean }) {
  // The spider waits on its thread until its PNG is decoded, so it descends instead of popping in late.
  const [markReady, setMarkReady] = useState(false);
  const markRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    // Loaded before hydration: React never sees that load event.
    if (!markRef.current?.complete) return;
    const timer = window.setTimeout(() => setMarkReady(true), 0);
    return () => window.clearTimeout(timer);
  }, []);
  return <div className={`boot-screen${visible ? "" : " boot-complete"}`} aria-hidden={!visible}><div className={`boot-core${markReady ? " is-ready" : ""}`}>
    <span className="boot-thread" />
    <img ref={markRef} className="portia-mark" src="/assets/portia-logo.png" alt="" fetchPriority="high" onLoad={() => setMarkReady(true)} onError={() => setMarkReady(true)} />
    <span>PORTIA OS</span><strong>Запуск лабораторного терминала</strong>
    <div className="boot-lines">{bootLines.map((line, index) => <p key={line} style={{ animationDelay: `${200 + index * 280}ms` }}>{line}</p>)}</div>
  </div></div>;
}

function EmployeeImage({ src, alt, fallbackClassName = "" }: { src: string; alt: string; fallbackClassName?: string }) {
  const [loaded, setLoaded] = useState(false);
  const source = src || "/assets/portia-logo.png";
  return <div className={`personnel-image-loader${loaded ? " is-loaded" : ""}`}>
    <span className="personnel-image-skeleton" aria-hidden="true" />
    <img src={source} alt={alt} className={!src ? fallbackClassName : ""} referrerPolicy="no-referrer" onLoad={() => setLoaded(true)} onError={() => setLoaded(true)} />
  </div>;
}

function DesktopIcon({ app, onOpen, position, onMove, className = "", badge = false }: { app: Exclude<AppId, "editor">; onOpen: (app: AppId, origin?: OpenOrigin) => void; position?: ShortcutPosition; onMove: (shortcutId: DesktopShortcutId, position: ShortcutPosition) => void; className?: string; badge?: boolean }) {
  return <DraggableDesktopIcon shortcutId={app} label={appMeta[app].label} icon={appMeta[app].icon} position={position} onMove={onMove} onActivate={(origin) => onOpen(app, origin)} className={className} badge={badge} />;
}

function DraggableDesktopIcon({ shortcutId, label, icon, position, onMove, onActivate, className = "", badge = false }: {
  shortcutId: DesktopShortcutId;
  label: string;
  icon: PortiaIconName;
  position?: ShortcutPosition;
  onMove: (shortcutId: DesktopShortcutId, position: ShortcutPosition) => void;
  onActivate?: (origin: OpenOrigin) => void;
  className?: string;
  badge?: boolean;
}) {
  const dragRef = useRef<null | { pointerId: number; startX: number; startY: number; originX: number; originY: number; workspace: HTMLElement; target: HTMLElement; moved: boolean }>(null);
  const suppressActivation = useRef(false);
  const [dragging, setDragging] = useState(false);

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (window.innerWidth <= 520 || event.button !== 0) return;
    const workspace = event.currentTarget.closest<HTMLElement>(".workspace");
    if (!workspace) return;
    const iconRect = event.currentTarget.getBoundingClientRect();
    const workspaceRect = workspace.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: iconRect.left - workspaceRect.left,
      originY: iconRect.top - workspaceRect.top,
      workspace,
      target: event.currentTarget,
      moved: false,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const operation = dragRef.current;
    if (!operation || operation.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - operation.startX;
    const deltaY = event.clientY - operation.startY;
    if (!operation.moved && Math.hypot(deltaX, deltaY) < 6) return;
    operation.moved = true;
    setDragging(true);
    event.preventDefault();
    const maximumX = Math.max(8, operation.workspace.clientWidth - operation.target.offsetWidth - 8);
    const maximumY = Math.max(8, operation.workspace.clientHeight - operation.target.offsetHeight - 8);
    onMove(shortcutId, {
      x: Math.min(maximumX, Math.max(8, operation.originX + deltaX)),
      y: Math.min(maximumY, Math.max(8, operation.originY + deltaY)),
    });
  };

  const finishDrag = (event: React.PointerEvent<HTMLElement>) => {
    const operation = dragRef.current;
    if (!operation || operation.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (operation.moved) {
      suppressActivation.current = true;
      window.setTimeout(() => { suppressActivation.current = false; }, 0);
    }
    dragRef.current = null;
    setDragging(false);
  };

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (suppressActivation.current) {
      event.preventDefault();
      return;
    }
    const symbol = event.currentTarget.querySelector(".desktop-icon-symbol") ?? event.currentTarget;
    onActivate?.(originOf(symbol, "icon"));
  };

  const sharedProps = {
    className: `desktop-icon${className ? ` ${className}` : ""}${dragging ? " is-dragging" : ""}`,
    "data-shortcut": shortcutId,
    // A position saved on a bigger screen is held inside the desktop so the icon never disappears.
    style: position ? { left: `max(0px, min(${position.x}px, calc(100% - 100px)))`, top: `max(0px, min(${position.y}px, calc(100% - 110px)))`, right: "auto", bottom: "auto" } : undefined,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: finishDrag,
    onPointerCancel: finishDrag,
    onClick: handleClick,
    onDragStart: (event: React.DragEvent<HTMLElement>) => event.preventDefault(),
  };
  const content = <><span data-icon={icon} className="desktop-icon-symbol"><PortiaIcon name={icon} />{badge && <i className="desktop-icon-badge" aria-label="Есть новая сводка" />}</span><span>{label}</span></>;

  return <button {...sharedProps} type="button">{content}</button>;
}

const zoomSteps = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];

function EmbeddedDocument({ src, external, title }: { src: string; external: string; title: string }) {
  const [zoom, setZoom] = useState(1);
  const [ctrlHeld, setCtrlHeld] = useState(false);
  const [frameLoading, setFrameLoading] = useState(true);
  const frameRef = useRef<HTMLDivElement>(null);
  const step = useCallback((direction: 1 | -1) => setZoom((current) => {
    const index = zoomSteps.findIndex((value) => value >= current - 0.001);
    return zoomSteps[Math.min(zoomSteps.length - 1, Math.max(0, index + direction))];
  }), []);

  // Wheel events over the embedded page never reach PORTIA, so while Ctrl is held a clear
  // layer covers the document and takes the wheel for our own zoom.
  useEffect(() => {
    const key = (event: KeyboardEvent) => setCtrlHeld(event.ctrlKey || event.metaKey);
    const release = () => setCtrlHeld(false);
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", key);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", key);
      window.removeEventListener("blur", release);
    };
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    // Non-passive so Ctrl+wheel zooms the document instead of the whole browser tab.
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      step(event.deltaY < 0 ? 1 : -1);
    };
    frame.addEventListener("wheel", wheel, { passive: false });
    return () => frame.removeEventListener("wheel", wheel);
  }, [step]);

  return <div className="document-app" ref={frameRef}>
    <div className="document-app-viewport">
      <iframe src={src} title={title} loading="lazy" referrerPolicy="no-referrer" onLoad={() => setFrameLoading(false)} style={{ width: `${100 / zoom}%`, height: `${100 / zoom}%`, transform: `scale(${zoom})` }} />
      {frameLoading && <LoadingState label="Загрузка документа…" />}
      {ctrlHeld && <div className="document-app-zoom-layer" aria-hidden="true" />}
    </div>
    <div className="document-app-bar">
      <div className="document-app-zoom" role="group" aria-label="Масштаб документа">
        <button type="button" onClick={() => step(-1)} aria-label="Уменьшить">−</button>
        <button type="button" onClick={() => setZoom(1)} aria-label="Сбросить масштаб">{Math.round(zoom * 100)}%</button>
        <button type="button" onClick={() => step(1)} aria-label="Увеличить">+</button>
      </div>
      <a className="document-app-external" href={external} target="_blank" rel="noreferrer">Открыть отдельно</a>
    </div>
  </div>;
}

function AppWindow({ app, state, active, onFocus, onMinimize, onMaximize, onClose, onGeometry, className, meta, children }: {
  app: AppId;
  state: WindowState;
  active: boolean;
  onFocus: (app: AppId) => void;
  onMinimize: (app: AppId) => void;
  onMaximize: (app: AppId) => void;
  onClose: (app: AppId) => void;
  onGeometry: (app: AppId, geometry: WindowGeometry) => void;
  className: string;
  meta: string;
  children: React.ReactNode;
}) {
  const windowRef = useRef<HTMLElement>(null);
  const dragRef = useRef<null | (WindowGeometry & { pointerId: number; startX: number; startY: number; parentWidth: number; parentHeight: number })>(null);
  const resizeRef = useRef<null | (WindowGeometry & { edge: ResizeEdge; pointerId: number; startX: number; startY: number; parentWidth: number; parentHeight: number })>(null);

  const readGeometry = () => {
    const element = windowRef.current;
    const parent = element?.parentElement;
    if (!element || !parent) return null;
    const rect = element.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    return {
      x: rect.left - parentRect.left,
      y: rect.top - parentRect.top,
      width: rect.width,
      height: rect.height,
      parentWidth: parentRect.width,
      parentHeight: parentRect.height,
    };
  };

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (state.maximized || window.matchMedia("(max-width: 900px)").matches) return;
    if ((event.target as HTMLElement).closest("button")) return;
    const geometry = readGeometry();
    if (!geometry) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { ...geometry, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
    onGeometry(app, geometry);
  };

  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const operation = dragRef.current;
    if (!operation || operation.pointerId !== event.pointerId) return;
    const nextX = Math.min(Math.max(0, operation.x + event.clientX - operation.startX), Math.max(0, operation.parentWidth - 160));
    const nextY = Math.min(Math.max(0, operation.y + event.clientY - operation.startY), Math.max(0, operation.parentHeight - 46));
    onGeometry(app, { x: nextX, y: nextY, width: operation.width, height: operation.height });
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  const beginResize = (edge: ResizeEdge) => (event: React.PointerEvent<HTMLSpanElement>) => {
    if (state.maximized || window.matchMedia("(max-width: 900px)").matches) return;
    const geometry = readGeometry();
    if (!geometry) return;
    event.stopPropagation();
    onFocus(app);
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = { ...geometry, edge, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
    onGeometry(app, geometry);
  };

  const moveResize = (event: React.PointerEvent<HTMLSpanElement>) => {
    const operation = resizeRef.current;
    if (!operation || operation.pointerId !== event.pointerId) return;
    onGeometry(app, resizeGeometry(operation, operation.edge, event.clientX - operation.startX, event.clientY - operation.startY, { width: operation.parentWidth, height: operation.parentHeight }, minimumWindowSize(app)));
  };

  const endResize = (event: React.PointerEvent<HTMLSpanElement>) => {
    if (resizeRef.current?.pointerId === event.pointerId) resizeRef.current = null;
  };

  // Points the zoom / minimise at its source. Offsets, not getBoundingClientRect, for the window:
  // during a restore the animation has already shrunk the rect.
  const towardTaskbar = state.exiting === "minimize" || (state.openOrigin?.kind === "taskbar" && !state.exiting);
  useLayoutEffect(() => {
    const element = windowRef.current;
    const parent = element?.offsetParent;
    if (!element || !parent || state.minimized) return;
    const parentRect = parent.getBoundingClientRect();
    const box = { left: parentRect.left + element.offsetLeft - parent.scrollLeft, top: parentRect.top + element.offsetTop - parent.scrollTop };
    let target: { x: number; y: number } | undefined = state.openOrigin?.kind === "icon" && !state.exiting ? state.openOrigin : undefined;
    if (towardTaskbar) {
      const button = document.querySelector(`[data-taskbar-app="${app}"]`);
      if (button) target = originOf(button, "taskbar");
    }
    if (!target) return;
    const x = target.x - box.left;
    element.style.transformOrigin = `${Math.round(x)}px ${Math.round(target.y - box.top)}px`;
  }, [app, towardTaskbar, state.exiting, state.minimized, state.open, state.openOrigin]);

  if (!state.open) return null;
  const geometryStyle = state.geometry && !state.maximized ? {
    left: state.geometry.x,
    top: state.geometry.y,
    right: "auto",
    bottom: "auto",
    width: state.geometry.width,
    height: state.geometry.height,
    transform: "none",
  } : {};

  return <section ref={windowRef} className={`app-window ${className}${active ? " is-active" : ""}${state.maximized ? " is-maximized" : ""}${state.exiting === "close" ? " is-closing" : ""}${state.exiting === "minimize" ? " is-minimizing" : ""}${state.openOrigin?.kind === "icon" ? " from-icon" : state.openOrigin?.kind === "taskbar" ? " from-taskbar" : ""}`} style={{ zIndex: state.z, display: state.minimized ? "none" : undefined, ...geometryStyle }} onPointerDown={() => onFocus(app)} aria-label={appMeta[app].label}>
    <div className="window-titlebar" onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onDoubleClick={(event) => { if (!(event.target as HTMLElement).closest("button")) onMaximize(app); }}><div className="window-identity"><span className="window-app-mark"><PortiaIcon name={appMeta[app].icon} /></span><span>{appMeta[app].path}</span></div><div className="window-meta">{meta}</div><div className="window-controls"><button type="button" data-window-action="minimize" onClick={(event) => { event.stopPropagation(); onMinimize(app); }} aria-label={`Свернуть ${appMeta[app].label}`}>―</button><button type="button" data-window-action="maximize" onClick={(event) => { event.stopPropagation(); onMaximize(app); }} aria-label={`Развернуть ${appMeta[app].label}`}>□</button><button type="button" data-window-action="close" onClick={(event) => { event.stopPropagation(); onClose(app); }} aria-label={`Закрыть ${appMeta[app].label}`}>×</button></div></div>
    {children}
    {resizeEdges.map((edge) => <span key={edge} className={`window-edge window-edge-${edge}`} aria-hidden="true" onPointerDown={beginResize(edge)} onPointerMove={moveResize} onPointerUp={endResize} onPointerCancel={endResize} />)}
  </section>;
}

// In the archive list the badges stand alone, so each one names its term for screen readers and on hover.
function RowBadges({ virus }: { virus: Virus }) {
  const terms = [virus.classification.danger, virus.classification.spread, virus.classification.escapeRisk];
  const badges = terms.flatMap((term) => { const icon = classificationIconFor(term); return icon ? [{ term, icon }] : []; });
  if (!badges.length) return null;
  return <span className="row-badges">{badges.map(({ term, icon }) => <span className="row-badge" key={term} title={term}><PortiaIcon name={icon} role="img" aria-hidden={false} aria-label={term} /></span>)}</span>;
}

function VirusRecord({ virus, formattedText, onOpenLog }: { virus: Virus; formattedText: PortiaContent["formattedText"]; onOpenLog: (id: string) => void }) {
  const classification = [
    ["danger", "Общий уровень опасности", virus.classification.danger, "danger"], ["spread", "Распространение", virus.classification.spread, "spread"], ["transmission", "Способ распространения", virus.classification.transmission, "transmission"],
    ["escapeRisk", "Угроза и риск побега", virus.classification.escapeRisk, "escape"], ["mind", "Разум", virus.classification.mind, "mind"], ["appearance", "Вид / внешность", virus.classification.appearance, "appearance"], ["behavior", "Поведение", virus.classification.behavior, "behavior"],
  ] as const;
  return <div className="record-body content-fade" key={virus.id}>
    <header className="record-header"><div><span className="record-code">{virus.code}</span><h2>{virus.name}</h2></div><div className="record-status"><span />{virus.status}</div></header>
    <div className="record-document">
      <section className="record-hero"><MediaBlock src={virus.infectedImage} alt={`Субъект после заражения вирусом ${virus.name}`} label="Фото после заражения" /><div className="classification-panel"><div className="section-kicker"><span>01</span>КЛАССИФИКАЦИЯ</div><div className="classification-grid">{classification.map(([key, label, value, tone]) => { const level = classificationLevel(key, value); const badge = classificationIconFor(value); return <div className={`class-cell ${tone}${level ? ` level-${level}` : ""}`} key={label}><span>{label}</span><strong>{badge && <PortiaIcon name={badge} className="class-badge" />}{value}</strong>{level && <small>УРОВЕНЬ {level}</small>}</div>; })}</div></div></section>
      <DossierSection index="02" title="ВНЕШНИЕ ХАРАКТЕРИСТИКИ"><FormattedText className="lead-copy" text={virus.external} document={formattedText[portiaTextKey.virus(virus.id, "external")]} /></DossierSection>
      <DossierSection index="03" title="ХАРАКТЕРИСТИКИ С PPU"><div className="metric-grid"><div><span>ЗДОРОВЬЕ</span><FormattedText text={virus.ppu.health} document={formattedText[portiaTextKey.virus(virus.id, "ppu-health")]} /></div><div><span>СКОРОСТЬ</span><FormattedText text={virus.ppu.speed} document={formattedText[portiaTextKey.virus(virus.id, "ppu-speed")]} /></div><div><span>СПОСОБНОСТИ</span><FormattedText text={virus.ppu.abilities} document={formattedText[portiaTextKey.virus(virus.id, "ppu-abilities")]} /></div></div></DossierSection>
      <DossierSection index="04" title="ФИЗИОЛОГИЯ"><FormattedText className="lead-copy" text={virus.physiology} document={formattedText[portiaTextKey.virus(virus.id, "physiology")]} /></DossierSection>
      <DossierSection index="05" title="МУТАЦИИ ВИРУСА"><div className="mutation-grid">{virus.mutations.map((mutation, index) => <section className="mutation-card" key={`${mutation.name}-${index}`}><div className="mutation-index">M-{String(index + 1).padStart(2, "0")}</div><MediaBlock src={mutation.image} alt={mutation.name} label="Скриншот мутации" /><div className="mutation-copy"><h4>{mutation.name}</h4><FormattedText text={mutation.description} document={formattedText[portiaTextKey.mutation(virus.id, index)]} /></div></section>)}</div></DossierSection>
      <DossierSection index="06" title="ЗАПИСИ УЧЁНЫХ"><div className="access-summary"><span>ТЕКУЩИЙ УРОВЕНЬ ДОСТУПА</span><strong>II</strong></div><div className="scientist-log-list">{virus.scientistLogs.map((log, index) => { const isOpen = log.lockedLevel <= 2; return <button className={`scientist-log-row ${isOpen ? "available" : "locked"}`} type="button" key={log.id} onClick={() => onOpenLog(log.id)}><span className="log-number">LOG-{String(index + 1).padStart(2, "0")}</span><span className="log-name"><strong>{log.title}</strong><small>{log.scientist}</small></span><span className="log-clearance"><PortiaIcon name={isOpen ? "lock-open" : "lock-closed"} className="log-lock" />УРОВЕНЬ {roman(log.lockedLevel)}</span><span className="log-action">{isOpen ? "ОТКРЫТЬ" : "ЗАБЛОКИРОВАНО"}</span></button>; })}{virus.scientistLogs.length === 0 && <div className="scientist-log-empty">ЗАПИСИ ОТСУТСТВУЮТ</div>}</div></DossierSection>
      <footer className="record-footer"><span>PORTIA / SCIENCE REPORTS</span><span>ЗАПИСЬ {virus.code}</span></footer>
    </div>
  </div>;
}

function ScientistDocument({ virus, logId, onBack }: { virus: Virus; logId: string; onBack: () => void }) {
  const log = virus.scientistLogs.find((item) => item.id === logId);
  if (!log) return null;
  const isOpen = log.lockedLevel <= 2;
  const level = log.lockedLevel;
  return <article className="archive-document-view doc-open"><header className="archive-document-bar"><button type="button" onClick={onBack}>ВЕРНУТЬСЯ</button><span>PORTIA / АРХИВ / УРОВЕНЬ {roman(level)}</span></header><div className="archive-document-paper doc-print"><div className="archive-document-stamp"><PortiaIcon name={isOpen ? "lock-open" : "lock-closed"} className="log-lock" />{isOpen ? "ДОПУСК РАЗРЕШЁН" : "ДОПУСК ОТКЛОНЁН"}</div><div className="archive-document-code">PORTIA://VIRUS_ARCHIVE/{virus.code}/LOGS/{log.id}</div><h1>{log.title}</h1><dl className="archive-document-meta"><div><dt>ОБЪЕКТ</dt><dd>{virus.name} / {virus.code}</dd></div><div><dt>УЧЁНЫЙ</dt><dd>{log.scientist}</dd></div><div><dt>УРОВЕНЬ</dt><dd>{roman(level)}</dd></div></dl>{isOpen ? <section className="archive-document-section"><h2>ТЕКСТ ЗАПИСИ</h2><ScientistRichText log={log} /></section> : <section className="archive-document-section restricted-document"><div className="restriction-mark">ДОСТУП ОГРАНИЧЕН</div><h2>НЕДОСТАТОЧНЫЙ УРОВЕНЬ ДОСТУПА</h2><p>Текущий уровень: II. Для чтения этого документа требуется уровень {roman(level)}.</p><RedactedDocument log={log} /></section>}<footer><span>ВНУТРЕННИЙ АРХИВ PORTIA</span><span>ЗАПРЕЩЕНО РАСПРОСТРАНЯТЬ</span></footer></div></article>;
}

function scientistDocument(log: ScientistLog): RichTextDocument {
  if (log.richContent?.runs?.length) return log.richContent;
  return { runs: [{ text: log.content.join("\n\n") }] };
}

function RedactedDocument({ log }: { log: ScientistLog }) {
  const plainText = scientistDocument(log).runs.map((run) => run.text).join("");
  const actualParagraphs = plainText.split(/\n+/).map((paragraph) => paragraph.trim().split(/\s+/).filter(Boolean)).filter((words) => words.length > 0);
  const paragraphs = actualParagraphs.length > 0
    ? actualParagraphs.map((words) => words.map((word) => Math.max(2.4, Math.min(12, Array.from(word).length * .72 + .8))))
    : generatedRedaction(log.id);

  return <div className="redacted-document" aria-label="Засекреченный текст">
    <div className="redacted-document-meta"><span>ЗАСЕКРЕЧЕННЫЙ ФРАГМЕНТ</span></div>
    <div className="redacted-document-copy" aria-hidden="true">
      {paragraphs.map((segments, paragraphIndex) => <p key={paragraphIndex}>
        {segments.map((visualLength, segmentIndex) => {
          return <i key={`${paragraphIndex}-${segmentIndex}`} style={{ width: `${visualLength}ch` }} />;
        })}
      </p>)}
    </div>
  </div>;
}

function generatedRedaction(id: string) {
  let state = Array.from(id).reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 2166136261);
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
  const segmentCount = 150 + Math.floor(random() * 151);
  const paragraphs: number[][] = [];
  let remaining = segmentCount;
  while (remaining > 0) {
    const paragraphSize = Math.min(remaining, 18 + Math.floor(random() * 35));
    paragraphs.push(Array.from({ length: paragraphSize }, () => 2.4 + random() * 8.8));
    remaining -= paragraphSize;
  }
  return paragraphs;
}

function documentBackground(hex: string | undefined, opacity: number | undefined) {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return undefined;
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${opacity ?? 1})`;
}

function ScientistRichText({ log }: { log: ScientistLog }) {
  const document = scientistDocument(log);
  return <FormattedText className="scientist-rich-text" text={log.content.join("\n\n")} document={document} />;
}

function FormattedText({ text, document, className = "" }: { text: string; document?: RichTextDocument; className?: string }) {
  const runs = document?.runs?.length ? document.runs : [{ text }];
  const fullText = runs.map((run) => run.text).join("");
  const runRanges = runs.map((run, index) => {
    const start = runs.slice(0, index).reduce((total, item) => total + item.text.length, 0);
    return { run, start, end: start + run.text.length };
  });
  const nodes: React.ReactNode[] = [];
  const mediaPattern = /https:\/\/[^\s<>"']+/gi;

  const appendStyledText = (start: number, end: number, key: string) => {
    runRanges.forEach(({ run, start: runStart, end: runEnd }, runIndex) => {
      const from = Math.max(start, runStart);
      const to = Math.min(end, runEnd);
      if (from >= to) return;
      nodes.push(<span key={`${key}-${runIndex}-${from}`} style={{
        color: run.style?.color,
        fontSize: run.style?.fontSize ? `${run.style.fontSize}px` : undefined,
        fontWeight: run.style?.fontWeight,
        backgroundColor: documentBackground(run.style?.backgroundColor, run.style?.backgroundOpacity),
      }}>{fullText.slice(from, to)}</span>);
    });
  };

  let cursor = 0;
  Array.from(fullText.matchAll(mediaPattern)).forEach((match, index) => {
    const start = match.index ?? cursor;
    const matchedText = match[0];
    const mediaUrl = embeddedMediaUrl(matchedText);
    if (!mediaUrl) return;
    appendStyledText(cursor, start, `before-media-${index}`);
    nodes.push(<img
      key={`media-${index}-${start}`}
      className="embedded-rich-media"
      src={mediaUrl}
      alt="GIF"
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
    />);
    cursor = start + matchedText.length;
  });
  appendStyledText(cursor, fullText.length, "after-media");

  return <span className={`formatted-content${className ? ` ${className}` : ""}`}>{nodes}</span>;
}

function LoadingMedia({ src, alt, label }: { src: string; alt: string; label: string }) {
  const [loading, setLoading] = useState(true);
  return <figure className={`subject-media${loading ? " is-loading" : ""}`}>
    <img src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onLoad={() => setLoading(false)} onError={() => setLoading(false)} />
    {loading && <LoadingState label="Загрузка изображения…" />}
    <figcaption>{label}</figcaption>
  </figure>;
}

function DossierSection({ index, title, children }: { index: string; title: string; children: React.ReactNode }) {
  return <section className="dossier-section"><div className="section-kicker"><span>{index}</span>{title}</div>{children}</section>;
}

// Shown while data is on its way. It fades in only after a short wait, so cached data never flashes it.
function LoadingState({ label }: { label: string }) {
  return <div className="loading-state" role="status" aria-live="polite"><span className="loading-spinner" aria-hidden="true" /><span>{label}</span></div>;
}

function MediaBlock({ src, alt, label }: { src: string; alt: string; label: string }) {
  if (src) return <LoadingMedia key={src} src={src} alt={alt} label={label} />;
  return <figure className="subject-media media-empty"><img src="/assets/portia-logo.png" alt="" aria-hidden="true" /><div><span>ВИЗУАЛЬНЫЙ МАТЕРИАЛ</span><strong>ОЖИДАЕТ ЗАГРУЗКИ</strong><small>{label}</small></div></figure>;
}

function SettingGroup({ title, values, current, onSelect }: { title: string; values: [string, string][]; current: string; onSelect: (value: string) => void }) {
  return <section className="settings-section"><h2>{title}</h2><div className="setting-options">{values.map(([value, label]) => <button key={value} type="button" className={current === value ? "selected" : ""} onClick={() => onSelect(value)}>{title === "Цвет интерфейса" && <i className={`swatch ${value}`} />}<span>{label}</span></button>)}</div></section>;
}

function broadcastType(type: "quest" | "task" | "news") {
  return type === "quest" ? "ЕЖЕНЕДЕЛЬНЫЙ КВЕСТ" : type === "task" ? "ЗАДАЧА" : "НОВОСТЬ";
}
