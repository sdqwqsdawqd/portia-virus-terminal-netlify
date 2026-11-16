"use client";

import { createContext, useContext, type ReactNode } from "react";

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

/**
 * D-13b: the sticky action bar of a tab — nav · status · actions — and the reasons of a refused save as alert lines under it.
 * `statusText` is the existing saveStatusText vocabulary; the server's `notice` takes its place while there is one.
 * `messages` keeps its slots: an empty slot renders nothing, so the keys of the others stay put.
 */
export function EditorActionBar({ label, nav, statusText, tone = "", unsavedCount = 0, notice, actions, messages = [] }: {
  label: string;
  nav?: ReactNode;
  statusText: string;
  tone?: string;
  unsavedCount?: number;
  notice?: string;
  actions?: ReactNode;
  messages?: ReactNode[];
}) {
  const draft = useContext(EditorDraftBarContext);
  const status = statusLine(statusText, unsavedCount, notice);
  return (
    <>
      <section className="etab-bar" aria-label={label}>
        {nav && <div className="etab-nav">{nav}</div>}
        <p className={`etab-status editor-save-status ${notice ? "saved" : tone}`} role="status" aria-live="polite" title={status || undefined}>{status}</p>
        {actions && <div className="etab-actions">{actions}</div>}
        {draft && <DraftRow draft={draft} />}
      </section>
      <BarMessages messages={messages} />
      {draft?.messages && <BarMessages messages={draft.messages} />}
    </>
  );
}

/** Review WR-01: the bar of a tab that has none (the access tab, the phone list of «Пользователи») while the shared draft is unsaved; nothing without a draft state. */
export function EditorDraftBar() {
  const draft = useContext(EditorDraftBarContext);
  if (!draft) return null;
  return (
    <>
      <section className="etab-bar etab-draft-bar" aria-label={draftCopy.bar}>
        <DraftRow draft={draft} />
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
