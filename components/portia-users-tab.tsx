"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AppDeniedPanel, AppFatalPanel, AppSkeleton, AppStaleBanner } from "@/components/portia-desktop-states";
import { ConfirmDialog } from "@/components/portia-editor-dossier";
import { EditorActionBar, EditorDraftBar, EditorEmptyDetail, EditorTabBody } from "@/components/portia-editor-tab-shell";
import { failureFromResponse, type AppFailure } from "@/lib/app-state";
import type { AccessLevel } from "@/lib/access-levels";
import { usersCopy } from "@/lib/users-copy";
import { parseUsersBulk, parseUsersCount, parseUsersHistory, parseUsersListReply, type TableMark, type UsersBulk, type UsersHistoryEntry, type UsersList } from "@/lib/users-model";
import { buildUsersView, bulkButtonState, bulkProgress, bulkSummary, bulkTitle, decisionLevelOptions, historyLine, nextUsersSelection, pendingBadgeText, resultNote, visibleControls, type UsersView } from "@/lib/users-view";

type UsersTabProps = {
  visible: boolean;
  canManageEditors: boolean;
  onPendingCount: (count: number | null) => void;
};

type ViewRow = UsersView["pending"]["rows"][number];
type UsersSectionKind = "pending" | "people" | "closed";
type RowAction = "approve" | "reject" | "set-level" | "revoke" | "clear-cooldown";
type RowContext = { row: ViewRow; section: UsersSectionKind; index: number };
type BusyAction = { key: string; action: RowAction } | null;
type ConfirmState = { kind: "reject" | "revoke"; context: RowContext; fromPhone: boolean };
type HistoryState = { entries: UsersHistoryEntry[]; loading: boolean; error: boolean };
type ActionHandlers = {
  onApprove: (context: RowContext, level: AccessLevel | undefined, fromPhone: boolean) => void;
  onReject: (context: RowContext, opener: HTMLButtonElement, fromPhone: boolean) => void;
  onSetLevel: (context: RowContext, level: AccessLevel, fromPhone: boolean) => void;
  onRevoke: (context: RowContext, opener: HTMLButtonElement, fromPhone: boolean) => void;
  onClearCooldown: (context: RowContext, fromPhone: boolean) => void;
};

// Phase 26 (UI-04, D-12): the sections of the PC layout, in the order of the bar's nav.
const USERS_SECTIONS = ["pending", "people", "closed"] as const;

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  try { return await response.json() as Record<string, unknown>; } catch { return {}; }
}

function EmptyState({ kind }: { kind: "pending" | "people" | "closed" | "search" }) {
  if (kind === "closed") return <div className="editor-empty"><p>{usersCopy.closedEmpty}</p></div>;
  const copy = kind === "pending" ? usersCopy.pendingEmpty : kind === "people" ? usersCopy.peopleEmpty : usersCopy.searchEmpty;
  return <div className="editor-empty"><strong>{copy.heading}</strong><p>{copy.body}</p></div>;
}

function ProfileLink({ row }: { row: ViewRow }) {
  return <a href={row.profileUrl} aria-label={usersCopy.profileAria(row.nickname)} target="_blank" rel="noopener noreferrer">{usersCopy.profileLink}</a>;
}

function RowCaption({ row }: { row: ViewRow }) {
  if (!row.caption && !row.pause) return null;
  return (
    <span className="users-row-caption">
      {row.caption && row.captionAt ? <time dateTime={row.captionAt}>{row.caption}</time> : row.caption}
      {row.pause ? <span>{row.pause}</span> : null}
    </span>
  );
}

function HistoryPanel({ id, state }: { id: string; state: HistoryState | undefined }) {
  const lines = (state?.entries ?? []).map((entry) => historyLine(entry, new Date())).filter((line): line is string => line !== null);
  return (
    <div className="users-history">
      <h3>{usersCopy.historyHeading}</h3>
      <ol id={id} className="users-history-list" aria-busy={state?.loading || undefined}>
        {lines.map((line, index) => <li key={`${line}-${index}`}>{line}</li>)}
      </ol>
      {state?.error ? <p className="users-action-note" role="status">{usersCopy.actionFailed}</p> : null}
      {state && !state.loading && !state.error && state.entries.length === 0 ? <p className="users-history-empty">{usersCopy.historyEmpty}</p> : null}
    </div>
  );
}

function RowActions({
  context,
  callerIsOwner,
  fromPhone,
  busy,
  onApprove,
  onReject,
  onSetLevel,
  onRevoke,
  onClearCooldown,
}: {
  context: RowContext;
  callerIsOwner: boolean;
  fromPhone: boolean;
  busy: BusyAction;
  onApprove: (context: RowContext, level: AccessLevel | undefined, fromPhone: boolean) => void;
  onReject: (context: RowContext, opener: HTMLButtonElement, fromPhone: boolean) => void;
  onSetLevel: (context: RowContext, level: AccessLevel, fromPhone: boolean) => void;
  onRevoke: (context: RowContext, opener: HTMLButtonElement, fromPhone: boolean) => void;
  onClearCooldown: (context: RowContext, fromPhone: boolean) => void;
}) {
  const controls = visibleControls(context.row.source, callerIsOwner);
  const [level, setLevel] = useState<AccessLevel | null>(controls.levelDefault);
  const rowBusy = busy?.key === context.row.key;
  const currentLevel = "canSetLevel" in context.row.source ? context.row.source.level : null;
  if (controls.controls.length === 0) return controls.caption ? <p className="users-action-caption">{controls.caption}</p> : null;
  return (
    <div className="users-row-actions">
      {controls.controls.includes("level") && level !== null ? (
        <label className="editor-field users-level-control">
          <span>{usersCopy.levelLabel}</span>
          <select value={level} disabled={rowBusy} onChange={(event) => setLevel(Number(event.target.value) as AccessLevel)}>
            {decisionLevelOptions().map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      ) : null}
      {controls.fixedLevelText ? <span className="users-fixed-level">{controls.fixedLevelText}</span> : null}
      {controls.controls.includes("approve") ? (
        <button
          type="button"
          className="primary-control"
          aria-label={usersCopy.approveAria(context.row.nickname)}
          disabled={rowBusy}
          onClick={() => onApprove(context, level ?? undefined, fromPhone)}
        >
          {rowBusy && busy?.action === "approve" ? usersCopy.approving : usersCopy.approve}
        </button>
      ) : null}
      {controls.controls.includes("reject") ? (
        <button
          type="button"
          className="danger-control"
          disabled={rowBusy}
          onClick={(event) => onReject(context, event.currentTarget, fromPhone)}
        >
          {rowBusy && busy?.action === "reject" ? usersCopy.rejecting : usersCopy.reject}
        </button>
      ) : null}
      {controls.controls.includes("setLevel") && level !== null ? (
        <button
          type="button"
          className="secondary-control"
          disabled={rowBusy || level === currentLevel}
          onClick={() => onSetLevel(context, level, fromPhone)}
        >
          {rowBusy && busy?.action === "set-level" ? usersCopy.saving : usersCopy.setLevel}
        </button>
      ) : null}
      {controls.controls.includes("revoke") ? (
        <button
          type="button"
          className="danger-control"
          disabled={rowBusy}
          onClick={(event) => onRevoke(context, event.currentTarget, fromPhone)}
        >
          {rowBusy && busy?.action === "revoke" ? usersCopy.revoking : usersCopy.revoke}
        </button>
      ) : null}
      {controls.controls.includes("clearCooldown") ? (
        <button type="button" className="secondary-control" disabled={rowBusy} onClick={() => onClearCooldown(context, fromPhone)}>
          {usersCopy.clearCooldown}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Phase 26 (UI-04, D-12): one body for the phone action window and the PC detail pane — the nickname, «ТИП», «В ТАБЛИЦЕ»,
 * «ПРОФИЛЬ», the caption of the last decision, the history (always open outside «Заявки») and the actions. The actions come
 * only from visibleControls in RowActions (the server's row flags); the body itself decides nothing (T-26-18).
 */
function UsersActionBody({
  context,
  titleId,
  historyId,
  historyState,
  fromPhone,
  callerIsOwner,
  busy,
  handlers,
}: {
  context: RowContext;
  titleId: string;
  historyId: string;
  historyState: HistoryState | undefined;
  fromPhone: boolean;
  callerIsOwner: boolean;
  busy: BusyAction;
  handlers: ActionHandlers;
}) {
  const { row } = context;
  return (
    <div className="users-action-body">
      <h2 id={titleId}>{row.nickname}</h2>
      <dl>
        <div><dt>{usersCopy.typeLabel}</dt><dd>{row.typePlaque}</dd></div>
        <div><dt>{usersCopy.tableLabel}</dt><dd><span className={`users-table-mark ${row.tableMark.tone}`}>{row.tableMark.text}</span></dd></div>
        <div><dt>{usersCopy.profileLabel}</dt><dd><ProfileLink row={row} /></dd></div>
      </dl>
      <RowCaption row={row} />
      {context.section !== "pending" ? <HistoryPanel id={historyId} state={historyState} /> : null}
      <RowActions context={context} callerIsOwner={callerIsOwner} fromPhone={fromPhone} busy={busy} {...handlers} />
    </div>
  );
}

function UsersActionDialog({
  context,
  callerIsOwner,
  busy,
  handlers,
  historyState,
  onClose,
}: {
  context: RowContext;
  callerIsOwner: boolean;
  busy: BusyAction;
  handlers: ActionHandlers;
  historyState: HistoryState | undefined;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const phoneHistory = context.section === "pending" ? undefined : historyState;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="portia-dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="users-action-dialog-body">
        <UsersActionBody context={context} titleId={titleId} historyId={`users-phone-history-${context.row.source.nicknameKey}`} historyState={phoneHistory} fromPhone callerIsOwner={callerIsOwner} busy={busy} handlers={handlers} />
        <div className="portia-dialog-actions">
          <button type="button" className="secondary-control" data-autofocus onClick={onClose}>{usersCopy.closeWindow}</button>
        </div>
      </div>
    </dialog>
  );
}

function UsersBulkDialog({
  bulkDialog,
  bulkRunning,
  progress,
  onApprove,
  onClose,
}: {
  bulkDialog: UsersBulk;
  bulkRunning: boolean;
  progress: string;
  onApprove: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="portia-dialog users-bulk-dialog"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onCancel={(event) => { if (bulkRunning) event.preventDefault(); else { event.preventDefault(); onClose(); } }}
      onClick={(event) => { if (!bulkRunning && event.target === event.currentTarget) onClose(); }}
    >
      <div className="users-action-dialog-body">
        <h2 id={titleId}>{bulkTitle(bulkDialog.eligible.length)}</h2>
        <section>
          <h3>{usersCopy.bulkApproveHeading}</h3>
          <ul className="users-bulk-list">
            {bulkDialog.eligible.map((candidate) => <li key={candidate.id}>{candidate.nickname}</li>)}
          </ul>
        </section>
        {bulkDialog.excluded.length > 0 ? (
          <section>
            <h3>{usersCopy.bulkExcludedHeading}</h3>
            <ul className="users-bulk-list muted">
              {bulkDialog.excluded.map((candidate) => <li key={candidate.id}>{candidate.nickname}</li>)}
            </ul>
          </section>
        ) : null}
        <p className="users-bulk-progress" role="status" aria-live="polite">{progress}</p>
        <div className="portia-dialog-actions">
          <button type="button" className="secondary-control" data-autofocus autoFocus disabled={bulkRunning} onClick={onClose}>{usersCopy.bulkKeep}</button>
          <button type="button" className="primary-control" disabled={bulkRunning} onClick={onApprove}>{bulkRunning ? usersCopy.approving : usersCopy.approve}</button>
        </div>
      </div>
    </dialog>
  );
}

/**
 * The rows of a section. Phone: a row opens the action window. PC (D-12): a row only picks itself for the detail pane —
 * nickname, status plaque, caption; its actions and history live in the detail.
 */
function UsersRows({
  rows,
  section,
  isPhone,
  busy,
  notes,
  selectedKey = null,
  onSelect,
  onOpen,
}: {
  rows: ViewRow[];
  section: UsersSectionKind;
  isPhone: boolean;
  busy: BusyAction;
  notes: Readonly<Record<string, string>>;
  selectedKey?: string | null;
  onSelect?: (context: RowContext) => void;
  onOpen: (context: RowContext, opener: HTMLButtonElement) => void;
}) {
  return (
    <ul className="users-list users-rows">
      {rows.map((row, index) => {
        const context = { row, section, index };
        return (
        <li className="users-row" data-users-row-index={index} aria-busy={busy?.key === row.key || undefined} key={row.key}>
          {isPhone ? (
            <button type="button" className="users-phone-row" aria-haspopup="dialog" onClick={(event) => onOpen(context, event.currentTarget)}>
              <span className="users-row-main"><strong title={row.nickname}>{row.nickname}</strong><span className="users-plaque">{row.statusPlaque}</span></span>
              <RowCaption row={row} />
            </button>
          ) : (
            <button type="button" className="users-pick-row" data-users-row-key={row.key} aria-current={selectedKey === row.key ? "true" : undefined} onClick={() => onSelect?.(context)}>
              <span className="users-row-main"><strong title={row.nickname}>{row.nickname}</strong><span className={`users-plaque${row.statusPlaque === usersCopy.pendingPlaque ? " warning" : row.typePlaque === row.statusPlaque ? " danger" : ""}`}>{row.statusPlaque}</span></span>
              <RowCaption row={row} />
            </button>
          )}
          {notes[row.source.nicknameKey] ? <p className="users-action-note" role="status">{notes[row.source.nicknameKey]}</p> : null}
        </li>
      );})}
    </ul>
  );
}

function focusAfterRefresh(section: UsersSectionKind, index: number) {
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
    const container = document.querySelector<HTMLElement>(`[data-users-section="${section}"]`);
    const rows = container?.querySelectorAll<HTMLElement>("[data-users-row-index]");
    const targetRow = rows?.item(Math.min(index, Math.max(0, rows.length - 1)));
    const control = targetRow?.querySelector<HTMLElement>("button:not(:disabled), select:not(:disabled), a[href]");
    (control ?? container?.querySelector<HTMLElement>("h2, summary"))?.focus();
  }));
}

/** PC (D-12): after a decision the focus goes to the picked row; with no row left, to the section's button in the bar. */
function focusPcSelection(section: UsersSectionKind, key: string | null) {
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
    const row = key === null ? undefined : [...document.querySelectorAll<HTMLElement>("[data-users-row-key]")].find((element) => element.dataset.usersRowKey === key);
    (row ?? document.querySelector<HTMLElement>(`[data-users-tab="${section}"]`))?.focus();
  }));
}

export function UsersTab({ visible, canManageEditors, onPendingCount }: UsersTabProps) {
  const [list, setList] = useState<UsersList | null>(null);
  const [failure, setFailure] = useState<AppFailure | null>(null);
  const [denied, setDenied] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [lastGoodAt, setLastGoodAt] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isPhone, setIsPhone] = useState(false);
  const [dialogContext, setDialogContext] = useState<RowContext | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [bulk, setBulk] = useState<UsersBulk | null>(null);
  const [bulkDialog, setBulkDialog] = useState<UsersBulk | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgressText, setBulkProgressText] = useState("");
  const [busy, setBusy] = useState<BusyAction>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [historyByKey, setHistoryByKey] = useState<Record<string, HistoryState>>({});
  const [openHistoryKeys, setOpenHistoryKeys] = useState<Set<string>>(() => new Set());
  const [announcement, setAnnouncement] = useState("");
  const [activeSection, setActiveSection] = useState<UsersSectionKind>("pending");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const detailTitleId = useId();
  const recentDecisionMarks = useRef(new Map<string, { mark: TableMark; until: number }>());
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const confirmReturnRef = useRef<HTMLElement | null>(null);
  const requestEpoch = useRef(0);
  const historyRequestEpoch = useRef<Record<string, number>>({});
  const openHistoryKeysRef = useRef(openHistoryKeys);
  // The last list the server sent: after a PC decision its rows give the order the next row is picked from.
  const latestList = useRef<UsersList | null>(null);
  // WR-03: what a decision does with the selection and the focus once the list after it is accepted. load() runs it on the first accepted list,
  // whichever request that is: a poll or a new query that took over the epoch would otherwise swallow the follow-up of the decision.
  const afterDecision = useRef<((list: UsersList) => void) | null>(null);
  const callerIsOwner = Boolean(list?.callerIsOwner && canManageEditors);

  useEffect(() => { openHistoryKeysRef.current = openHistoryKeys; }, [openHistoryKeys]);

  const loadHistory = useCallback(async (nicknameKey: string) => {
    const requestId = (historyRequestEpoch.current[nicknameKey] ?? 0) + 1;
    historyRequestEpoch.current[nicknameKey] = requestId;
    setHistoryByKey((current) => ({
      ...current,
      [nicknameKey]: { entries: current[nicknameKey]?.entries ?? [], loading: true, error: false },
    }));
    try {
      const response = await fetch(`/api/users?view=history&key=${encodeURIComponent(nicknameKey)}`, { cache: "no-store" });
      const body = await responseBody(response);
      if (!response.ok) throw new Error("history-unavailable");
      const entries = parseUsersHistory(body);
      if (historyRequestEpoch.current[nicknameKey] !== requestId) return;
      setHistoryByKey((current) => ({ ...current, [nicknameKey]: { entries, loading: false, error: false } }));
    } catch {
      if (historyRequestEpoch.current[nicknameKey] !== requestId) return;
      setHistoryByKey((current) => ({
        ...current,
        [nicknameKey]: { entries: current[nicknameKey]?.entries ?? [], loading: false, error: true },
      }));
    }
  }, []);

  const load = useCallback(async () => {
    const requestId = ++requestEpoch.current;
    setRetrying(true);
    try {
      const search = debouncedQuery.trim();
      const response = await fetch(`/api/users?view=list${search ? `&q=${encodeURIComponent(search)}` : ""}`, { cache: "no-store" });
      const body = await responseBody(response);
      if (requestId !== requestEpoch.current) return;
      if (response.status === 403 && typeof body.code !== "string") {
        setDenied(true);
        onPendingCount(null);
        return false;
      }
      if (!response.ok) {
        setFailure(failureFromResponse(response.status, false));
        onPendingCount(null);
        return false;
      }
      const parsed = parseUsersListReply(body.list);
      const now = Date.now();
      for (const [personId, value] of recentDecisionMarks.current) {
        if (value.until <= now) recentDecisionMarks.current.delete(personId);
      }
      parsed.people.rows = parsed.people.rows.map((row) => {
        const recent = recentDecisionMarks.current.get(row.id);
        return recent ? { ...row, tableMark: recent.mark } : row;
      });
      latestList.current = parsed;
      setList(parsed);
      const settle = afterDecision.current;
      afterDecision.current = null;
      settle?.(parsed);
      setBulk(null);
      setLastGoodAt(new Date().toISOString());
      setFailure(null);
      setDenied(false);
      onPendingCount(parsed.pendingTotalAll);
      void Promise.all([...openHistoryKeysRef.current].map((nicknameKey) => loadHistory(nicknameKey)));
      return parsed;
    } catch (error) {
      if (requestId !== requestEpoch.current) return;
      setFailure(error instanceof TypeError ? "offline" : "unexpected");
      onPendingCount(null);
      return false;
    } finally {
      if (requestId === requestEpoch.current) setRetrying(false);
    }
  }, [debouncedQuery, loadHistory, onPendingCount]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const update = () => setIsPhone(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!visible || document.visibilityState !== "visible") return;
    queueMicrotask(() => void load());
    const poll = () => { if (document.visibilityState === "visible") void load(); };
    const timer = window.setInterval(poll, 10_000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [load, visible]);

  const openDialog = useCallback((context: RowContext, opener: HTMLButtonElement) => {
    openerRef.current = opener;
    setDialogContext(context);
    if (context.section !== "pending") void loadHistory(context.row.source.nicknameKey);
  }, [loadHistory]);
  const closeDialog = useCallback(() => {
    setDialogContext(null);
    queueMicrotask(() => openerRef.current?.focus());
  }, []);

  // PC (D-12): picking a row opens it in the detail pane; its history is always open there and reloads with the list.
  const selectRow = useCallback((context: RowContext) => {
    afterDecision.current = null; // a pick of the user wins over the pending follow-up of a decision
    setSelectedKey(context.row.key);
    const nicknameKey = context.row.source.nicknameKey;
    const next = new Set<string>(context.section === "pending" ? [] : [nicknameKey]);
    openHistoryKeysRef.current = next;
    setOpenHistoryKeys(next);
    if (context.section !== "pending") void loadHistory(nicknameKey);
  }, [loadHistory]);

  const clearSelection = useCallback(() => {
    setSelectedKey(null);
    const none = new Set<string>();
    openHistoryKeysRef.current = none;
    setOpenHistoryKeys(none);
  }, []);

  const switchSection = useCallback((kind: UsersSectionKind) => {
    afterDecision.current = null;
    setActiveSection(kind);
    clearSelection();
  }, [clearSelection]);

  const postAction = useCallback(async (context: RowContext, action: RowAction, body: Record<string, unknown>, fromPhone: boolean) => {
    const noteKey = context.row.source.nicknameKey;
    const decidedKey = context.row.key;
    const rowsBefore = latestList.current ? buildUsersView(latestList.current, "", new Date())[context.section].rows : [];
    setBusy({ key: context.row.key, action });
    setNotes((current) => { const next = { ...current }; delete next[noteKey]; return next; });
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(body),
      });
      const responseJson = await responseBody(response);
      const code = typeof responseJson.code === "string" ? responseJson.code : null;
      if (!code) throw new Error("unexpected-reply");
      if (code === "approved" && typeof responseJson.level === "number") {
        if (typeof responseJson.personId === "string" && ["yes", "no", "unknown"].includes(String(responseJson.tableMark))) {
          recentDecisionMarks.current.set(responseJson.personId, { mark: responseJson.tableMark as TableMark, until: Date.now() + 25_000 });
        }
        setAnnouncement(usersCopy.approved(context.row.nickname, responseJson.level));
      } else if (code === "rejected") {
        setAnnouncement(usersCopy.rejected(context.row.nickname));
      } else if ((code === "updated" || code === "unchanged") && typeof responseJson.level === "number") {
        setAnnouncement(usersCopy.levelChanged(context.row.nickname, responseJson.level));
      } else if (code === "revoked") {
        setAnnouncement(usersCopy.revoked(context.row.nickname));
      } else if (code === "cleared") {
        setAnnouncement(usersCopy.cleared);
      } else if (["already-decided", "not-found", "self", "owner", "stale", "not-active", "already-revoked", "no-cooldown", "level-change-separate", "level-above-own"].includes(code)) {
        setNotes((current) => ({ ...current, [noteKey]: resultNote(code) }));
      } else {
        throw new Error("unexpected-reply");
      }
      setDialogContext(null);
      setConfirmState(null);
      // WR-03: the follow-up is bound to the next accepted list, not to the return value of this load(): a poll or a query that took over
      // the epoch makes this load() return nothing, but its own list still carries the decision.
      afterDecision.current = (refreshed) => {
        if (fromPhone) focusAfterRefresh(context.section, context.index);
        else {
          // PC (D-12, T-26-20): the decided row stays picked while it is still in its section (a level change, a refusal note);
          // otherwise the next row of the section is picked and focused, none left — the section's button. Picking performs nothing.
          const rowsAfter = buildUsersView(refreshed, "", new Date())[context.section].rows;
          const candidate = rowsAfter.some((row) => row.key === decidedKey) ? decidedKey : nextUsersSelection(rowsBefore, decidedKey);
          const nextIndex = candidate === null ? -1 : rowsAfter.findIndex((row) => row.key === candidate);
          if (nextIndex >= 0) selectRow({ row: rowsAfter[nextIndex], section: context.section, index: nextIndex });
          else clearSelection();
          focusPcSelection(context.section, nextIndex >= 0 ? rowsAfter[nextIndex].key : null);
        }
      };
      // false: this reload itself failed or was refused, so there is no list to follow; undefined: a newer request owns the epoch and settles it.
      if ((await load()) === false) afterDecision.current = null;
    } catch {
      setNotes((current) => ({ ...current, [noteKey]: usersCopy.actionFailed }));
      setDialogContext(null);
      setConfirmState(null);
      queueMicrotask(() => confirmReturnRef.current?.focus());
    } finally {
      setBusy(null);
    }
  }, [clearSelection, load, selectRow]);

  const approve = useCallback((context: RowContext, level: AccessLevel | undefined, fromPhone: boolean) => {
    if (!("canDecide" in context.row.source)) return;
    if (fromPhone) confirmReturnRef.current = openerRef.current;
    void postAction(context, "approve", {
      action: "approve",
      requestId: context.row.source.id,
      ...(level === undefined ? {} : { level }),
    }, fromPhone);
  }, [postAction]);

  const requestReject = useCallback((context: RowContext, opener: HTMLButtonElement, fromPhone: boolean) => {
    if (!("canDecide" in context.row.source)) return;
    confirmReturnRef.current = fromPhone ? openerRef.current : opener;
    if (fromPhone) setDialogContext(null);
    setConfirmState({ kind: "reject", context, fromPhone });
  }, []);

  const setLevel = useCallback((context: RowContext, level: AccessLevel, fromPhone: boolean) => {
    if (!("canSetLevel" in context.row.source)) return;
    if (fromPhone) confirmReturnRef.current = openerRef.current;
    void postAction(context, "set-level", {
      action: "set-level",
      personId: context.row.source.id,
      level,
      expectedLevel: context.row.source.level,
    }, fromPhone);
  }, [postAction]);

  const requestRevoke = useCallback((context: RowContext, opener: HTMLButtonElement, fromPhone: boolean) => {
    if (!("canRevoke" in context.row.source)) return;
    confirmReturnRef.current = fromPhone ? openerRef.current : opener;
    if (fromPhone) setDialogContext(null);
    setConfirmState({ kind: "revoke", context, fromPhone });
  }, []);

  const clearCooldown = useCallback((context: RowContext, fromPhone: boolean) => {
    if (!("retryAt" in context.row.source) || !callerIsOwner) return;
    if (fromPhone) confirmReturnRef.current = openerRef.current;
    void postAction(context, "clear-cooldown", { action: "clear-cooldown", nicknameKey: context.row.source.nicknameKey }, fromPhone);
  }, [callerIsOwner, postAction]);

  const cancelConfirm = useCallback(() => {
    setConfirmState(null);
    queueMicrotask(() => confirmReturnRef.current?.focus());
  }, []);

  const openBulk = useCallback(async () => {
    if (!callerIsOwner || bulkLoading) return;
    setBulkLoading(true);
    try {
      const response = await fetch("/api/users?view=bulk", { cache: "no-store" });
      const body = await responseBody(response);
      if (!response.ok) throw new Error("bulk-unavailable");
      const parsed = parseUsersBulk(body);
      setBulk(parsed);
      if (parsed.roster === "ok" && parsed.eligible.length > 0) {
        setBulkProgressText("");
        setBulkDialog(parsed);
      }
    } catch {
      setAnnouncement(usersCopy.actionFailed);
    } finally {
      setBulkLoading(false);
    }
  }, [bulkLoading, callerIsOwner]);

  const closeBulk = useCallback(() => {
    if (!bulkRunning) setBulkDialog(null);
  }, [bulkRunning]);

  const approveBulk = useCallback(async () => {
    if (!bulkDialog || bulkRunning || !callerIsOwner) return;
    setBulkRunning(true);
    const result = { approved: 0, already: 0, failed: 0 };
    let completed = 0;
    setBulkProgressText(bulkProgress(0, bulkDialog.eligible.length));
    for (const candidate of bulkDialog.eligible) {
      try {
        const response = await fetch("/api/users", {
          method: "POST",
          headers: { "content-type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ action: "approve", requestId: candidate.id, level: 2, bulk: true }),
        });
        const body = await responseBody(response);
        if (response.ok && body.code === "approved") result.approved += 1;
        else if (response.ok && body.code === "already-decided") result.already += 1;
        else result.failed += 1;
      } catch {
        result.failed += 1;
      }
      completed += 1;
      setBulkProgressText(bulkProgress(completed, bulkDialog.eligible.length));
    }
    setAnnouncement(bulkSummary(result));
    setBulkDialog(null);
    setBulkRunning(false);
    await load();
  }, [bulkDialog, bulkRunning, callerIsOwner, load]);

  if (denied) return <AppDeniedPanel />;
  if (!list && failure) return <AppFatalPanel failure={failure} retrying={retrying} onRetry={() => void load()} illustration="flaskEmpty" />;
  if (!list) return <AppSkeleton shape="employees" />;

  const view = buildUsersView(list, debouncedQuery, new Date());
  const searchEmpty = view.emptyKind === "search";
  const ownerBulk = bulkButtonState({ ...list, callerIsOwner }, bulk);
  // WR-06: the stale line rides inside the sticky bar (PC, or the draft bar of a phone), so the bar never covers it.
  const staleBanner = failure && lastGoodAt ? <AppStaleBanner lastGoodAt={lastGoodAt} retrying={retrying} onRetry={() => void load()} /> : null;
  const handlers: ActionHandlers = { onApprove: approve, onReject: requestReject, onSetLevel: setLevel, onRevoke: requestRevoke, onClearCooldown: clearCooldown };
  const activeView = view[activeSection];
  const selectedIndex = selectedKey === null ? -1 : activeView.rows.findIndex((row) => row.key === selectedKey);
  const selectedContext: RowContext | null = selectedIndex >= 0 ? { row: activeView.rows[selectedIndex], section: activeSection, index: selectedIndex } : null;

  return (
    <div className="users-tab">
      {!isPhone ? <EditorActionBar
        label={usersCopy.sectionsLabel}
        nav={<nav className="users-sections" aria-label={usersCopy.sectionsLabel}>
          {USERS_SECTIONS.map((kind) => (
            <button key={kind} type="button" data-users-tab={kind} aria-current={activeSection === kind ? "true" : undefined} onClick={() => switchSection(kind)}>
              {usersCopy.sectionTab(usersCopy.sectionTitles[kind], list[kind].total)}
            </button>
          ))}
        </nav>}
        statusText={usersCopy.pendingStatus(list.pendingTotalAll)}
        actions={callerIsOwner && ownerBulk.visible ? <button type="button" className="primary-control" disabled={ownerBulk.disabled || bulkLoading} onClick={() => void openBulk()}>{usersCopy.bulkButton}</button> : undefined}
        banner={staleBanner}
      /> : <EditorDraftBar banner={staleBanner} />}
      <p role="status" aria-live="polite">{announcement}</p>
      <label className="editor-field users-search">
        <span>{usersCopy.searchLabel}</span>
        <input type="search" maxLength={20} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder={usersCopy.searchPlaceholder} value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {searchEmpty ? <EmptyState kind="search" /> : null}
      {isPhone ? (
        <>
          <section data-users-section="pending" aria-labelledby="users-pending-title">
            <div className="users-pending-head">
              <h2 id="users-pending-title" tabIndex={-1}>{view.pending.title}</h2>
              {callerIsOwner && ownerBulk.visible ? <button type="button" className="secondary-control" disabled={ownerBulk.disabled || bulkLoading} onClick={() => void openBulk()}>{usersCopy.bulkButton}</button> : null}
              {ownerBulk.caption ? <p role="status">{ownerBulk.caption}</p> : null}
            </div>
            {!searchEmpty && view.pending.emptyKind ? <EmptyState kind={view.pending.emptyKind} /> : null}
            <UsersRows rows={view.pending.rows} section="pending" isPhone busy={busy} notes={notes} onOpen={openDialog} />
            {view.pending.truncated ? <p className="users-truncated">{usersCopy.truncated}</p> : null}
          </section>
          <section data-users-section="people" aria-labelledby="users-people-title">
            <h2 id="users-people-title" tabIndex={-1}>{view.people.title}</h2>
            <p className="users-moscow-note">{usersCopy.moscowNote}</p>
            {!searchEmpty && view.people.emptyKind ? <EmptyState kind={view.people.emptyKind} /> : null}
            <UsersRows rows={view.people.rows} section="people" isPhone busy={busy} notes={notes} onOpen={openDialog} />
            {view.people.truncated ? <p className="users-truncated">{usersCopy.truncated}</p> : null}
          </section>
          <details className="users-closed" data-users-section="closed">
            <summary tabIndex={-1}>{view.closed.title}</summary>
            {!searchEmpty && view.closed.emptyKind ? <EmptyState kind={view.closed.emptyKind} /> : null}
            <UsersRows rows={view.closed.rows} section="closed" isPhone busy={busy} notes={notes} onOpen={openDialog} />
            {view.closed.truncated ? <p className="users-truncated">{usersCopy.truncated}</p> : null}
          </details>
        </>
      ) : (
        <>
          <p className="users-moscow-note">{usersCopy.moscowNote}</p>
          {ownerBulk.caption ? <p className="users-bulk-caption" role="status">{ownerBulk.caption}</p> : null}
          <EditorTabBody
            list={<div className="users-pane" data-users-section={activeSection}>
              {!searchEmpty && activeView.emptyKind ? <EmptyState kind={activeView.emptyKind} /> : null}
              <UsersRows rows={activeView.rows} section={activeSection} isPhone={false} busy={busy} notes={notes} selectedKey={selectedKey} onSelect={selectRow} onOpen={openDialog} />
              {activeView.truncated ? <p className="users-truncated">{usersCopy.truncated}</p> : null}
            </div>}
            detail={selectedContext ? <UsersActionBody key={selectedContext.row.key} context={selectedContext} titleId={detailTitleId} historyId={`users-detail-history-${selectedContext.row.source.nicknameKey}`} historyState={historyByKey[selectedContext.row.source.nicknameKey]} fromPhone={false} callerIsOwner={callerIsOwner} busy={busy} handlers={handlers} />
              : <EditorEmptyDetail title={usersCopy.detailEmptyTitle} lines={[usersCopy.detailEmptyHint]} />}
          />
        </>
      )}
      {dialogContext ? <UsersActionDialog context={dialogContext} callerIsOwner={callerIsOwner} busy={busy} handlers={handlers} historyState={historyByKey[dialogContext.row.source.nicknameKey]} onClose={closeDialog} /> : null}
      {bulkDialog ? <UsersBulkDialog bulkDialog={bulkDialog} bulkRunning={bulkRunning} progress={bulkProgressText} onApprove={() => void approveBulk()} onClose={closeBulk} /> : null}
      {confirmState ? (
        <ConfirmDialog
          title={confirmState.kind === "reject" ? usersCopy.rejectDialog.title : usersCopy.revokeDialog.title}
          text={confirmState.kind === "reject" ? usersCopy.rejectDialog.text(confirmState.context.row.nickname) : usersCopy.revokeDialog.text(confirmState.context.row.nickname)}
          onCancel={cancelConfirm}
          actions={[
            {
              label: confirmState.kind === "reject"
                ? (busy?.action === "reject" ? usersCopy.rejecting : usersCopy.rejectDialog.danger)
                : (busy?.action === "revoke" ? usersCopy.revoking : usersCopy.revokeDialog.danger),
              tone: "danger",
              disabled: busy !== null,
              onClick: () => {
                const { context, kind, fromPhone } = confirmState;
                if (kind === "reject" && "canDecide" in context.row.source) {
                  void postAction(context, "reject", { action: "reject", requestId: context.row.source.id }, fromPhone);
                }
                if (kind === "revoke" && "canRevoke" in context.row.source) {
                  void postAction(context, "revoke", { action: "revoke", personId: context.row.source.id }, fromPhone);
                }
              },
            },
            {
              label: confirmState.kind === "reject" ? usersCopy.rejectDialog.safe : usersCopy.revokeDialog.safe,
              tone: "secondary",
              autoFocus: true,
              disabled: busy !== null,
              onClick: cancelConfirm,
            },
          ]}
        />
      ) : null}
    </div>
  );
}

export function UsersTabCount({ count }: { count: number | null }) {
  const text = pendingBadgeText(count);
  if (text === null || count === null) return null;
  return <><span className="tab-count" aria-hidden="true">{text}</span><span className="sr-only">{usersCopy.tabPendingSuffix(count)}</span></>;
}

export function useUsersPendingCount({ enabled, visible, tabActive }: { enabled: boolean; visible: boolean; tabActive: boolean }) {
  const [count, setCount] = useState<number | null>(null);
  const report = useCallback((count: number | null) => setCount(count), []);

  useEffect(() => {
    if (!enabled) {
      queueMicrotask(() => setCount(null));
      return;
    }
    let cancelled = false;
    const publish = (value: number | null) => { if (!cancelled) setCount(value); };
    const load = async () => {
      try {
        const response = await fetch("/api/users?view=count", { cache: "no-store" });
        if (!response.ok) return publish(null);
        publish(parseUsersCount(await responseBody(response)));
      } catch {
        publish(null);
      }
    };
    queueMicrotask(() => void load());
    if (!visible) return () => { cancelled = true; };
    const poll = () => { if (document.visibilityState === "visible") void load(); };
    const timer = window.setInterval(poll, 30_000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [enabled, visible, tabActive]);

  return { count: enabled ? count : null, report };
}
