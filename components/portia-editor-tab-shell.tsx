"use client";

import type { ReactNode } from "react";

// Phase 26 (UI-04, D-12, D-13): one layout for the editor tabs. The editor file only calls these parts (D-21), so the Russian
// texts of the layout live here. Every text goes through React, never through raw HTML (T-26-11).

/** The empty detail pane of a tab with a list (D-12): a heading and two short lines. */
export const emptyDetailCopy = {
  title: "Выберите запись",
  lines: ["Она откроется справа.", "Выберите строку в списке слева."],
} as const;

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
  const shown = notice || statusText;
  const unsaved = unsavedCount > 0 ? `Не сохранено: ${unsavedCount}` : "";
  const status = [shown, unsaved].filter(Boolean).join(" · ");
  return (
    <>
      <section className="etab-bar" aria-label={label}>
        {nav && <div className="etab-nav">{nav}</div>}
        <p className={`etab-status editor-save-status ${notice ? "saved" : tone}`} role="status" aria-live="polite" title={status || undefined}>{status}</p>
        {actions && <div className="etab-actions">{actions}</div>}
      </section>
      {messages.map((message, index) => (message ? <p key={index} className="etab-message" role="alert">{message}</p> : null))}
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
