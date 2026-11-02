"use client";

import type { ReactNode } from "react";
import { PortiaIllustration, type PortiaIllustrationName } from "@/components/portia-icons";
import { failureCopy, iframeFailureCopy, staleBannerText, type AppFailure } from "@/lib/app-state";

// D-05: last-good data stays on screen; this strip says so and offers one retry. Rendered only while a failure and a last-good time are both known.
export function AppStaleBanner({ lastGoodAt, retrying, onRetry }: { lastGoodAt: string; retrying: boolean; onRetry: () => void }) {
  return (
    <div className="app-stale-banner" role="status" aria-live="polite">
      <span>{staleBannerText(lastGoodAt, new Date())}</span>
      <button type="button" className="app-state-action" disabled={retrying} onClick={onRetry}>{retrying ? "Обновляем…" : "Повторить обновление"}</button>
    </div>
  );
}

// D-06: the first load failed and there is nothing to show. The window stays open; the reason is a fixed phrase, never a status code (T-19-02).
// The alert role wraps only the reason, so a retry (which changes just the button) does not announce the panel again.
export function AppFatalPanel({ failure, retrying, onRetry, illustration, extra }: { failure: AppFailure | "iframe"; retrying: boolean; onRetry: () => void; illustration: PortiaIllustrationName; extra?: ReactNode }) {
  const copy = failure === "iframe" ? iframeFailureCopy : failureCopy[failure];
  return (
    <div className="empty-state app-fatal-panel">
      <PortiaIllustration name={illustration} />
      <div className="app-state-reason" role="alert"><strong>{copy.heading}</strong><span>{copy.body}</span></div>
      <div className="app-state-actions">
        <button type="button" className="app-state-action" disabled={retrying} onClick={onRetry}>{retrying ? "Загружаем…" : "Повторить загрузку"}</button>
        {extra}
      </div>
    </div>
  );
}

// D-07: nothing but the fixed heading (and one optional fixed line from the caller); no buttons, no reasons.
export function AppDeniedPanel({ detail }: { detail?: string }) {
  return (
    <div className="empty-state app-denied-panel" role="alert">
      <strong>Доступ закрыт</strong>
      {detail ? <span>{detail}</span> : null}
    </div>
  );
}

const skeletonShapes = {
  archive: { block: "skeleton-row", count: 6 },
  employees: { block: "skeleton-row", count: 8 },
  broadcasts: { block: "skeleton-card", count: 3 },
  info: { block: "skeleton-text", count: 3 },
  guide: { block: "skeleton-tile", count: 6 },
  trash: { block: "skeleton-row", count: 5 },
  document: { block: "skeleton-fill", count: 1 },
};

// D-08: a quiet placeholder with the footprint of the real rows/cards, shown after 150ms; the shimmer is CSS under data-motion="full" only.
export function AppSkeleton({ shape }: { shape: keyof typeof skeletonShapes }) {
  const { block, count } = skeletonShapes[shape];
  return (
    <div className={`app-skeleton app-skeleton-${shape}`} aria-busy="true">
      <span className="sr-only">Загрузка…</span>
      {Array.from({ length: count }, (_, index) => <div key={index} className={`skeleton-block ${block}`} />)}
    </div>
  );
}
