"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AppDeniedPanel, AppFatalPanel, AppSkeleton, AppStaleBanner } from "@/components/portia-desktop-states";
import { ConfirmDialog } from "@/components/portia-editor-dossier";
import { failureFromResponse, type AppFailure } from "@/lib/app-state";
import type { AccessLevel } from "@/lib/access-levels";
import { usersCopy } from "@/lib/users-copy";
import { parseUsersCount, parseUsersList, type UsersList } from "@/lib/users-model";
import { buildUsersView, decisionLevelOptions, pendingBadgeText, resultNote, visibleControls, type UsersView } from "@/lib/users-view";

type UsersTabProps = {
  visible: boolean;
  canManageEditors: boolean;
  onPendingCount: (count: number | null) => void;
};

type ViewRow = UsersView["pending"]["rows"][number];
type UsersSectionKind = "pending" | "people" | "closed";
type RowAction = "approve" | "reject";
type RowContext = { row: ViewRow; section: UsersSectionKind; index: number };
type BusyAction = { key: string; action: RowAction } | null;

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

function RowActions({
  context,
  callerIsOwner,
  fromPhone,
  busy,
  onApprove,
  onReject,
}: {
  context: RowContext;
  callerIsOwner: boolean;
  fromPhone: boolean;
  busy: BusyAction;
  onApprove: (context: RowContext, level: AccessLevel | undefined, fromPhone: boolean) => void;
  onReject: (context: RowContext, opener: HTMLButtonElement, fromPhone: boolean) => void;
}) {
  const controls = visibleControls(context.row.source, callerIsOwner);
  const [level, setLevel] = useState<AccessLevel | null>(controls.levelDefault);
  const rowBusy = busy?.key === context.row.key;
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
    </div>
  );
}

function UsersActionDialog({
  context,
  callerIsOwner,
  busy,
  onApprove,
  onReject,
  onClose,
}: {
  context: RowContext;
  callerIsOwner: boolean;
  busy: BusyAction;
  onApprove: (context: RowContext, level: AccessLevel | undefined, fromPhone: boolean) => void;
  onReject: (context: RowContext, opener: HTMLButtonElement, fromPhone: boolean) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { row } = context;

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
        <h2 id={titleId}>{row.nickname}</h2>
        <dl>
          <div><dt>{usersCopy.typeLabel}</dt><dd>{row.typePlaque}</dd></div>
          <div><dt>{usersCopy.profileLabel}</dt><dd><ProfileLink row={row} /></dd></div>
        </dl>
        <RowCaption row={row} />
        <RowActions context={context} callerIsOwner={callerIsOwner} fromPhone busy={busy} onApprove={onApprove} onReject={onReject} />
        <div className="portia-dialog-actions">
          <button type="button" className="secondary-control" data-autofocus onClick={onClose}>{usersCopy.closeWindow}</button>
        </div>
      </div>
    </dialog>
  );
}

function UsersRows({
  rows,
  section,
  isPhone,
  callerIsOwner,
  busy,
  notes,
  onOpen,
  onApprove,
  onReject,
}: {
  rows: ViewRow[];
  section: UsersSectionKind;
  isPhone: boolean;
  callerIsOwner: boolean;
  busy: BusyAction;
  notes: Readonly<Record<string, string>>;
  onOpen: (context: RowContext, opener: HTMLButtonElement) => void;
  onApprove: (context: RowContext, level: AccessLevel | undefined, fromPhone: boolean) => void;
  onReject: (context: RowContext, opener: HTMLButtonElement, fromPhone: boolean) => void;
}) {
  return (
    <ul className="users-list">
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
            <>
              <strong className="users-nickname" title={row.nickname}>{row.nickname}</strong>
              {row.typePlaque !== row.statusPlaque ? <span className="users-plaque">{row.typePlaque}</span> : null}
              <span className={`users-plaque${row.statusPlaque === usersCopy.pendingPlaque ? " warning" : row.typePlaque === row.statusPlaque ? " danger" : ""}`}>{row.statusPlaque}</span>
              <ProfileLink row={row} />
              <RowCaption row={row} />
              <RowActions context={context} callerIsOwner={callerIsOwner} fromPhone={false} busy={busy} onApprove={onApprove} onReject={onReject} />
            </>
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
  const [confirmContext, setConfirmContext] = useState<RowContext | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [announcement, setAnnouncement] = useState("");
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const confirmReturnRef = useRef<HTMLElement | null>(null);
  const requestEpoch = useRef(0);

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
      const parsed = parseUsersList(body.list);
      setList(parsed);
      setLastGoodAt(new Date().toISOString());
      setFailure(null);
      setDenied(false);
      onPendingCount(parsed.pendingTotalAll);
      return true;
    } catch (error) {
      if (requestId !== requestEpoch.current) return;
      setFailure(error instanceof TypeError ? "offline" : "unexpected");
      onPendingCount(null);
      return false;
    } finally {
      if (requestId === requestEpoch.current) setRetrying(false);
    }
  }, [debouncedQuery, onPendingCount]);

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
  }, []);
  const closeDialog = useCallback(() => {
    setDialogContext(null);
    queueMicrotask(() => openerRef.current?.focus());
  }, []);

  const postAction = useCallback(async (context: RowContext, action: RowAction, body: Record<string, unknown>) => {
    const noteKey = context.row.source.nicknameKey;
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
        setAnnouncement(usersCopy.approved(context.row.nickname, responseJson.level));
      } else if (code === "rejected") {
        setAnnouncement(usersCopy.rejected(context.row.nickname));
      } else if (["already-decided", "not-found", "self", "owner", "level-change-separate", "level-above-own"].includes(code)) {
        setNotes((current) => ({ ...current, [noteKey]: resultNote(code) }));
      } else {
        throw new Error("unexpected-reply");
      }
      setDialogContext(null);
      setConfirmContext(null);
      if (await load()) focusAfterRefresh(context.section, context.index);
    } catch {
      setNotes((current) => ({ ...current, [noteKey]: usersCopy.actionFailed }));
      setDialogContext(null);
      setConfirmContext(null);
      queueMicrotask(() => confirmReturnRef.current?.focus());
    } finally {
      setBusy(null);
    }
  }, [load]);

  const approve = useCallback((context: RowContext, level: AccessLevel | undefined, fromPhone: boolean) => {
    if (!("canDecide" in context.row.source)) return;
    if (fromPhone) confirmReturnRef.current = openerRef.current;
    void postAction(context, "approve", {
      action: "approve",
      requestId: context.row.source.id,
      ...(level === undefined ? {} : { level }),
    });
  }, [postAction]);

  const requestReject = useCallback((context: RowContext, opener: HTMLButtonElement, fromPhone: boolean) => {
    if (!("canDecide" in context.row.source)) return;
    confirmReturnRef.current = fromPhone ? openerRef.current : opener;
    if (fromPhone) setDialogContext(null);
    setConfirmContext(context);
  }, []);

  const cancelConfirm = useCallback(() => {
    setConfirmContext(null);
    queueMicrotask(() => confirmReturnRef.current?.focus());
  }, []);

  if (denied) return <AppDeniedPanel />;
  if (!list && failure) return <AppFatalPanel failure={failure} retrying={retrying} onRetry={() => void load()} illustration="flaskEmpty" />;
  if (!list) return <AppSkeleton shape="employees" />;

  const view = buildUsersView(list, debouncedQuery, new Date());
  const callerIsOwner = list.callerIsOwner && canManageEditors;
  const searchEmpty = view.emptyKind === "search";

  return (
    <div className="users-tab">
      <p role="status" aria-live="polite">{announcement}</p>
      {failure && lastGoodAt ? <AppStaleBanner lastGoodAt={lastGoodAt} retrying={retrying} onRetry={() => void load()} /> : null}
      <label className="editor-field users-search">
        <span>{usersCopy.searchLabel}</span>
        <input type="search" maxLength={20} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder={usersCopy.searchPlaceholder} value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {searchEmpty ? <EmptyState kind="search" /> : null}
      <section data-users-section="pending" aria-labelledby="users-pending-title">
        <h2 id="users-pending-title" tabIndex={-1}>{view.pending.title}</h2>
        {!searchEmpty && view.pending.emptyKind ? <EmptyState kind={view.pending.emptyKind} /> : null}
        <UsersRows rows={view.pending.rows} section="pending" isPhone={isPhone} callerIsOwner={callerIsOwner} busy={busy} notes={notes} onOpen={openDialog} onApprove={approve} onReject={requestReject} />
        {view.pending.truncated ? <p className="users-truncated">{usersCopy.truncated}</p> : null}
      </section>
      <section data-users-section="people" aria-labelledby="users-people-title">
        <h2 id="users-people-title" tabIndex={-1}>{view.people.title}</h2>
        <p className="users-moscow-note">{usersCopy.moscowNote}</p>
        {!searchEmpty && view.people.emptyKind ? <EmptyState kind={view.people.emptyKind} /> : null}
        <UsersRows rows={view.people.rows} section="people" isPhone={isPhone} callerIsOwner={callerIsOwner} busy={busy} notes={notes} onOpen={openDialog} onApprove={approve} onReject={requestReject} />
        {view.people.truncated ? <p className="users-truncated">{usersCopy.truncated}</p> : null}
      </section>
      <details className="users-closed" data-users-section="closed">
        <summary tabIndex={-1}>{view.closed.title}</summary>
        {!searchEmpty && view.closed.emptyKind ? <EmptyState kind={view.closed.emptyKind} /> : null}
        <UsersRows rows={view.closed.rows} section="closed" isPhone={isPhone} callerIsOwner={callerIsOwner} busy={busy} notes={notes} onOpen={openDialog} onApprove={approve} onReject={requestReject} />
        {view.closed.truncated ? <p className="users-truncated">{usersCopy.truncated}</p> : null}
      </details>
      {dialogContext ? <UsersActionDialog context={dialogContext} callerIsOwner={callerIsOwner} busy={busy} onApprove={approve} onReject={requestReject} onClose={closeDialog} /> : null}
      {confirmContext ? (
        <ConfirmDialog
          title={usersCopy.rejectDialog.title}
          text={usersCopy.rejectDialog.text(confirmContext.row.nickname)}
          onCancel={cancelConfirm}
          actions={[
            {
              label: busy?.action === "reject" ? usersCopy.rejecting : usersCopy.rejectDialog.danger,
              tone: "danger",
              disabled: busy !== null,
              onClick: () => {
                if ("canDecide" in confirmContext.row.source) {
                  void postAction(confirmContext, "reject", { action: "reject", requestId: confirmContext.row.source.id });
                }
              },
            },
            { label: usersCopy.rejectDialog.safe, tone: "secondary", autoFocus: true, disabled: busy !== null, onClick: cancelConfirm },
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
