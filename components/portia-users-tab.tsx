"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AppDeniedPanel, AppFatalPanel, AppSkeleton, AppStaleBanner } from "@/components/portia-desktop-states";
import { failureFromResponse, type AppFailure } from "@/lib/app-state";
import { usersCopy } from "@/lib/users-copy";
import { parseUsersCount, parseUsersList, type UsersList } from "@/lib/users-model";
import { buildUsersView, pendingBadgeText, type UsersView } from "@/lib/users-view";

type UsersTabProps = {
  visible: boolean;
  canManageEditors: boolean;
  onPendingCount: (count: number | null) => void;
};

type ViewRow = UsersView["pending"]["rows"][number];

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

function UsersActionDialog({ row, onClose }: { row: ViewRow; onClose: () => void }) {
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
        <div className="portia-dialog-actions">
          <button type="button" className="secondary-control" data-autofocus onClick={onClose}>{usersCopy.closeWindow}</button>
        </div>
      </div>
    </dialog>
  );
}

function UsersRows({ rows, isPhone, onOpen }: { rows: ViewRow[]; isPhone: boolean; onOpen: (row: ViewRow, opener: HTMLButtonElement) => void }) {
  return (
    <ul className="users-list">
      {rows.map((row) => (
        <li className="users-row" key={row.key}>
          {isPhone ? (
            <button type="button" className="users-phone-row" aria-haspopup="dialog" onClick={(event) => onOpen(row, event.currentTarget)}>
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
            </>
          )}
        </li>
      ))}
    </ul>
  );
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
  const [dialogRow, setDialogRow] = useState<ViewRow | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const requestEpoch = useRef(0);
  void canManageEditors;

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
        return;
      }
      if (!response.ok) {
        setFailure(failureFromResponse(response.status, false));
        onPendingCount(null);
        return;
      }
      const parsed = parseUsersList(body.list);
      setList(parsed);
      setLastGoodAt(new Date().toISOString());
      setFailure(null);
      setDenied(false);
      onPendingCount(parsed.pendingTotalAll);
    } catch (error) {
      if (requestId !== requestEpoch.current) return;
      setFailure(error instanceof TypeError ? "offline" : "unexpected");
      onPendingCount(null);
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

  const openDialog = useCallback((row: ViewRow, opener: HTMLButtonElement) => {
    openerRef.current = opener;
    setDialogRow(row);
  }, []);
  const closeDialog = useCallback(() => {
    setDialogRow(null);
    queueMicrotask(() => openerRef.current?.focus());
  }, []);

  if (denied) return <AppDeniedPanel />;
  if (!list && failure) return <AppFatalPanel failure={failure} retrying={retrying} onRetry={() => void load()} illustration="flaskEmpty" />;
  if (!list) return <AppSkeleton shape="employees" />;

  const view = buildUsersView(list, debouncedQuery, new Date());
  const searchEmpty = view.emptyKind === "search";

  return (
    <div className="users-tab">
      <p role="status" aria-live="polite" />
      {failure && lastGoodAt ? <AppStaleBanner lastGoodAt={lastGoodAt} retrying={retrying} onRetry={() => void load()} /> : null}
      <label className="editor-field users-search">
        <span>{usersCopy.searchLabel}</span>
        <input type="search" maxLength={20} autoComplete="off" autoCapitalize="off" spellCheck={false} placeholder={usersCopy.searchPlaceholder} value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {searchEmpty ? <EmptyState kind="search" /> : null}
      <section aria-labelledby="users-pending-title">
        <h2 id="users-pending-title" tabIndex={-1}>{view.pending.title}</h2>
        {!searchEmpty && view.pending.emptyKind ? <EmptyState kind={view.pending.emptyKind} /> : null}
        <UsersRows rows={view.pending.rows} isPhone={isPhone} onOpen={openDialog} />
        {view.pending.truncated ? <p className="users-truncated">{usersCopy.truncated}</p> : null}
      </section>
      <section aria-labelledby="users-people-title">
        <h2 id="users-people-title" tabIndex={-1}>{view.people.title}</h2>
        <p className="users-moscow-note">{usersCopy.moscowNote}</p>
        {!searchEmpty && view.people.emptyKind ? <EmptyState kind={view.people.emptyKind} /> : null}
        <UsersRows rows={view.people.rows} isPhone={isPhone} onOpen={openDialog} />
        {view.people.truncated ? <p className="users-truncated">{usersCopy.truncated}</p> : null}
      </section>
      <details className="users-closed">
        <summary>{view.closed.title}</summary>
        {!searchEmpty && view.closed.emptyKind ? <EmptyState kind={view.closed.emptyKind} /> : null}
        <UsersRows rows={view.closed.rows} isPhone={isPhone} onOpen={openDialog} />
        {view.closed.truncated ? <p className="users-truncated">{usersCopy.truncated}</p> : null}
      </details>
      {dialogRow ? <UsersActionDialog row={dialogRow} onClose={closeDialog} /> : null}
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
