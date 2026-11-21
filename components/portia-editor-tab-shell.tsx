"use client";

import { createContext, useContext, useId, useState, type KeyboardEvent, type ReactNode } from "react";

// Phase 26 (UI-04, D-12, D-13): one layout for the editor tabs. The editor file only calls these parts (D-21), so the Russian
// texts of the layout live here. Every text goes through React, never through raw HTML (T-26-11).

/** The empty detail pane of a tab with a list (D-12): a heading and two short lines. */
export const emptyDetailCopy = {
  title: "Выберите запись",
  lines: ["Она откроется справа.", "Выберите строку в списке слева."],
} as const;

/** Review WR-01: the name of the row that shows the shared draft on a tab that is not a draft tab. */
export const draftCopy = { label: "ЧЕРНОВИК", group: "Черновик редактора", bar: "Панель черновика" } as const;

/** What the shared draft shows on a tab outside the draft tabs: the same status, reasons and buttons as the draft tabs' bar. */
export type EditorDraftBarState = {
  statusText: string;
  tone?: string;
  unsavedCount?: number;
  notice?: string;
  actions?: ReactNode;
  messages?: ReactNode[];
};

/**
 * Review WR-01: the draft is shared by every tab. The editor provides it while a tab outside the draft tabs has something unsaved or a save
 * in flight; the sticky bar of that tab (EditorActionBar) then carries one more row, and a tab without a bar of its own renders EditorDraftBar.
 * One sticky element per tab, so two bars never stack at the same edge.
 */
export const EditorDraftBarContext = createContext<EditorDraftBarState | null>(null);

function statusLine(statusText: string, unsavedCount: number, notice?: string) {
  const shown = notice || statusText;
  const unsaved = unsavedCount > 0 ? `Не сохранено: ${unsavedCount}` : "";
  return [shown, unsaved].filter(Boolean).join(" · ");
}

function DraftRow({ draft }: { draft: EditorDraftBarState }) {
  const status = statusLine(draft.statusText, draft.unsavedCount ?? 0, draft.notice);
  return (
    <div className="etab-draft" role="group" aria-label={draftCopy.group}>
      <span className="etab-draft-label">{draftCopy.label}</span>
      <p className={`etab-status etab-draft-status editor-save-status ${draft.notice ? "saved" : draft.tone ?? ""}`} title={status || undefined}>{status}</p>
      {draft.actions && <div className="etab-actions">{draft.actions}</div>}
    </div>
  );
}

/** The reasons of a refused save as alert lines under a bar; an empty slot renders nothing, so the keys of the others stay put. */
function BarMessages({ messages }: { messages: ReactNode[] }) {
  return <>{messages.map((message, index) => (message ? <p key={index} className="etab-message" role="alert">{message}</p> : null))}</>;
}

/** 26.1-20 (owner 2026-11-21): what the mark says when only a server notice is on and nothing is unsaved. */
export const unsavedCopy = { notice: "Есть сообщение", details: "Состояние сохранения" } as const;

/**
 * 26.1-20 (owner 2026-11-21, item 20): the unsaved changes are one small mark at the right end of the bar, so the section tabs keep the room the long line took.
 * The full line and the reasons of a refused save stand in the details: shown on hover and on focus, closed by Escape. They are always in the tree
 * (hidden by the sheet until `data-open`), so a screen reader reads each reason as an alert and the keyboard reaches a button inside a reason.
 */
function UnsavedMark({ unsavedCount, notice, tone, status, messages }: { unsavedCount: number; notice?: string; tone: string; status: string; messages: ReactNode[] }) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || !open) return;
    event.stopPropagation();
    setOpen(false);
  };
  return (
    <div
      className="etab-unsaved"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
      onKeyDown={onKeyDown}
    >
      <button type="button" className="etab-unsaved-mark" data-tone={notice ? "saved" : tone || "dirty"} aria-expanded={open} aria-controls={detailsId} onClick={() => setOpen((value) => !value)}>
        <span className="etab-unsaved-dot" aria-hidden="true" />
        {unsavedCount > 0 ? `Не сохранено: ${unsavedCount}` : unsavedCopy.notice}
      </button>
      <div className="etab-unsaved-details" id={detailsId} role="group" aria-label={unsavedCopy.details} data-open={open || undefined}>
        <p className="etab-unsaved-status">{status}</p>
        <BarMessages messages={messages} />
      </div>
    </div>
  );
}

/**
 * D-13b: the sticky action bar of a tab — nav · status · actions — and the reasons of a refused save as alert lines under it.
 * `statusText` is the existing saveStatusText vocabulary; the server's `notice` takes its place while there is one.
 * `messages` keeps its slots: an empty slot renders nothing, so the keys of the others stay put.
 */
export function EditorActionBar({ label, nav, statusText, tone = "", unsavedCount = 0, notice, actions, messages = [], banner }: {
  label: string;
  nav?: ReactNode;
  statusText: string;
  tone?: string;
  unsavedCount?: number;
  notice?: string;
  actions?: ReactNode;
  messages?: ReactNode[];
  /** Review WR-06: a sticky warning (the «data is stale» line) rides inside the bar, as its last row, so the bar never covers it. */
  banner?: ReactNode;
}) {
  const draft = useContext(EditorDraftBarContext);
  const status = statusLine(statusText, unsavedCount, notice);
  // 26.1-20: with something unsaved (or a notice) the long line and the reasons give way to the mark at the right end of the bar; the line stays the one live region, only its look changes.
  const compact = unsavedCount > 0 || Boolean(notice);
  return (
    <>
      <section className="etab-bar" aria-label={label}>
        {nav && <div className="etab-nav">{nav}</div>}
        <p className={`etab-status editor-save-status ${notice ? "saved" : tone}`} role="status" aria-live="polite" data-compact={compact || undefined} title={status || undefined}>{status}</p>
        {actions && <div className="etab-actions">{actions}</div>}
        {compact && <UnsavedMark unsavedCount={unsavedCount} notice={notice} tone={tone} status={status} messages={messages} />}
        {draft && <DraftRow draft={draft} />}
        {banner && <div className="etab-banner">{banner}</div>}
      </section>
      {!compact && <BarMessages messages={messages} />}
      {draft?.messages && <BarMessages messages={draft.messages} />}
    </>
  );
}

/** Review WR-01: the bar of a tab that has none (the access tab, the phone list of «Пользователи») while the shared draft is unsaved; nothing without a draft state. */
export function EditorDraftBar({ banner }: { banner?: ReactNode } = {}) {
  const draft = useContext(EditorDraftBarContext);
  // Without a draft there is no bar: the banner then stands alone, as it did before the bar existed.
  if (!draft) return banner ? <>{banner}</> : null;
  return (
    <>
      <section className="etab-bar etab-draft-bar" aria-label={draftCopy.bar}>
        <DraftRow draft={draft} />
        {banner && <div className="etab-banner">{banner}</div>}
      </section>
      {draft.messages && <BarMessages messages={draft.messages} />}
    </>
  );
}

/** D-12: list on the left, detail on the right; a tab without a list renders only the detail, never an empty column. */
export function EditorTabBody({ list, detail }: { list?: ReactNode; detail: ReactNode }) {
  return (
    <div className="etab-body" data-detail-only={list ? undefined : true}>
      {list && <div className="etab-list">{list}</div>}
      <div className="etab-detail">{detail}</div>
    </div>
  );
}

/** D-12: what the detail pane shows while no row is picked. */
export function EditorEmptyDetail({ title = emptyDetailCopy.title, lines = emptyDetailCopy.lines }: { title?: string; lines?: readonly string[] }) {
  return (
    <div className="etab-detail etab-empty">
      <strong>{title}</strong>
      {lines.map((line) => <p key={line}>{line}</p>)}
    </div>
  );
}
