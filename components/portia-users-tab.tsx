"use client";

import { useCallback, useEffect, useState } from "react";
import { AppDeniedPanel, AppFatalPanel, AppSkeleton } from "@/components/portia-desktop-states";
import { failureFromResponse, type AppFailure } from "@/lib/app-state";
import { parseUsersList, type UsersList } from "@/lib/users-model";

type UsersTabProps = {
  visible: boolean;
  canManageEditors: boolean;
  onPendingCount: (count: number | null) => void;
};

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  try { return await response.json() as Record<string, unknown>; } catch { return {}; }
}

export function UsersTab({ visible, canManageEditors, onPendingCount }: UsersTabProps) {
  const [list, setList] = useState<UsersList | null>(null);
  const [failure, setFailure] = useState<AppFailure | null>(null);
  const [denied, setDenied] = useState(false);
  const [retrying, setRetrying] = useState(false);
  void canManageEditors;

  const load = useCallback(async () => {
    setRetrying(true);
    try {
      const response = await fetch("/api/users?view=list", { cache: "no-store" });
      const body = await responseBody(response);
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
      setFailure(null);
      setDenied(false);
      onPendingCount(parsed.pendingTotalAll);
    } catch (error) {
      setFailure(error instanceof TypeError ? "offline" : "unexpected");
      onPendingCount(null);
    } finally {
      setRetrying(false);
    }
  }, [onPendingCount]);

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

  if (denied) return <AppDeniedPanel />;
  if (!list && failure) return <AppFatalPanel failure={failure} retrying={retrying} onRetry={() => void load()} illustration="flaskEmpty" />;
  if (!list) return <AppSkeleton shape="employees" />;

  return (
    <div className="users-tab">
      <p role="status" aria-live="polite" />
      <section aria-labelledby="users-pending-title">
        <h2 id="users-pending-title" tabIndex={-1}>ЗАЯВКИ · {list.pending.total}</h2>
        {list.pending.rows.length === 0 ? (
          <div className="editor-empty"><strong>Новых заявок нет</strong></div>
        ) : (
          <ul className="users-list">
            {list.pending.rows.map((row) => (
              <li className="users-row" key={row.id}>
                <strong title={row.nickname}>{row.nickname}</strong>
                <span className="users-plaque warning">ОЖИДАЕТ</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function UsersTabCount({ count }: { count: number | null }) {
  void count;
  return null;
}

export function useUsersPendingCount({ enabled, visible, tabActive }: { enabled: boolean; visible: boolean; tabActive: boolean }) {
  const [count, setCount] = useState<number | null>(null);
  void visible;
  void tabActive;
  return { count: enabled ? count : null, report: setCount };
}
