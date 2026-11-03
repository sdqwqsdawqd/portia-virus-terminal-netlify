"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { findGuide, findInfo, portiaTextKey, type Broadcast, type PortiaContent, type RecycleFile, type RichTextDocument, type Virus } from "@/lib/portia-content";
import { acceptsRoster, employeeRatings, mergeEmployeesAnswer, type PortiaEmployee } from "@/lib/portia-employees";
import { classificationIconFor, PortiaIcon, PortiaIllustration } from "@/components/portia-icons";
import { DesktopWallpaper } from "@/components/portia-wallpaper";
import { accentIds, bootSeenStorageKey, desktopSettingsStorageKey, motionModes, spiderModes } from "@/lib/accent-boot";
import { accentTokenNames, deriveAccentTokens } from "@/lib/accent-custom";
import { CustomColorPicker } from "@/components/custom-color-picker";
import { fitGeometry, type WindowGeometry } from "@/lib/window-geometry";
import { exitedWindow, openedWindow, originOf, visibleWindowCount, windowAppears, type OpenOrigin, type WindowState } from "@/lib/window-open";
import { acceptFetchedContent } from "@/lib/content-sync";
import { normalizePortiaContent } from "@/lib/portia-content-normalize";
import { broadcastFeed, broadcastTabOf, formatQuestDay, localDateKey, markQuestsSeen, parseSeenQuestIds, questPopup, questState, type BroadcastTab } from "@/lib/broadcasts";
import { AppWindow, appMeta, minimumWindowSize, nodWindow, type AppId } from "@/components/portia-desktop-window";
import { DesktopIcon, StartPanelButton, type DesktopShortcutId, type ShortcutPosition } from "@/components/portia-desktop-shortcuts";
import { PortiaPromotion } from "@/components/portia-promotion";
import { AppFatalPanel, AppSkeleton, AppStaleBanner } from "@/components/portia-desktop-states";
import { appViewState, contentSyncFailed, contentSyncSucceeded, emptyCopy, failureFromResponse, type AppFailure, type ContentSync } from "@/lib/app-state";
import type { RetakeNotification } from "@/lib/portia-promotion-notifications";
import { EmbeddedDocument, GuideApp, YoutubeFigure } from "@/components/portia-desktop-documents";
import { FormattedText, LoadingState, ScientistDocument, VirusRecord } from "@/components/portia-desktop-dossier";
import { PortiaImage } from "@/components/portia-desktop-media";

const PortiaEditor = dynamic(
  () => import("@/components/portia-editor").then((module) => module.PortiaEditor),
  { ssr: false, loading: () => <div className="editor-empty">Загрузка редактора…</div> },
);

// Department documents that live elsewhere, shown inside PORTIA as app windows.
const embeddedApps = {
  sheet: { src: "https://docs.google.com/spreadsheets/d/1IHAdgvHB27iW4s9aJe4L0GIpYrhS_R2EonUwugZIJww/htmlview?widget=true&headers=false", external: "https://docs.google.com/spreadsheets/d/1IHAdgvHB27iW4s9aJe4L0GIpYrhS_R2EonUwugZIJww/" },
  charter: { src: "https://sdqwqsdawqd.github.io/S.E-Portia/", external: "https://sdqwqsdawqd.github.io/S.E-Portia/" },
} as const;
// Must equal the window-close / window-minimize (full motion) and window-fade-out (reduced) durations in app/portia.css.
const WINDOW_CLOSE_MS = 180;
const WINDOW_MINIMIZE_MS = 320;
const WINDOW_FADE_OUT_MS = 120;
// shortcut: a 10 s poll of the CDN-cached content, not a push channel; switch to Supabase Realtime if visitors need it within a second or the content grows large
const contentSyncMs = 10_000;
type SaveState = "idle" | "saving" | "saved" | "error" | "conflict";
type DesktopSettings = { accent: string; wallpaper: string; iconSize: string; motion: string; spider: string; customAccent: string };

const defaultDesktopSettings: DesktopSettings = { accent: "teal", wallpaper: "radar", iconSize: "standard", motion: "on", spider: "on", customAccent: "" };
// Every value a setting may hold; the same ids the «Настройки» groups offer.
const settingValues: Record<Exclude<keyof DesktopSettings, "customAccent">, readonly string[]> = {
  accent: [...accentIds, "custom"],
  wallpaper: ["radar", "grid", "gel", "cells", "quiet"],
  iconSize: ["compact", "standard", "large"],
  motion: motionModes,
  spider: spiderModes,
};

const globalSearchAppIds: AppId[] = ["archive", "employees", "info", "guide", "broadcasts", "trash", "promotion", "settings", "sheet", "charter"];

const initialWindows: Record<AppId, WindowState> = {
  archive: { open: false, minimized: false, maximized: false, z: 11 },
  employees: { open: false, minimized: false, maximized: false, z: 10 },
  search: { open: false, minimized: false, maximized: false, z: 10 },
  info: { open: false, minimized: false, maximized: false, z: 10 },
  guide: { open: false, minimized: false, maximized: false, z: 10 },
  promotion: { open: false, minimized: false, maximized: false, z: 10 },
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
    guide: [820, 650],
    promotion: [760, 620],
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

const escapeSearch = (value: string) => value.toLocaleLowerCase("ru").replace(/ё/g, "е");
const broadcastReadStorageKey = "portia-broadcasts-read-signature-v1";
const questSeenStorageKey = "portia-quests-seen-v1";
const contentCacheStorageKey = "portia-content-last-success-v1";
const employeesCacheStorageKey = "portia-employees-last-success-v1";
// v3: every shortcut gained an explicit independent home; discard v2 coordinates that could preserve the overlapping guide.
const shortcutPositionsStorageKey = "portia-desktop-shortcuts-v3";
const taskbarOrderStorageKey = "portia-taskbar-order-v1";
const TASKBAR_BOUNCE_MS = 520;
const ASSISTANT_RECOVER_MS = 780;

// A saved profile replaces its entry; an id not in the list yet is a newly added manual employee (appended).
const withEmployee = (list: PortiaEmployee[], employee: PortiaEmployee) => list.some((item) => item.id === employee.id) ? list.map((item) => item.id === employee.id ? employee : item) : [...list, employee];

// Patches only the cached list; no cache, no write, so an editor save never creates a cache from possibly partial state (D-07).
function patchEmployeesCache(patch: (employees: PortiaEmployee[]) => PortiaEmployee[]) {
  try {
    const cached = JSON.parse(window.localStorage.getItem(employeesCacheStorageKey) ?? "null") as { employees?: unknown } | null;
    if (!cached || !Array.isArray(cached.employees)) return;
    window.localStorage.setItem(employeesCacheStorageKey, JSON.stringify({ ...cached, employees: patch(cached.employees as PortiaEmployee[]) }));
  } catch {}
}

type ContentResponse = {
  content?: PortiaContent;
  revision?: number;
  updatedAt?: string | null;
};

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
    // Quest fields join the signature only when set, so release day does not light the badge for everyone.
    .map((item) => ({ id: item.id, type: item.type, title: item.title, body: item.body, format: content.formattedText[portiaTextKey.broadcast(item.id)], ...((item.startsAt || item.endsAt || item.conditions) && { startsAt: item.startsAt, endsAt: item.endsAt, conditions: item.conditions }) })));
}

function shuffledUniqueIndices(items: string[], previousIndex = -1) {
  const seen = new Set<string>();
  const shuffled = items
    .map((item, index) => ({ item: typeof item === "string" ? item.trim() : "", index }))
    .filter(({ item }) => item && !seen.has(item) && Boolean(seen.add(item)))
    .map(({ index }) => index);
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  if (shuffled.length > 1 && shuffled[0] === previousIndex) [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
  return shuffled;
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
  // D-05: why the last /api/content poll failed and when data last really arrived (cache savedAt or a good answer). lastGoodRef moves on every good poll without a redraw; the state copies it when a failure starts.
  const [contentSync, setContentSync] = useState<ContentSync>({ lastGoodAt: null, failure: null, retrying: false });
  const lastGoodRef = useRef<string | null>(null);
  const retryBusy = useRef(false);
  // Only the newest /api/content request may start a failure: a late timeout must not put a stale strip over data a newer request just delivered.
  const contentRequestSeq = useRef(0);
  const [broadcastTab, setBroadcastTab] = useState<BroadcastTab>("news");
  const [canEdit, setCanEdit] = useState(false);
  const [canManageEditors, setCanManageEditors] = useState(false);
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  // The server's reason for the last refused save, shown in the editor's save status (D-12).
  const [saveError, setSaveError] = useState("");
  const canEditRef = useRef(false);
  useEffect(() => { canEditRef.current = canEdit; });
  const [revision, setRevision] = useState(0);
  // Read by the async GET: the newest revision this tab knows (cache, GET or its own save) and how many saves it started.
  const knownRevision = useRef(0);
  const savesStarted = useRef(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [booting, setBooting] = useState(true);
  const [clock, setClock] = useState("--:--:--");
  // The visitor's local day, known from the first render so dated quests never flash a wrong status; the tick keeps rolling it over at midnight (D-03, CONT-07).
  const [today, setToday] = useState(() => localDateKey(new Date()));
  const [startOpen, setStartOpen] = useState(false);
  const [windows, setWindows] = useState<Record<AppId, WindowState>>(initialWindows);
  const [activeApp, setActiveApp] = useState<AppId>("archive");
  const [qualificationLocked, setQualificationLocked] = useState(false);
  const qualificationLockedRef = useRef(false);
  // A ref, not state: computing z inside a state updater made setWindows a side effect of it, and Strict Mode replays updaters (ROB-03).
  const topZ = useRef(20);
  const [activeVirusId, setActiveVirusId] = useState(initialContent.viruses[0]?.id ?? "");
  const [virusQuery, setVirusQuery] = useState("");
  const [globalQuery, setGlobalQuery] = useState("");
  const [openLog, setOpenLog] = useState<string | null>(null);
  const [selectedInfoId, setSelectedInfoId] = useState(initialContent.infoSections[0]?.id ?? "");
  const [guideCardId, setGuideCardId] = useState("");
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
  const [accentPickerOpen, setAccentPickerOpen] = useState(false);
  const [accentDraft, setAccentDraft] = useState<string | null>(null);
  const accentDraftRef = useRef<string | null>(null);
  const customAccentButton = useRef<HTMLButtonElement>(null);
  const [activeTrashFileId, setActiveTrashFileId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<PortiaEmployee[]>([]);
  const [employeesReady, setEmployeesReady] = useState(false);
  const [employeesSyncedAt, setEmployeesSyncedAt] = useState<string | null>(null);
  // STAB-APP-02: why the last roster poll failed and when a complete roster last arrived; the roster itself stays untouched by a failure.
  const [employeesSync, setEmployeesSync] = useState<ContentSync>({ lastGoodAt: null, failure: null, retrying: false });
  const employeesLastGoodRef = useRef<string | null>(null);
  const employeesRetryBusy = useRef(false);
  const [employeesProfilesRead, setEmployeesProfilesRead] = useState(true);
  const employeesRef = useRef<PortiaEmployee[]>([]);
  const profilesReadRef = useRef(true);
  const employeeEdits = useRef(0);
  // fetchEmployees has no deps and reads the last good list through these.
  useEffect(() => {
    employeesRef.current = employees;
    profilesReadRef.current = employeesProfilesRead;
  });
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
  // The quest popup shows once per quest id (D-03): ids live in localStorage and in this ref, so a failed write cannot bring it back in this tab.
  const seenQuestIds = useRef<string[]>([]);
  const questReadBlocked = useRef(false);
  const [questToastItem, setQuestToastItem] = useState<{ quest: Broadcast; more: number } | null>(null);
  const [promotionRetakeToast, setPromotionRetakeToast] = useState<RetakeNotification | null>(null);
  const assistantTipTimer = useRef<number | null>(null);
  const assistantClickResetTimer = useRef<number | null>(null);
  const assistantCooldownTimer = useRef<number | null>(null);
  const assistantRecoverTimer = useRef<number | null>(null);
  const assistantAutomaticTimer = useRef<number | null>(null);
  const settingsSavedTimer = useRef<number | null>(null);
  const customTokens = useMemo(() => deriveAccentTokens(accentDraft ?? desktopSettings.customAccent), [accentDraft, desktopSettings.customAccent]);
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

  // Served from the CDN cache (s-maxage 300, purged only by deployed saves, never from next dev), so it can be older than this tab's copy; such answers are dropped (uat-03-owner-broadcast-vanishes).
  const fetchContent = useCallback(async () => {
    const savesAtSend = savesStarted.current;
    const requestSeq = ++contentRequestSeq.current;
    // Any answer that is not an authoritative copy of the content is a failure for the stale banner (D-05); a good one, even an unchanged revision, is a success.
    let failure: AppFailure | null = null;
    let responded = false;
    try {
      const response = await fetchWithTimeout("/api/content");
      responded = true;
      if (!response.ok) { failure = failureFromResponse(response.status, false); return; }
      const payload = (await response.json()) as ContentResponse;
      if (!payload.content) { failure = "unexpected"; return; }
      const fetchedRevision = payload.revision ?? 0;
      // The revision is checked first so an unchanged poll does no work and never hands the editor a new object (SYNC-01).
      if (!acceptFetchedContent(fetchedRevision, knownRevision.current, savesAtSend, savesStarted.current)) return;
      const fetched = normalizePortiaContent(payload.content);
      if (!fetched) { failure = "unexpected"; return; }
      knownRevision.current = fetchedRevision;
      setContent(fetched);
      setActiveVirusId((current) => fetched.viruses.some((virus) => virus.id === current) ? current : fetched.viruses[0]?.id ?? "");
      setSelectedInfoId((current) => findInfo(fetched.infoSections, current) ? current : fetched.infoSections[0]?.id ?? "");
      setGuideCardId((current) => findGuide(fetched.guideSections, current)?.card ? current : "");
      setRevision(fetchedRevision);
      try {
        window.localStorage.setItem(contentCacheStorageKey, JSON.stringify({
          content: fetched,
          revision: fetchedRevision,
          updatedAt: payload.updatedAt ?? null,
          savedAt: new Date().toISOString(),
        }));
      } catch {}
    } catch (error) {
      // The last copy saved on this device keeps the terminal usable while offline; the banner only says so.
      failure = !responded ? failureFromResponse(null, error instanceof DOMException && error.name === "AbortError") : "unexpected";
    } finally {
      if (failure === null) {
        const at = new Date().toISOString();
        lastGoodRef.current = at;
        setContentSync((sync) => contentSyncSucceeded(sync, at));
      } else if (requestSeq === contentRequestSeq.current) {
        const reason = failure;
        setContentSync((sync) => contentSyncFailed(sync, reason, lastGoodRef.current));
      }
      // Even a failed answer ends the wait: what is on screen then is all there is.
      setContentReady(true);
    }
  }, []);

  // Never clears what is shown: a failed retry leaves the data and the banner time as they were.
  const retryContent = useCallback(async () => {
    if (retryBusy.current) return;
    retryBusy.current = true;
    setContentSync((sync) => ({ ...sync, retrying: true }));
    try {
      await fetchContent();
    } finally {
      retryBusy.current = false;
      setContentSync((sync) => ({ ...sync, retrying: false }));
    }
  }, [fetchContent]);

  const fetchAccess = useCallback(async () => {
    try {
      const response = await fetchWithTimeout("/api/access", { cache: "no-store" });
      if (!response.ok) return;
      const access = await response.json() as { canEdit?: boolean; canManageEditors?: boolean; openTabs?: unknown };
      setCanEdit(Boolean(access.canEdit));
      setCanManageEditors(Boolean(access.canManageEditors));
      const ids = Array.isArray(access.openTabs) ? access.openTabs.filter((id): id is string => typeof id === "string") : [];
      // Same ids keep the same array, so the editor's effects do not re-run on every poll.
      setOpenTabs((current) => current.length === ids.length && current.every((id, index) => id === ids[index]) ? current : ids);
    } catch {}
  }, []);

  // Keeps the Personnel window in step with the editor without waiting for the next sync.
  const updateEmployee = useCallback((saved: PortiaEmployee) => {
    employeeEdits.current += 1;
    setEmployees((current) => withEmployee(current, saved));
    patchEmployeesCache((cached) => withEmployee(cached, saved));
  }, []);

  // A removed manual employee leaves the Personnel window and the cached roster at once.
  const removeEmployee = useCallback((id: string) => {
    employeeEdits.current += 1;
    setEmployees((current) => current.filter((employee) => employee.id !== id));
    patchEmployeesCache((cached) => cached.filter((employee) => employee.id !== id));
  }, []);

  const fetchEmployees = useCallback(async () => {
    const editsAtStart = employeeEdits.current;
    let failure: AppFailure | null = null;
    let responded = false;
    let skipped = false;
    // A degraded answer is still shown, so its snapshot time stands in when no complete roster ever arrived.
    let shownAt: string | null = null;
    try {
      const response = await fetchWithTimeout("/api/employees", {}, 15_000);
      responded = true;
      if (!response.ok) { failure = failureFromResponse(response.status, false); return; }
      const payload = await response.json() as { employees?: PortiaEmployee[]; syncedAt?: string | null; degraded?: boolean; profilesRead?: boolean; manualRead?: boolean };
      if (!acceptsRoster(payload)) { failure = "unavailable"; return; }
      // An editor save or delete on this device is newer than this answer; the next poll brings the server copy.
      if (employeeEdits.current !== editsAtStart) { skipped = true; return; }
      const merged = mergeEmployeesAnswer(employeesRef.current, payload, profilesReadRef.current);
      setEmployees(merged.employees);
      setEmployeesProfilesRead(merged.profilesRead);
      setEmployeesSyncedAt(payload.syncedAt ?? null);
      setSelectedEmployeeId((current) => merged.employees.some((employee) => employee.id === current) ? current : merged.employees[0]?.id ?? "");
      // A degraded answer never replaces the device cache (D-07).
      if (merged.cacheable) try { window.localStorage.setItem(employeesCacheStorageKey, JSON.stringify(payload)); } catch {}
      if (payload.degraded !== false) { failure = "unavailable"; shownAt = payload.syncedAt ?? new Date().toISOString(); }
    } catch (error) {
      // The last successful personnel snapshot remains visible on this device.
      failure = !responded ? failureFromResponse(null, error instanceof DOMException && error.name === "AbortError") : "unexpected";
    } finally {
      if (failure !== null) {
        const reason = failure;
        const at = employeesLastGoodRef.current ?? shownAt;
        setEmployeesSync((sync) => contentSyncFailed(sync, reason, at));
      } else if (!skipped) {
        const at = new Date().toISOString();
        employeesLastGoodRef.current = at;
        setEmployeesSync((sync) => contentSyncSucceeded(sync, at));
      }
      setEmployeesReady(true);
    }
  }, []);

  // Same contract as retryContent: a second click while running does nothing, a failed retry keeps the roster and the banner time.
  const retryEmployees = useCallback(async () => {
    if (employeesRetryBusy.current) return;
    employeesRetryBusy.current = true;
    setEmployeesSync((sync) => ({ ...sync, retrying: true }));
    try {
      await fetchEmployees();
    } finally {
      employeesRetryBusy.current = false;
      setEmployeesSync((sync) => ({ ...sync, retrying: false }));
    }
  }, [fetchEmployees]);

  useEffect(() => {
    const cacheTimer = window.setTimeout(() => {
      try {
        const cached = window.localStorage.getItem(contentCacheStorageKey);
        if (cached) {
          const parsed = JSON.parse(cached) as { content?: unknown; revision?: number };
          // The cache is device-editable and may predate any field, so it gets the same normalizer as the network (D-20, D-22).
          const cachedContent = normalizePortiaContent(parsed.content);
          if (cachedContent) {
            setContent(cachedContent);
            const cachedRevision = typeof parsed.revision === "number" ? parsed.revision : 0;
            knownRevision.current = cachedRevision;
            setRevision(cachedRevision);
            setActiveVirusId((current) => cachedContent.viruses.some((virus) => virus.id === current) ? current : cachedContent.viruses[0]?.id ?? "");
            setSelectedInfoId((current) => findInfo(cachedContent.infoSections, current) ? current : cachedContent.infoSections[0]?.id ?? "");
            setGuideCardId((current) => findGuide(cachedContent.guideSections, current)?.card ? current : "");
            const savedAt = (parsed as { savedAt?: unknown }).savedAt;
            // A savedAt that does not parse is ignored (T-19-01): no time is better than "Invalid Date".
            if (!lastGoodRef.current && typeof savedAt === "string" && !Number.isNaN(new Date(savedAt).getTime())) lastGoodRef.current = savedAt;
            // Cached data counts as loaded for appViewState even when its time is unknown ("").
            setContentSync((sync) => sync.lastGoodAt !== null ? sync : { ...sync, lastGoodAt: lastGoodRef.current ?? "" });
            setContentReady(true);
          }
        }
        const employeeCache = window.localStorage.getItem(employeesCacheStorageKey);
        if (employeeCache) {
          const parsed = JSON.parse(employeeCache) as { employees?: PortiaEmployee[]; syncedAt?: string | null; profilesRead?: boolean };
          if (Array.isArray(parsed.employees)) {
            setEmployees(parsed.employees);
            // An old cache without the flag counts as read; only an explicit false means nothing was read.
            setEmployeesProfilesRead(parsed.profilesRead !== false);
            setEmployeesSyncedAt(parsed.syncedAt ?? null);
            setSelectedEmployeeId((current) => current || parsed.employees![0]?.id || "");
            // Cached roster counts as loaded; "" = its time is unknown.
            const cachedAt = typeof parsed.syncedAt === "string" && !Number.isNaN(new Date(parsed.syncedAt).getTime()) ? parsed.syncedAt : null;
            if (!employeesLastGoodRef.current) employeesLastGoodRef.current = cachedAt;
            setEmployeesSync((sync) => sync.lastGoodAt !== null ? sync : { ...sync, lastGoodAt: cachedAt ?? "" });
            setEmployeesReady(true);
          }
        }
      } catch {}
    }, 0);
    // A repeat load in this tab session skips the boot; only a boot that played to its end is recorded (D-06).
    // Reduced and off have no boot at all (D-12); a repeat in the same tab is skipped (D-13).
    const bootSeen = document.documentElement.dataset.boot === "seen";
    const bootSkipped = bootSeen || document.documentElement.dataset.motion !== "full";
    const bootTimer = window.setTimeout(() => {
      setBooting(false);
      if (!bootSkipped) try { window.sessionStorage.setItem(bootSeenStorageKey, "1"); } catch {}
    }, bootSkipped ? 0 : 1650);
    const tick = () => {
      const now = new Date();
      setClock(new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(now));
      setToday(localDateKey(now));
    };
    tick();
    const clockTimer = window.setInterval(tick, 1000);
    const initialFetchTimer = window.setTimeout(() => { void fetchContent(); void fetchAccess(); }, 0);
    const initialEmployeesTimer = window.setTimeout(() => void fetchEmployees(), 0);
    // /api/content is CDN-shared and cannot carry per-user data, so the tab list is polled separately and only for someone who may edit.
    const syncTimer = window.setInterval(() => { if (document.visibilityState === "visible") { void fetchContent(); if (canEditRef.current) void fetchAccess(); } }, contentSyncMs);
    const onVisible = () => { if (document.visibilityState === "visible") { void fetchContent(); if (canEditRef.current) void fetchAccess(); } };
    document.addEventListener("visibilitychange", onVisible);
    // Cheap: answered by the CDN, so other visitors see profile edits within minutes.
    const employeeSyncTimer = window.setInterval(fetchEmployees, 5 * 60 * 1000);
    return () => {
      window.clearTimeout(cacheTimer);
      window.clearTimeout(bootTimer);
      window.clearTimeout(initialFetchTimer);
      window.clearTimeout(initialEmployeesTimer);
      window.clearInterval(clockTimer);
      window.clearInterval(syncTimer);
      document.removeEventListener("visibilitychange", onVisible);
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

  // Writes markQuestsSeen(list, storage ∪ this tab's ids, today), so storage is never overwritten with fewer ids; a failed write still keeps the ref.
  const rememberActiveQuests = useCallback(() => {
    let stored: string[] | null = null;
    try { stored = parseSeenQuestIds(window.localStorage.getItem(questSeenStorageKey)); } catch {}
    seenQuestIds.current = markQuestsSeen(content.broadcasts, [...new Set([...(stored ?? []), ...seenQuestIds.current])], today);
    if (stored) try { window.localStorage.setItem(questSeenStorageKey, JSON.stringify(seenQuestIds.current)); } catch {}
  }, [content.broadcasts, today]);

  // Reading the active quests in «Сводка» counts as seeing them; declared before the toast effect so a live update the visitor is already reading never pops up.
  const questsViewed = contentReady && windows.broadcasts.open && !windows.broadcasts.minimized && broadcastTab === "quests";
  useEffect(() => {
    if (questsViewed && today) rememberActiveQuests();
  }, [questsViewed, today, rememberActiveQuests]);

  // Recomputed on every content change (editor save, sync, cache) so a quest published while the toast is open is counted in it, and the dismissal that marks all active quests seen never hides one the toast did not show (review IN-03).
  useEffect(() => {
    if (!contentReady || booting || !today || questReadBlocked.current) return;
    let stored: string[];
    try { stored = parseSeenQuestIds(window.localStorage.getItem(questSeenStorageKey)); }
    catch {
      // shortcut: unreadable storage means no popup at all (never on every load); upgrade if visitors ask for it
      questReadBlocked.current = true;
      return;
    }
    const next = questPopup(content.broadcasts, [...new Set([...stored, ...seenQuestIds.current])], today);
    const timer = window.setTimeout(() => setQuestToastItem(next), 0);
    return () => window.clearTimeout(timer);
  }, [content.broadcasts, contentReady, booting, today]);

  useEffect(() => {
    // Stored settings are visitor-editable: keep only known values, field by field.
    const restored: Partial<DesktopSettings> = {};
    try {
      const saved: unknown = JSON.parse(window.localStorage.getItem(desktopSettingsStorageKey) ?? "{}");
      if (saved && typeof saved === "object" && !Array.isArray(saved)) {
        for (const key of Object.keys(settingValues) as (keyof typeof settingValues)[]) {
          const value = (saved as Record<string, unknown>)[key];
          if (typeof value === "string" && settingValues[key].includes(value)) restored[key] = value;
        }
        const custom = (saved as Record<string, unknown>).customAccent;
        if (typeof custom === "string" && deriveAccentTokens(custom)) restored.customAccent = custom.toLowerCase();
        // «custom» without a valid colour is untrusted input: fall back to the default accent (D-11).
        if (restored.accent === "custom" && !restored.customAccent) delete restored.accent;
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
      const allowed = new Set<DesktopShortcutId>(["search", "archive", "employees", "broadcasts", "info", "guide", "promotion", "settings", "charter", "sheet", "trash"]);
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
    const root = document.documentElement;
    const accent = accentDraft ? "custom" : desktopSettings.accent;
    root.dataset.accent = accent;
    for (const name of accentTokenNames) {
      if (accent === "custom" && customTokens) root.style.setProperty(name, customTokens[name]);
      else root.style.removeProperty(name);
    }
    root.dataset.wallpaper = desktopSettings.wallpaper;
    root.dataset.iconSize = desktopSettings.iconSize;
    root.dataset.spider = desktopSettings.spider === "off" ? "off" : "on";
  }, [desktopSettings, desktopSettingsLoaded, accentDraft, customTokens]);

  // Drafts recolour live but only committed values persist (D-08).
  useEffect(() => {
    if (!desktopSettingsLoaded) return;
    try { window.localStorage.setItem(desktopSettingsStorageKey, JSON.stringify(desktopSettings)); } catch {}
  }, [desktopSettings, desktopSettingsLoaded]);

  // Same rule as the head script: full unless the visitor chose reduced or off.
  useEffect(() => {
    if (!desktopSettingsLoaded) return;
    document.documentElement.dataset.motion = desktopSettings.motion === "off" ? "off" : desktopSettings.motion === "reduced" ? "reduced" : "full";
  }, [desktopSettings, desktopSettingsLoaded]);

  const showSettingsSaved = useCallback(() => {
    setSettingsSavedVisible(true);
    if (settingsSavedTimer.current) window.clearTimeout(settingsSavedTimer.current);
    settingsSavedTimer.current = window.setTimeout(() => setSettingsSavedVisible(false), 2400);
  }, []);

  const updateDesktopSettings = (patch: Partial<DesktopSettings>) => {
    if ((Object.keys(patch) as (keyof DesktopSettings)[]).every((key) => desktopSettings[key] === patch[key])) return;
    setDesktopSettings((current) => ({ ...current, ...patch }));
    showSettingsSaved();
  };

  const updateDesktopSetting = (key: keyof DesktopSettings, value: string) => updateDesktopSettings({ [key]: value });

  const previewAccent = (hex: string) => {
    accentDraftRef.current = hex;
    setAccentDraft(hex);
  };

  const commitAccentDraft = useCallback(() => {
    const draft = accentDraftRef.current;
    if (!draft) return;
    accentDraftRef.current = null;
    setAccentDraft(null);
    setDesktopSettings((current) => ({ ...current, accent: "custom", customAccent: draft.toLowerCase() }));
    showSettingsSaved();
  }, [showSettingsSaved]);

  const closeAccentPicker = () => {
    commitAccentDraft();
    setAccentPickerOpen(false);
  };

  const chooseCustomAccent = () => {
    if (accentPickerOpen) { closeAccentPicker(); return; }
    const seed = desktopSettings.customAccent || getComputedStyle(document.documentElement).getPropertyValue("--teal").trim().toLowerCase();
    if (!deriveAccentTokens(seed)) return;
    updateDesktopSettings({ accent: "custom", customAccent: seed });
    setAccentPickerOpen(true);
  };

  // A drag can end anywhere, including outside the picker: save when the pointer is released (D-08).
  useEffect(() => {
    if (!accentPickerOpen) return;
    window.addEventListener("pointerup", commitAccentDraft);
    window.addEventListener("pointercancel", commitAccentDraft);
    return () => {
      window.removeEventListener("pointerup", commitAccentDraft);
      window.removeEventListener("pointercancel", commitAccentDraft);
    };
  }, [accentPickerOpen, commitAccentDraft]);

  const resetDesktopSettings = () => {
    const alreadyDefault = Object.entries(defaultDesktopSettings).every(([key, value]) => desktopSettings[key as keyof DesktopSettings] === value);
    const shortcutsAlreadyDefault = Object.keys(shortcutPositions).length === 0;
    if (alreadyDefault && shortcutsAlreadyDefault) return;
    accentDraftRef.current = null;
    setAccentDraft(null);
    setAccentPickerOpen(false);
    setDesktopSettings(defaultDesktopSettings);
    setShortcutPositions({});
    showSettingsSaved();
  };

  const moveDesktopShortcut = (shortcutId: DesktopShortcutId, position: ShortcutPosition) => {
    setShortcutPositions((current) => ({ ...current, [shortcutId]: position }));
  };

  const focusApp = (appId: AppId) => {
    if (qualificationLocked && appId !== "promotion") return;
    // Every click in a window calls this, so a window already on top keeps its z and z stays far below the format panel's 950 (EDIT-04).
    // shortcut: windows still climb by one per switch between windows; after about 930 switches in one page session they pass the panel — renumber z here if that is ever seen
    if (windows[appId].z !== topZ.current) {
      topZ.current += 1;
      const next = topZ.current;
      setWindows((state) => ({ ...state, [appId]: { ...state[appId], z: next } }));
    }
    setActiveApp(appId);
  };

  const updateQualificationLock = useCallback((locked: boolean) => {
    if (qualificationLockedRef.current === locked) return;
    qualificationLockedRef.current = locked;
    setQualificationLocked(locked);
    if (!locked) return;
    topZ.current += 1;
    const z = topZ.current;
    setStartOpen(false);
    setWindows((state) => ({
      ...state,
      promotion: { ...state.promotion, open: true, minimized: false, exiting: undefined, z },
    }));
    setActiveApp("promotion");
  }, []);

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
    if (qualificationLocked && appId !== "promotion") return;
    if (windowAppears(windows[appId])) bounceTaskbarEntry(appId);
    else if (!qualificationLocked) nodWindow(appId);
    // Re-opening a window while it closes or minimises cancels the exit and keeps it.
    const pendingExit = exitTimers.current[appId];
    if (pendingExit) {
      window.clearTimeout(pendingExit);
      delete exitTimers.current[appId];
    }
    setWindows((state) => {
      const openCount = visibleWindowCount(state);
      return { ...state, [appId]: openedWindow(state[appId], origin, workspaceBounds(), minimumWindowSize(appId), () => createWindowGeometry(appId, openCount)) };
    });
    focusApp(appId);
    setStartOpen(false);
    if (appId === "broadcasts") {
      const signature = broadcastSignature(content);
      try { window.localStorage.setItem(broadcastReadStorageKey, signature); } catch {}
      setBroadcastUnread(false);
    }
  };

  const dismissQuestToast = (openQuests: boolean) => {
    rememberActiveQuests();
    setQuestToastItem(null);
    if (openQuests) {
      setBroadcastTab("quests");
      openApp("broadcasts");
    }
  };

  const dismissPromotionRetakeToast = (openPromotion: boolean) => {
    setPromotionRetakeToast(null);
    if (openPromotion) openApp("promotion");
  };

  // Functional update only: a late timer must never act on a stale render's windows.
  const finishExit = (appId: AppId, kind: "close" | "minimize") => {
    setWindows((state) => ({ ...state, [appId]: exitedWindow(state[appId], kind) }));
  };

  // `force` is the editor's own dialog approving the close; minimize is never guarded (the window stays mounted).
  const requestExit = (appId: AppId, kind: "close" | "minimize", force = false) => {
    if (qualificationLocked && appId === "promotion") return;
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
    // «Уменьшены» keeps a short fade so the window visibly leaves; «Выключены» removes it at once (the timer keeps one exit path).
    const motion = document.documentElement.dataset.motion;
    const duration = motion === "off" ? 0 : motion === "reduced" ? WINDOW_FADE_OUT_MS : kind === "close" ? WINDOW_CLOSE_MS : WINDOW_MINIMIZE_MS;
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
    if (qualificationLocked && appId === "promotion") return;
    setWindows((state) => ({ ...state, [appId]: { ...state[appId], maximized: !state[appId].maximized } }));
    focusApp(appId);
  };

  const updateWindowGeometry = (appId: AppId, geometry: WindowGeometry) => {
    setWindows((state) => ({ ...state, [appId]: { ...state[appId], geometry } }));
  };

  const saveContent = async (next: PortiaContent, baseRevision: number) => {
    // An earlier «СОХРАНЕНО» timer must not flip a newer request back to idle mid-save.
    if (saveStateTimer.current !== null) window.clearTimeout(saveStateTimer.current);
    // Polls sent before this save may answer with the copy it replaces.
    savesStarted.current += 1;
    setSaveError("");
    setSaveState("saving");
    try {
      // Up to MAX_CONTENT_BODY_BYTES (5 MB, lib/content-limits.ts) plus auth, upsert and CDN purge: aborting after the server committed would turn the retry into a false conflict.
      const response = await fetchWithTimeout("/api/content", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: next, revision: baseRevision }),
      }, 30_000);
      if (response.status === 409) {
        // The server is authoritative after a conflict: a cached revision ahead of it (row reset, fresh project) would otherwise drop every poll for good.
        knownRevision.current = -1;
        setSaveState("conflict");
        throw new Error("PORTIA content changed by another editor");
      }
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: unknown } | null;
        if (typeof body?.error === "string") setSaveError(body.error);
        // A refusal usually means the tab list changed: read it now instead of at the next poll (D-15).
        if (response.status === 403) void fetchAccess();
        throw new Error("save failed");
      }
      const payload = (await response.json()) as { revision?: number };
      const savedRevision = payload.revision ?? baseRevision + 1;
      knownRevision.current = savedRevision;
      setContent(next);
      setGuideCardId((current) => findGuide(next.guideSections, current)?.card ? current : "");
      setRevision(savedRevision);
      try {
        window.localStorage.setItem(contentCacheStorageKey, JSON.stringify({
          content: next,
          revision: savedRevision,
          updatedAt: new Date().toISOString(),
          savedAt: new Date().toISOString(),
        }));
      } catch {}
      setSaveState("saved");
      saveStateTimer.current = window.setTimeout(() => setSaveState("idle"), 1800);
      return savedRevision;
    } catch (error) {
      setSaveState((current) => current === "conflict" ? current : "error");
      throw error;
    }
  };

  const activeVirus = content.viruses.find((virus) => virus.id === activeVirusId) ?? content.viruses[0];
  const filteredViruses = content.viruses.filter((virus) => escapeSearch(`${virus.name} ${virus.code} ${virus.status}`).includes(escapeSearch(virusQuery)));
  const virusListbox = contentReady && filteredViruses.length > 0;
  // D-05: the dossier area shows the stale strip only while last-good records are on screen; the other apps join in 19-08.
  // One appViewState rule for every app (D-05..D-08); the window bodies below only choose what to draw.
  const contentBase = { denied: false, ready: contentReady, hasData: contentSync.lastGoodAt !== null, failure: contentSync.failure };
  const archiveView = appViewState({ ...contentBase, count: content.viruses.length });
  const infoView = appViewState({ ...contentBase, count: content.infoSections.length });
  const guideView = appViewState({ ...contentBase, count: content.guideSections.length });
  const broadcastsView = appViewState({ ...contentBase, count: content.broadcasts.length });
  const trashView = appViewState({ ...contentBase, count: content.recycleFiles.length + (content.recycledViruses?.length ?? 0) });
  const employeesView = appViewState({ denied: false, ready: employeesReady, hasData: employeesSync.lastGoodAt !== null, count: employees.length, failure: employeesSync.failure });
  const contentStaleBanner = contentSync.lastGoodAt !== null ? <AppStaleBanner lastGoodAt={contentSync.lastGoodAt} retrying={contentSync.retrying} onRetry={() => void retryContent()} /> : null;
  const contentFatal = (illustration: "dish" | "microscope" | "flask") => contentSync.failure ? <AppFatalPanel failure={contentSync.failure} retrying={contentSync.retrying} onRetry={() => void retryContent()} illustration={illustration} /> : null;
  const selectedInfoEntry = findInfo(content.infoSections, selectedInfoId)
    ?? (content.infoSections[0] ? { section: content.infoSections[0], subsection: null } : null);
  const selectedInfo = selectedInfoEntry?.section;
  const selectedSubsection = selectedInfoEntry?.subsection ?? null;
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
    if (nextTipIndex < 0) {
      // No usable tip: no bubble, no placeholder text (D-12).
      setAssistantTipIndex(-1);
      setAssistantTipVisible(false);
      return;
    }
    setAssistantTipIndex(nextTipIndex);
    setAssistantTipVisible(true);
    if (assistantTipTimer.current) window.clearTimeout(assistantTipTimer.current);
    assistantTipTimer.current = window.setTimeout(() => setAssistantTipVisible(false), 5200);
  };

  const searchResults = useMemo(() => {
    const query = escapeSearch(globalQuery.trim());
    const items: Array<{ id: string; type: "virus" | "employee" | "info" | "guide" | "broadcast" | "file" | "app"; title: string; meta: string; body: string; parts?: string[] }> = [
      ...globalSearchAppIds.map((id) => ({ id, type: "app" as const, title: appMeta[id].label, meta: "ПРИЛОЖЕНИЕ", body: `${appMeta[id].path} ${id}` })),
      ...content.viruses.map((virus) => ({ id: virus.id, type: "virus" as const, title: virus.name, meta: virus.code, body: `${virus.status} ${virus.external} ${virus.physiology} ${Object.values(virus.classification).join(" ")} ${virus.mutations.map((mutation) => `${mutation.name} ${mutation.description}`).join(" ")}` })),
      ...employees.map((employee) => ({ id: employee.id, type: "employee" as const, title: employee.nickname, meta: "СОТРУДНИКИ", body: `${employee.callsign} ${employee.title} ${employee.rank} ${employee.biography}` })),
      ...content.infoSections.flatMap((section) => [
        { id: section.id, type: "info" as const, title: section.title, meta: "ИНФОРМАЦИЯ", body: section.body },
        ...section.subsections.map((sub) => ({
          id: sub.id,
          type: "info" as const,
          title: sub.title,
          meta: `ИНФОРМАЦИЯ · ${section.title}`,
          body: sub.blocks.map((block) => block.type === "text" ? block.text : block.type === "table" ? block.rows.map((row) => `${row.key} ${row.value}`).join(" ") : "").join(" "),
        })),
      ]),
      // D-15: a card is found by its title, any block text and its section title; the section title sits in meta, so a section match lists every card of it.
      ...content.guideSections.flatMap((section) => section.cards.map((card) => {
        const parts = card.blocks.map((block) => block.type === "heading" || block.type === "text" ? block.text : block.type === "table" ? block.rows.map((row) => `${row.key} ${row.value}`).join(" ") : block.type === "photo" ? block.caption : block.type === "callout" ? `${block.label} ${block.text}` : "").filter(Boolean);
        return { id: card.id, type: "guide" as const, title: card.title || "Без названия", meta: `СПРАВОЧНИК · ${section.title || "Без названия"}`, body: parts.join(" "), parts };
      })),
      ...content.broadcasts.filter((item) => item.published).map((item) => ({ id: item.id, type: "broadcast" as const, title: item.title, meta: broadcastType(item.type), body: item.body })),
      ...content.recycleFiles.map((file) => ({ id: file.id, type: "file" as const, title: file.name, meta: recycleFileType(file.kind), body: recycleFileBody(file, [...content.viruses, ...recycledViruses]) })),
      ...recycledViruses.map((virus) => ({ id: `virus:${virus.id}`, type: "file" as const, title: virus.name, meta: "ВИРУС В КОРЗИНЕ", body: `${virus.code} ${virus.status} ${virus.external} ${virus.physiology}` })),
    ];
    if (!query) return items.slice(0, 8);
    // The 2-line preview of a card starts at the first block that holds the query; matching itself is unchanged.
    return items.filter((item) => escapeSearch(`${item.title} ${item.meta} ${item.body}`).includes(query)).map((item) => {
      const at = item.parts ? item.parts.findIndex((part) => escapeSearch(part).includes(query)) : -1;
      return at > 0 && item.parts ? { ...item, body: [...item.parts.slice(at), ...item.parts.slice(0, at)].join(" ") } : item;
    });
  }, [content, employees, globalQuery, recycledViruses]);

  const openSearchResult = (result: (typeof searchResults)[number]) => {
    if (result.type === "virus") {
      setActiveVirusId(result.id);
      setOpenLog(null);
      openApp("archive");
    } else if (result.type === "employee") {
      setSelectedEmployeeId(result.id);
      openApp("employees");
    } else if (result.type === "info") {
      setSelectedInfoId(result.id);
      openApp("info");
    } else if (result.type === "guide") {
      setGuideCardId(result.id);
      openApp("guide");
    } else if (result.type === "broadcast") {
      const found = content.broadcasts.find((item) => item.id === result.id);
      if (found) setBroadcastTab(broadcastTabOf(found.type));
      openApp("broadcasts");
    } else if (result.type === "app") {
      openApp(result.id as AppId);
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
          : undefined;
  // Derived, not stored: a tip removed by the 10 s content poll closes the bubble on the next render (D-13).
  const assistantSpeaking = assistantTipVisible && typeof assistantMessageText === "string" && assistantMessageText.trim() !== "";
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
      {questToastItem && <QuestToast quest={questToastItem.quest} more={questToastItem.more} document={content.formattedText[portiaTextKey.broadcast(questToastItem.quest.id)]} onDismiss={dismissQuestToast} />}
      {promotionRetakeToast && <PromotionRetakeToast onDismiss={dismissPromotionRetakeToast} />}
      <div className={`desktop${qualificationLocked ? " is-qualification-locked" : ""}`} id="desktop">
        {desktopSettingsLoaded && <DesktopWallpaper kind={desktopSettings.wallpaper} />}
        <header className="system-bar">
          <div className="system-brand"><img className="portia-mark" src="/assets/portia-logo.png" alt="" /><span>PORTIA</span><span className="system-division">PORTIA OS</span></div>
          <div className="system-status" aria-label="Состояние системы"><span className="status-item"><i className="status-dot" />В СЕТИ</span><time>{clock}</time></div>
        </header>

        <main className={`workspace${windows[activeApp].open && !windows[activeApp].minimized ? " mobile-app-open" : ""}`}>
          <nav className="desktop-icons" aria-label="Рабочий стол PORTIA" style={desktopSettingsLoaded && shortcutPositionsLoaded ? undefined : { visibility: "hidden" }}>
            <DesktopIcon app="search" onOpen={openApp} position={shortcutPositions.search} onMove={moveDesktopShortcut} />
            <DesktopIcon app="archive" onOpen={openApp} position={shortcutPositions.archive} onMove={moveDesktopShortcut} />
            <DesktopIcon app="employees" onOpen={openApp} position={shortcutPositions.employees} onMove={moveDesktopShortcut} />
            <DesktopIcon app="broadcasts" onOpen={openApp} position={shortcutPositions.broadcasts} onMove={moveDesktopShortcut} badge={broadcastUnread} />
            <DesktopIcon app="info" onOpen={openApp} position={shortcutPositions.info} onMove={moveDesktopShortcut} />
            <DesktopIcon app="guide" onOpen={openApp} position={shortcutPositions.guide} onMove={moveDesktopShortcut} />
            <DesktopIcon app="promotion" onOpen={openApp} position={shortcutPositions.promotion} onMove={moveDesktopShortcut} />
            <DesktopIcon app="settings" onOpen={openApp} position={shortcutPositions.settings} onMove={moveDesktopShortcut} />
            <DesktopIcon app="charter" onOpen={openApp} position={shortcutPositions.charter} onMove={moveDesktopShortcut} />
            <DesktopIcon app="sheet" onOpen={openApp} position={shortcutPositions.sheet} onMove={moveDesktopShortcut} />
            <DesktopIcon app="trash" onOpen={openApp} position={shortcutPositions.trash} onMove={moveDesktopShortcut} className="desktop-icon-trash" />
          </nav>

          {qualificationLocked && <div className="qualification-focus-backdrop" aria-hidden="true"><span>ИДЁТ КВАЛИФИКАЦИОННАЯ ПРОВЕРКА</span></div>}

          <AppWindow app="archive" state={windows.archive} active={activeApp === "archive"} onFocus={focusApp} onMinimize={minimizeApp} onMaximize={toggleMaximize} onClose={closeApp} onGeometry={updateWindowGeometry} className="archive-window" meta="ДОПУСК II">
            <div className="archive-grid">
              <aside className="archive-browser" aria-label="Список вирусов">
                <div className="browser-heading"><div><h1>База вирусов</h1></div><span className="record-count">{String(content.viruses.length).padStart(2, "0")}</span></div>
                <label className="search-box"><span aria-hidden="true">⌕</span><span className="sr-only">Поиск по базе</span><input value={virusQuery} onChange={(event) => setVirusQuery(event.target.value)} type="search" placeholder="Поиск по имени или коду" /></label>
                <div className="browser-labels" aria-hidden="true"><span>СУБЪЕКТ</span><span>СТАТУС</span></div>
                {/* Loading and the empty message are not options, so the container is a listbox only while it holds rows; no wrapper, the phone layout is a flex row. */}
                <div className="virus-list" role={virusListbox ? "listbox" : undefined} aria-label={virusListbox ? "Записи вирусов" : undefined}>
                  {archiveView === "loading" ? <AppSkeleton shape="archive" /> : <>
                  {filteredViruses.map((virus, index) => (
                    <button key={virus.id} type="button" role="option" aria-selected={virus.id === activeVirus?.id} className={`virus-row${virus.id === activeVirus?.id ? " active" : ""}`} onClick={() => { setActiveVirusId(virus.id); setOpenLog(null); }}>
                      <span className="row-index">{String(index + 1).padStart(2, "0")}</span>
                      <span className="row-main"><strong>{virus.name}</strong><small>{virus.code}</small><RowBadges virus={virus} /></span>
                      <span className="row-status">{virus.status}</span>
                    </button>
                  ))}
                  {!filteredViruses.length && content.viruses.length > 0 && <div className="list-empty">Совпадений в архиве нет</div>}
                  </>}
                </div>
                <div className="browser-footer"><span><i className="status-dot" />СИНХРОНИЗИРОВАНО</span><span>РЕВИЗИЯ {String(revision).padStart(2, "0")}</span></div>
              </aside>
              <article className="record-view" aria-live="polite">
                {archiveView === "stale" && contentStaleBanner}
                {archiveView === "loading" ? <AppSkeleton shape="document" /> : archiveView === "fatal" ? contentFatal("microscope") : archiveView === "empty" || !activeVirus ? <div className="record-empty empty-state"><PortiaIllustration name="microscope" /><strong>{emptyCopy.archive.heading}</strong><span>{emptyCopy.archive.body}</span></div> : openLog ? <ScientistDocument key={openLog} virus={activeVirus} logId={openLog} onBack={() => setOpenLog(null)} /> : <VirusRecord virus={activeVirus} formattedText={content.formattedText} onOpenLog={setOpenLog} />}
              </article>
            </div>
          </AppWindow>

          <AppWindow app="employees" state={windows.employees} active={activeApp === "employees"} onFocus={focusApp} onMinimize={minimizeApp} onMaximize={toggleMaximize} onClose={closeApp} onGeometry={updateWindowGeometry} className="utility-window personnel-window" meta={`${employees.length} ПРОФИЛЕЙ`}>
            <div className="personnel-app">
              <aside className="personnel-index">
                <header><h1>Сотрудники</h1></header>
                <label className="search-box"><span aria-hidden="true">⌕</span><span className="sr-only">Поиск сотрудника</span><input type="search" value={employeeQuery} onChange={(event) => setEmployeeQuery(event.target.value)} placeholder="Ник, позывной, звание" /></label>
                <div className="personnel-list">
                  {employeesView === "loading" ? <AppSkeleton shape="employees" /> : <>
                  {filteredEmployees.map((employee, index) => <button key={employee.id} type="button" className={employee.id === selectedEmployee?.id ? "active" : ""} onClick={() => setSelectedEmployeeId(employee.id)}><span>{String(index + 1).padStart(2, "0")}</span><strong>{employee.nickname}</strong>{employee.source === "manual" && <small className="manual-mark">ВНЕ ТАБЛИЦЫ</small>}<small>{[employee.callsign, employee.title, employee.rank].filter(Boolean).join(" · ")}</small></button>)}
                  {!filteredEmployees.length && employees.length > 0 && <div className="list-empty">Сотрудники не найдены</div>}
                  </>}
                </div>
                <footer>СИНХРОНИЗАЦИЯ: {employeesSyncedAt ? new Date(employeesSyncedAt).toLocaleString("ru-RU") : "ОЖИДАНИЕ"}</footer>
              </aside>
              <article className="personnel-profile">
                {employeesView === "stale" && employeesSync.lastGoodAt !== null && <AppStaleBanner lastGoodAt={employeesSync.lastGoodAt} retrying={employeesSync.retrying} onRetry={() => void retryEmployees()} />}
                {employeesView === "loading" ? <AppSkeleton shape="document" /> : employeesView === "fatal" && employeesSync.failure ? <AppFatalPanel failure={employeesSync.failure} retrying={employeesSync.retrying} onRetry={() => void retryEmployees()} illustration="dish" /> : employeesView === "empty" || !selectedEmployee ? <div className="editor-empty empty-state"><PortiaIllustration name="dish" /><strong>{emptyCopy.employees.heading}</strong><span>{emptyCopy.employees.body}</span></div> : <div className="personnel-profile-body content-fade" key={selectedEmployee.id}>
                  <header className="personnel-profile-head">
                    <div className="personnel-avatar-stage">
                      <figure className="personnel-full-avatar">{selectedEmployee.robloxFullAvatarUrl ? <PortiaImage src={selectedEmployee.robloxFullAvatarUrl} alt={`Roblox-аватар ${selectedEmployee.nickname} в полный рост`} recordId={`${selectedEmployee.id}:avatar`} priority="hero" icon="employees" className="is-fill" /> : <div className="personnel-full-avatar-empty"><span>ROBLOX</span><small>ПОЛНЫЙ АВАТАР ПОЯВИТСЯ ПОСЛЕ СИНХРОНИЗАЦИИ</small></div>}</figure>
                      {selectedEmployee.robloxUserId ? <a className="personnel-portrait" href={`https://www.roblox.com/users/${selectedEmployee.robloxUserId}/profile`} target="_blank" rel="noreferrer" aria-label={`Профиль Roblox: ${selectedEmployee.nickname}`} title={`Профиль Roblox: ${selectedEmployee.nickname}`}><PortiaImage src={selectedEmployee.photoUrl || selectedEmployee.robloxAvatarUrl} alt={`Портрет ${selectedEmployee.nickname}`} recordId={`${selectedEmployee.id}:portrait`} priority="hero" icon="employees" className="is-fill is-compact" /></a> : <figure className="personnel-portrait"><PortiaImage src={selectedEmployee.photoUrl || selectedEmployee.robloxAvatarUrl} alt={`Портрет ${selectedEmployee.nickname}`} recordId={`${selectedEmployee.id}:portrait`} priority="hero" icon="employees" className="is-fill is-compact" /></figure>}
                    </div>
                    <div className="personnel-profile-identity"><h2>{selectedEmployee.nickname}</h2>{selectedEmployee.source === "manual" && <small className="manual-mark">ВНЕ ТАБЛИЦЫ</small>}<p className="personnel-callsign">{selectedEmployee.callsign || "Без позывного"}</p></div>
                  </header>
                  <dl className="personnel-stats"><div><dt>ЗВАНИЕ</dt><dd>{selectedEmployee.title || "Не указано"}</dd></div><div><dt>РАНГ</dt><dd>{selectedEmployee.rank || "Не указан"}</dd></div></dl>
                  {employeesProfilesRead && <dl className="personnel-stats personnel-ratings">{employeeRatings.map(({ key, label }) => <div key={key}><dt>{label}</dt><dd>{selectedEmployee[key] == null ? "—" : `${selectedEmployee[key]} / 10`}</dd></div>)}</dl>}
                  <section className="personnel-biography"><span>БИОГРАФИЯ</span><p>{employeesProfilesRead ? selectedEmployee.biography || "Биография сотрудника пока не заполнена." : "Профиль временно не загрузился."}</p></section>
                </div>}
              </article>
            </div>
          </AppWindow>

          <AppWindow app="search" state={windows.search} active={activeApp === "search"} onFocus={focusApp} onMinimize={minimizeApp} onMaximize={toggleMaximize} onClose={closeApp} onGeometry={updateWindowGeometry} className="global-search-window" meta="ГЛОБАЛЬНЫЙ ПОИСК">
            <div className="global-search-app">
              <header className="global-search-header"><h1>Глобальный поиск</h1><p>Поиск по приложениям, сотрудникам и материалам PORTIA.</p></header>
              <label className="global-search-box"><span aria-hidden="true">⌕</span><span className="sr-only">Глобальный поиск</span><input value={globalQuery} onChange={(event) => setGlobalQuery(event.target.value)} type="search" placeholder="Введите название, код или тему" /><kbd>Ctrl K</kbd></label>
              <div className="search-recommendations" aria-label="Рекомендации поиска"><span>РЕКОМЕНДАЦИИ</span><div>{content.searchRecommendations.map((item, index) => <button key={`${item}-${index}`} type="button" onClick={() => setGlobalQuery(item)}><FormattedText text={item} document={richTextLine(content.formattedText[portiaTextKey.searchRecommendations], content.searchRecommendations, index)} /></button>)}</div></div>
              <div className="global-search-summary"><span>{globalQuery ? `Результаты для «${globalQuery}»` : "Доступные записи"}</span><strong>{String(searchResults.length).padStart(2, "0")}</strong></div>
              <div className="global-search-results">
                {!contentReady ? <LoadingState label="Загрузка архива…" /> : <>
                {searchResults.map((result) => (
                  <button key={`${result.type}-${result.id}`} type="button" className="global-result" onClick={() => openSearchResult(result)}>
                    <span className="global-result-mark">{result.type === "virus" ? "VIS" : result.type === "employee" ? "EMP" : result.type === "info" ? "INF" : result.type === "guide" ? "REF" : result.type === "file" ? "FILE" : result.type === "app" ? "APP" : "MSG"}</span>
                    <span className="global-result-main"><span className="global-result-heading"><strong>{result.title || "БЕЗ НАЗВАНИЯ"}</strong><small>{result.meta}</small></span><span className="global-result-preview">{result.body}</span></span>
                  </button>
                ))}
                {!searchResults.length && <div className="global-search-empty empty-state"><PortiaIllustration name="microscope" /><strong>Совпадений нет</strong><span>Измените запрос или выберите рекомендацию.</span></div>}
                </>}
              </div>
            </div>
          </AppWindow>

          <AppWindow app="info" state={windows.info} active={activeApp === "info"} onFocus={focusApp} onMinimize={minimizeApp} onMaximize={toggleMaximize} onClose={closeApp} onGeometry={updateWindowGeometry} className="utility-window info-window" meta="АРХИВ ЗНАНИЙ">
            {infoView === "loading" ? <div className="app-state-body"><AppSkeleton shape="info" /></div>
              : infoView === "fatal" ? <div className="app-state-body">{contentFatal("flask")}</div>
              : infoView === "empty" ? <div className="app-state-body"><div className="empty-state"><PortiaIllustration name="flask" /><strong>{emptyCopy.info.heading}</strong><span>{emptyCopy.info.body}</span></div></div>
              : <div className="info-library">
              <aside className="info-index">{content.infoSections.map((section, index) => {
                const open = section.id === selectedInfo?.id;
                return (
                  <div key={section.id}>
                    <button type="button" className={`${open && !selectedSubsection ? "active" : ""}${section.subsections.length ? " has-subsections" : ""}`} aria-expanded={section.subsections.length ? open : undefined} onClick={() => setSelectedInfoId(section.id)}><small>{String(index + 1).padStart(2, "0")}</small><span>{section.title}</span>{section.subsections.length ? <em className="info-sub-marker" aria-label={`Подразделов: ${section.subsections.length}`}>{open ? "▾" : "▸"} {section.subsections.length}</em> : null}</button>
                    {open && section.subsections.length ? <div className="info-subsections">{section.subsections.map((sub, subIndex) => <button key={sub.id} type="button" className={sub.id === selectedSubsection?.id ? "active" : ""} title={sub.title || "БЕЗ НАЗВАНИЯ"} onClick={() => setSelectedInfoId(sub.id)}><small>{String(index + 1).padStart(2, "0")}.{subIndex + 1}</small><span>{sub.title || "БЕЗ НАЗВАНИЯ"}</span></button>)}</div> : null}
                  </div>
                );
              })}</aside>
              <article className="info-document">{infoView === "stale" && contentStaleBanner}{selectedInfo ? (selectedSubsection
                ? <div className="content-fade" key={selectedSubsection.id}><span className="eyebrow">{selectedInfo.title}</span><h1>{selectedSubsection.title || "БЕЗ НАЗВАНИЯ"}</h1><div className="info-blocks">{selectedSubsection.blocks.map((block) => block.type === "text"
                  ? <FormattedText key={block.id} className="info-document-copy" text={block.text} document={content.formattedText[portiaTextKey.infoBlock(block.id)]} />
                  : block.type === "table"
                    ? <dl key={block.id} className="info-ledger info-classification">{block.rows.filter((row) => row.key || row.value).map((row, rowIndex) => <div key={rowIndex}><dt>{row.key}</dt><dd>{row.value}</dd></div>)}</dl>
                    : block.type === "video" && block.videoId
                      // nocookie embed, id validated by normalizePortiaContent (D-09); default referrer policy, YouTube refuses embeds without a Referer.
                      ? <YoutubeFigure key={block.id} videoId={block.videoId} title={selectedSubsection.title} />
                      : block.type === "photo" && block.url
                        ? <figure key={block.id} className="info-block-photo"><img src={block.url} alt={`Иллюстрация: ${selectedSubsection.title}`} loading="lazy" decoding="async" referrerPolicy="no-referrer" /></figure>
                        : null)}</div></div>
                : <div className="content-fade" key={selectedInfo.id}><h1>{selectedInfo.title}</h1><FormattedText className="info-document-copy" text={selectedInfo.body} document={content.formattedText[portiaTextKey.info(selectedInfo.id)]} /></div>
              ) : null}</article>
            </div>}
          </AppWindow>

          <AppWindow app="guide" state={windows.guide} active={activeApp === "guide"} onFocus={focusApp} onMinimize={minimizeApp} onMaximize={toggleMaximize} onClose={closeApp} onGeometry={updateWindowGeometry} className="utility-window guide-window" meta="СПРАВОЧНИК">
            {guideView === "loading" ? <div className="app-state-body"><AppSkeleton shape="guide" /></div>
              : guideView === "fatal" ? <div className="app-state-body">{contentFatal("microscope")}</div>
              : <GuideApp sections={content.guideSections} formattedText={content.formattedText} openCardId={guideCardId} onOpenCard={setGuideCardId} banner={guideView === "stale" ? contentStaleBanner : null} />}
          </AppWindow>

          <AppWindow app="promotion" state={windows.promotion} active={activeApp === "promotion"} onFocus={focusApp} onMinimize={minimizeApp} onMaximize={toggleMaximize} onClose={closeApp} onGeometry={updateWindowGeometry} className="utility-window promotion-window" meta="Повышение" locked={qualificationLocked}>
            <PortiaPromotion visible={activeApp === "promotion" && !windows.promotion.minimized} onRetakeReady={setPromotionRetakeToast} onQualificationLockChange={updateQualificationLock} />
          </AppWindow>

          <AppWindow app="broadcasts" state={windows.broadcasts} active={activeApp === "broadcasts"} onFocus={focusApp} onMinimize={minimizeApp} onMaximize={toggleMaximize} onClose={closeApp} onGeometry={updateWindowGeometry} className="utility-window broadcasts-window" meta="КАНАЛ СТАНЦИИ">
            <div className="broadcasts-app">
              <header><h1>Объявления</h1><p>Еженедельные квесты, задачи и новости.</p></header>
              {broadcastsView === "stale" && contentStaleBanner}
              {broadcastsView === "loading" ? <AppSkeleton shape="broadcasts" /> : broadcastsView === "fatal" ? contentFatal("flask") : <>
              <div className="editor-tabs broadcast-tabs">
                {([["news", "Новости"], ["quests", "Квесты"]] as const).map(([tab, label]) => <button key={tab} type="button" className={broadcastTab === tab ? "active" : ""} aria-pressed={broadcastTab === tab} onClick={() => setBroadcastTab(tab)}>{label} {broadcastFeed(content.broadcasts, tab, today).length}</button>)}
              </div>
              <div className="broadcast-grid">
                {broadcastFeed(content.broadcasts, broadcastTab, today).map((item) => {
                  const state = item.type === "quest" ? questState(item, today) : null;
                  // D-19: a quest or task never shows ВАЖНО, whatever the stored data says.
                  const important = item.type === "news" && item.important;
                  const badge = state === "active" ? "АКТИВЕН" : state === "upcoming" ? `СКОРО · с ${formatQuestDay(item.startsAt).slice(0, 5)}` : "ЗАВЕРШЁН";
                  return <article className={`broadcast-card ${item.type}${important ? " important" : ""}${state ? ` state-${state}` : ""}`} key={item.id}><span>{broadcastType(item.type)}{important ? " · ВАЖНО" : ""}</span>{state && <em className="quest-badge">{badge}</em>}<h2>{item.title || "БЕЗ НАЗВАНИЯ"}</h2>{item.type === "quest" && (item.startsAt || item.endsAt) && <div className="broadcast-dates">{item.startsAt && <span>Начало: {formatQuestDay(item.startsAt)}</span>}{item.endsAt && <span>Окончание: {formatQuestDay(item.endsAt)}</span>}</div>}{item.type === "quest" && item.conditions && <div className="broadcast-conditions"><b>УСЛОВИЯ</b><p>{item.conditions}</p></div>}<FormattedText className="broadcast-card-copy" text={item.body} document={content.formattedText[portiaTextKey.broadcast(item.id)]} /></article>;
                })}
                {!broadcastFeed(content.broadcasts, broadcastTab, today).length && <div className="broadcast-empty empty-state"><PortiaIllustration name="flask" /><strong>{emptyCopy[broadcastTab].heading}</strong><span>{emptyCopy[broadcastTab].body}</span></div>}
              </div></>}
            </div>
          </AppWindow>

          {(["sheet", "charter"] as const).map((app) => <AppWindow key={app} app={app} state={windows[app]} active={activeApp === app} onFocus={focusApp} onMinimize={minimizeApp} onMaximize={toggleMaximize} onClose={closeApp} onGeometry={updateWindowGeometry} className="utility-window document-window" meta="ДОКУМЕНТ ОТДЕЛА">
            <EmbeddedDocument src={embeddedApps[app].src} external={embeddedApps[app].external} title={appMeta[app].label} />
          </AppWindow>)}
          <AppWindow app="trash" state={windows.trash} active={activeApp === "trash"} onFocus={focusApp} onMinimize={minimizeApp} onMaximize={toggleMaximize} onClose={closeApp} onGeometry={updateWindowGeometry} className="utility-window trash-window" meta={`ФАЙЛОВ ${String(trashFiles.length + recycledViruses.length).padStart(2, "0")}`}>
            <div className={`trash-app${activeTrashFile || activeTrashVirus ? " is-viewing" : ""}`}>
              <header><h1>Корзина</h1><p>Бесполезный хлам — кому вообще придет в голову его перебирать?</p></header>
              {trashView === "stale" && contentStaleBanner}
              {trashView === "loading" ? <AppSkeleton shape="trash" /> : trashView === "fatal" ? contentFatal("dish") : <div className="trash-layout">
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
                  {trashView === "empty" && <div className="editor-empty empty-state"><PortiaIllustration name="dish" /><strong>{emptyCopy.trash.heading}</strong><span>{emptyCopy.trash.body}</span></div>}
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
              <SettingGroup title="Цвет интерфейса" values={[['teal','Portia'],['ice','Холодный'],['amber','Янтарный'],['red','Тревога']]} current={desktopSettings.accent} onSelect={(value) => { closeAccentPicker(); updateDesktopSetting("accent", value); }}>
                <button type="button" ref={customAccentButton} className={desktopSettings.accent === "custom" ? "selected" : ""} aria-pressed={desktopSettings.accent === "custom"} onClick={chooseCustomAccent}><i className="swatch custom" style={customTokens ? { background: customTokens["--teal"] } : undefined} /><span>Свой</span></button>
                {accentPickerOpen && <div className="accent-picker" onKeyDown={(event) => {
                  if (event.key !== "Escape") return;
                  // preventDefault marks Escape as handled so the document-level quest-notice listener skips it; focus returns to «Свой» because the picker unmounts.
                  event.preventDefault(); closeAccentPicker(); customAccentButton.current?.focus();
                }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) commitAccentDraft(); }}>
                  <CustomColorPicker key="accent" group="accent" title="Свой цвет интерфейса" color={desktopSettings.customAccent} onChange={previewAccent} onClose={closeAccentPicker} />
                </div>}
              </SettingGroup>
              <SettingGroup title="Фон рабочего стола" values={[['radar','Паутина'],['grid','Спирали ДНК'],['gel','Гель'],['cells','Клетки'],['quiet','Чистый']]} current={desktopSettings.wallpaper} onSelect={(value) => updateDesktopSetting("wallpaper", value)} />
              <SettingGroup title="Размер ярлыков" values={[['compact','Компактный'],['standard','Стандартный'],['large','Крупный']]} current={desktopSettings.iconSize} onSelect={(value) => updateDesktopSetting("iconSize", value)} />
              <SettingGroup title="Анимации" values={[['on','Включены'],['reduced','Уменьшены'],['off','Выключены']]} current={desktopSettings.motion} onSelect={(value) => updateDesktopSetting("motion", value)}><p className="setting-hint">Системная настройка «уменьшить движение» не учитывается: управляйте анимациями здесь.</p></SettingGroup>
              <SettingGroup title="Паук" values={[['on','Показывать'],['off','Скрыть']]} current={desktopSettings.spider} onSelect={(value) => updateDesktopSetting("spider", value)} />
              <section className="settings-section content-control-entry"><div><h2>Содержимое сайта</h2><p>{canEdit ? "Редактируйте вирусы, информацию, сводку, поиск и советы помощника." : "Войдите в разрешённый аккаунт редактора."}</p></div><div className="content-control-actions"><button type="button" disabled={!canEdit} onClick={() => openApp("editor")}>ОТКРЫТЬ РЕДАКТОР</button><a href="/owner-login">{canEdit ? "УПРАВЛЕНИЕ ВХОДОМ" : "ВОЙТИ В РЕДАКТОР"}</a></div></section>
              <div className="settings-footer"><button className="factory-reset" type="button" onClick={resetDesktopSettings}>СБРОСИТЬ ДО ЗАВОДСКИХ</button><span className={`settings-saved-status${settingsSavedVisible ? " is-visible" : ""}`} role="status" aria-live="polite">Настройки сохранены</span></div>
            </div>
          </AppWindow>

          <AppWindow app="editor" state={windows.editor} active={activeApp === "editor"} onFocus={focusApp} onMinimize={minimizeApp} onMaximize={toggleMaximize} onClose={closeApp} onGeometry={updateWindowGeometry} className="editor-window" meta="ДОСТУП ВЛАДЕЛЬЦА">
            {canEdit ? <PortiaEditor content={content} revision={revision} saveState={saveState} canManageEditors={canManageEditors} openTabs={openTabs} active={activeApp === "editor" && !windows.editor.minimized} minimized={windows.editor.minimized} onDirtyChange={reportEditorDirty} closeRequest={editorCloseRequest} onCloseApproved={() => requestExit("editor", "close", true)} onSave={saveContent} onEmployeeSaved={updateEmployee} onEmployeeRemoved={removeEmployee} saveError={saveError} /> : <div className="editor-empty">У этого аккаунта нет доступа к редактору.</div>}
          </AppWindow>
        </main>

        <div className={`desktop-assistant${assistantSpeaking ? " is-speaking" : ""}${assistantOffended ? " is-offended" : ""}${assistantRecovering ? " is-recovering" : ""}`} data-mood={assistantMood || undefined} data-squish={assistantSquish ? (assistantSquish % 2 ? "a" : "b") : undefined} data-auto={assistantAutomaticKind ?? undefined}>
          {assistantSpeaking && <div className="assistant-bubble" role="status"><span>{assistantMessageHeading}</span><FormattedText className="assistant-formatted-text" text={assistantMessageText} document={assistantMessageDocument} /></div>}
          <button className="assistant-button" type="button" onClick={activateAssistant} onContextMenu={(event) => event.preventDefault()} aria-disabled={assistantOffended} aria-label="Получить совет Вивьян"><img src="/assets/portia-assistant.png" alt="" draggable={false} /></button>
          <span className="assistant-label">ВИВЬЯН // ПОМОЩНИК</span>
        </div>

        <footer className="taskbar">
          <button className="start-button" type="button" onClick={() => setStartOpen((value) => !value)} aria-expanded={startOpen}><img className="portia-mark" src="/assets/portia-logo.png" alt="" /><span>PORTIA</span></button>
          <div className="taskbar-apps" role="toolbar" aria-label="Открытые программы">
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
          <StartPanelButton icon="search" label="Глобальный поиск" onClick={() => openApp("search")} />
          <StartPanelButton icon="virus" label="База вирусов" onClick={() => openApp("archive")} />
          <StartPanelButton icon="employees" label="Сотрудники" onClick={() => openApp("employees")} />
          <StartPanelButton icon="promotion" label="Повышение" onClick={() => openApp("promotion")} />
          <StartPanelButton icon="settings" label="Настройки" onClick={() => openApp("settings")} />
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

// In the archive list the badges stand alone, so each one names its term for screen readers and on hover.
function RowBadges({ virus }: { virus: Virus }) {
  const terms = [virus.classification.danger, virus.classification.spread, virus.classification.escapeRisk];
  const badges = terms.flatMap((term) => { const icon = classificationIconFor(term); return icon ? [{ term, icon }] : []; });
  if (!badges.length) return null;
  return <span className="row-badges">{badges.map(({ term, icon }) => <span className="row-badge" key={term} title={term}><PortiaIcon name={icon} role="img" aria-hidden={false} aria-label={term} /></span>)}</span>;
}

// Non-modal corner notification: the owner asked for a side toast instead of a window (G-03.2-2b).
function QuestToast({ quest, more, document, onDismiss }: { quest: Broadcast; more: number; document?: RichTextDocument; onDismiss: (openQuests: boolean) => void }) {
  const titleId = useId();

  // The notice never takes focus, so Escape is heard on the document; handled keys, typing and modal dialogs keep their Escape.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select"))) return;
      if (window.document.querySelector("dialog[open]")) return;
      onDismiss(false);
    };
    window.document.addEventListener("keydown", onKeyDown);
    return () => window.document.removeEventListener("keydown", onKeyDown);
  }, [onDismiss]);

  return (
    <aside className="portia-dialog quest-toast" aria-labelledby={titleId}>
      <span role="status" className="sr-only">Новый квест: {quest.title || "БЕЗ НАЗВАНИЯ"}</span>
      <div>
        <div className="quest-toast-head">
          <span className="quest-toast-eyebrow">НОВЫЙ КВЕСТ</span>
          <button type="button" className="quest-toast-close" aria-label="Закрыть уведомление" onClick={() => onDismiss(false)}>×</button>
        </div>
        <h2 id={titleId}>{quest.title || "БЕЗ НАЗВАНИЯ"}</h2>
        {(quest.startsAt || quest.endsAt) && <div className="broadcast-dates">{quest.startsAt && <span>Начало: {formatQuestDay(quest.startsAt)}</span>}{quest.endsAt && <span>Окончание: {formatQuestDay(quest.endsAt)}</span>}</div>}
        {quest.conditions && <div className="broadcast-conditions"><b>УСЛОВИЯ</b><p>{quest.conditions}</p></div>}
        <FormattedText className="quest-toast-body" text={quest.body} document={document} />
        {more > 0 && <p className="quest-toast-more">Ещё активных квестов: {more}</p>}
        <div className="portia-dialog-actions">
          <button type="button" className="primary-control" onClick={() => onDismiss(true)}>ОТКРЫТЬ КВЕСТЫ</button>
        </div>
      </div>
    </aside>
  );
}

function PromotionRetakeToast({ onDismiss }: { onDismiss: (openPromotion: boolean) => void }) {
  const titleId = useId();
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest("input, textarea, select"))) return;
      if (window.document.querySelector("dialog[open]")) return;
      onDismiss(false);
    };
    window.document.addEventListener("keydown", onKeyDown);
    return () => window.document.removeEventListener("keydown", onKeyDown);
  }, [onDismiss]);
  return <aside className="portia-dialog quest-toast promotion-retake-toast" aria-labelledby={titleId}>
    <span role="status" className="sr-only">Повторная квалификационная проверка доступна.</span>
    <div><div className="quest-toast-head"><span className="quest-toast-eyebrow">ПОВТОРНАЯ ПРОВЕРКА ДОСТУПНА</span><button type="button" className="quest-toast-close" aria-label="Закрыть уведомление" onClick={() => onDismiss(false)}>×</button></div><h2 id={titleId}>Можно подать новый запрос</h2><p className="quest-toast-body">Срок ожидания завершён. Откройте «Повышение», чтобы запросить квалификацию повторно.</p><div className="portia-dialog-actions"><button type="button" className="primary-control" onClick={() => onDismiss(true)}>ОТКРЫТЬ ПОВЫШЕНИЕ</button></div></div>
  </aside>;
}

function SettingGroup({ title, values, current, onSelect, children }: { title: string; values: [string, string][]; current: string; onSelect: (value: string) => void; children?: React.ReactNode }) {
  return <section className="settings-section"><h2>{title}</h2><div className={`setting-options${title === "Цвет интерфейса" ? " color-options" : ""}`}>{values.map(([value, label]) => <button key={value} type="button" className={current === value ? "selected" : ""} aria-pressed={current === value} onClick={() => onSelect(value)}>{title === "Цвет интерфейса" && <i className={`swatch ${value}`} />}<span>{label}</span></button>)}{children}</div></section>;
}

function broadcastType(type: "quest" | "task" | "news") {
  return type === "quest" ? "ЕЖЕНЕДЕЛЬНЫЙ КВЕСТ" : type === "task" ? "ЗАДАЧА" : "НОВОСТЬ";
}
