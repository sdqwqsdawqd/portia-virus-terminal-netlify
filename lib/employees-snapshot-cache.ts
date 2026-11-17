// Server snapshot of what the roster takes from outside the database: the Google Sheet rows and the Roblox accounts (Phase 25, D-23).
// The roster answer is built for each viewer and no CDN keeps it, so without this the external services would be called on every
// poll of every visitor. The snapshot is the same for all viewers and sits after the gate: it holds no stored profile, no manual
// row and nothing that depends on who asks (the signed read supplies those on every request). It lives in the memory of one
// function instance: a cold start begins empty, and a write of an editor drops the snapshot of its own instance only.
//
// The TTL values are [ASSUMED]: the limits of Google Sheets and Roblox were not measured on a stand. 5 minutes is the visitor's own
// poll interval of the roster; 30 seconds for an incomplete snapshot is the short life the old CDN copy of an incomplete answer had.
// The calculation is recorded in 25-POLL-BUDGET.md.

type Snapshot = { complete: boolean };

export type SnapshotCacheOptions = {
  ttlMs: number;
  degradedTtlMs: number;
  now?: () => number;
};

export function createSnapshotCache<T extends Snapshot>({ ttlMs, degradedTtlMs, now = Date.now }: SnapshotCacheOptions) {
  let stored: { value: T; expiresAt: number } | null = null;
  let pending: Promise<T> | null = null;
  // A load that finishes after reset() belongs to an older generation and must not refill the cache.
  let generation = 0;

  function get(load: () => Promise<T>): Promise<T> {
    if (stored && now() < stored.expiresAt) return Promise.resolve(stored.value);
    if (pending) return pending;
    const mine = generation;
    const started = load().then(
      (value) => {
        if (mine === generation) {
          stored = { value, expiresAt: now() + (value.complete ? ttlMs : degradedTtlMs) };
          pending = null;
        }
        return value;
      },
      (error: unknown) => {
        // A failure is never cached: the next request loads again, and the caller answers as it did before the snapshot.
        if (mine === generation) pending = null;
        throw error;
      },
    );
    pending = started;
    return started;
  }

  function reset() {
    generation += 1;
    stored = null;
    pending = null;
  }

  return { get, reset };
}

const employeesSnapshotCache = createSnapshotCache<Snapshot>({ ttlMs: 5 * 60 * 1000, degradedTtlMs: 30 * 1000 });

export function employeesSnapshot<T extends Snapshot>(load: () => Promise<T>): Promise<T> {
  return employeesSnapshotCache.get(load as () => Promise<Snapshot>) as Promise<T>;
}

export function resetEmployeesSnapshot() {
  employeesSnapshotCache.reset();
}
