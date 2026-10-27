const maxLedgerEntries = 200;

export type RetakeLedgerEntry = {
  id: string;
  nicknameKey: string;
  availableAt: string;
  notified: boolean;
};
export type RetakeLedger = RetakeLedgerEntry[];
export type RetakeWait = { nickname: string; attemptId: string; availableAt: string };
export type RetakeNotification = { id: string; availableAt: string };

function normalizedWait(wait: RetakeWait) {
  const nicknameKey = wait.nickname.trim().toLocaleLowerCase("en-US");
  const availableAt = Number.isFinite(Date.parse(wait.availableAt)) ? new Date(wait.availableAt).toISOString() : "";
  const attemptId = wait.attemptId.trim();
  if (!nicknameKey || !attemptId || !availableAt) return null;
  return { id: `${nicknameKey}:${attemptId}:${availableAt}`, nicknameKey, availableAt };
}

export function parseRetakeLedger(raw: string | null): RetakeLedger {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.flatMap((item): RetakeLedgerEntry[] => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const row = item as Record<string, unknown>;
      if (typeof row.id !== "string" || typeof row.nicknameKey !== "string" || typeof row.availableAt !== "string"
        || typeof row.notified !== "boolean" || !Number.isFinite(Date.parse(row.availableAt))) return [];
      return [{ id: row.id, nicknameKey: row.nicknameKey, availableAt: new Date(row.availableAt).toISOString(), notified: row.notified }];
    }).slice(-maxLedgerEntries);
  } catch { return []; }
}

export function updateRetakeLedger(ledger: RetakeLedger, wait: RetakeWait, now: Date, viewingReadyState: boolean) {
  const normalized = normalizedWait(wait);
  if (!normalized) return { ledger: ledger.slice(-maxLedgerEntries), notification: null as RetakeNotification | null };
  const existing = ledger.find((entry) => entry.id === normalized.id);
  const ready = now.getTime() >= Date.parse(normalized.availableAt);
  if (!existing) {
    const next = [...ledger, { ...normalized, notified: ready }].slice(-maxLedgerEntries);
    return { ledger: next, notification: null as RetakeNotification | null };
  }
  if (!ready || existing.notified) return { ledger: ledger.slice(-maxLedgerEntries), notification: null as RetakeNotification | null };
  const next = ledger.map((entry) => entry.id === normalized.id ? { ...entry, notified: true } : entry).slice(-maxLedgerEntries);
  return { ledger: next, notification: viewingReadyState ? null : { id: normalized.id, availableAt: normalized.availableAt } };
}
