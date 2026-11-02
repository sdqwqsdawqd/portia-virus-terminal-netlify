"use client";

import { staleBannerText } from "@/lib/app-state";

// D-05: last-good data stays on screen; this strip says so and offers one retry. Rendered only while a failure and a last-good time are both known.
export function AppStaleBanner({ lastGoodAt, retrying, onRetry }: { lastGoodAt: string; retrying: boolean; onRetry: () => void }) {
  return (
    <div className="app-stale-banner" role="status" aria-live="polite">
      <span>{staleBannerText(lastGoodAt, new Date())}</span>
      <button type="button" className="app-state-action" disabled={retrying} onClick={onRetry}>{retrying ? "Обновляем…" : "Повторить обновление"}</button>
    </div>
  );
}
