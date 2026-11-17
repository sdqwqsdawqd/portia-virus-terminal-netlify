import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createSnapshotCache, employeesSnapshot, resetEmployeesSnapshot } from "./employees-snapshot-cache.ts";

// Offline contract of the server snapshot of Google Sheets + Roblox (Phase 25, plan 25-03, D-23). The TTL values are [ASSUMED]:
// the limits of Google Sheets and Roblox were not measured, and the live behavior on Netlify is BLOCKED.

type Entry = { complete: boolean; n: number };

function clock(start = 1_000_000) {
  let value = start;
  return { now: () => value, advance: (ms: number) => { value += ms; } };
}

function counter(complete = true) {
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    load: async () => {
      calls += 1;
      return { complete, n: calls };
    },
  };
}

const ttl = { ttlMs: 300_000, degradedTtlMs: 30_000 };

test("a complete snapshot is loaded once and served until the TTL ends, then loaded again", async () => {
  const time = clock();
  const cache = createSnapshotCache<Entry>({ ...ttl, now: time.now });
  const source = counter();
  assert.equal((await cache.get(source.load)).n, 1);
  time.advance(299_999);
  assert.equal((await cache.get(source.load)).n, 1);
  assert.equal(source.calls, 1);
  time.advance(1);
  assert.equal((await cache.get(source.load)).n, 2);
  assert.equal(source.calls, 2);
});

test("an incomplete snapshot lives only the short time", async () => {
  const time = clock();
  const cache = createSnapshotCache<Entry>({ ...ttl, now: time.now });
  const source = counter(false);
  assert.equal((await cache.get(source.load)).n, 1);
  time.advance(29_999);
  assert.equal((await cache.get(source.load)).n, 1);
  time.advance(1);
  assert.equal((await cache.get(source.load)).n, 2);
});

test("concurrent requests before the load ends share one load", async () => {
  const cache = createSnapshotCache<Entry>({ ...ttl, now: clock().now });
  let calls = 0;
  let release: (value: { complete: boolean; n: number }) => void = () => {};
  const load = () => {
    calls += 1;
    return new Promise<{ complete: boolean; n: number }>((resolve) => {
      release = resolve;
    });
  };
  const first = cache.get(load);
  const second = cache.get(load);
  const third = cache.get(load);
  assert.equal(calls, 1);
  release({ complete: true, n: 7 });
  assert.deepEqual(await Promise.all([first, second, third]), [{ complete: true, n: 7 }, { complete: true, n: 7 }, { complete: true, n: 7 }]);
  assert.equal(calls, 1);
});

test("a failed load is not cached: it reaches every waiting caller and the next request loads again", async () => {
  const cache = createSnapshotCache<Entry>({ ...ttl, now: clock().now });
  let calls = 0;
  const failing = async () => {
    calls += 1;
    throw new Error("sheet down");
  };
  const [first, second] = await Promise.allSettled([cache.get(failing), cache.get(failing)]);
  assert.equal(first.status, "rejected");
  assert.equal(second.status, "rejected");
  assert.equal(calls, 1, "the waiting callers shared the one failing load");
  const source = counter();
  assert.equal((await cache.get(source.load)).n, 1, "the failure left nothing behind");
  assert.equal(calls, 1);
});

test("reset drops the snapshot and a load that is still waiting; the dropped load cannot refill the cache", async () => {
  const cache = createSnapshotCache<Entry>({ ...ttl, now: clock().now });
  const source = counter();
  await cache.get(source.load);
  cache.reset();
  assert.equal((await cache.get(source.load)).n, 2);

  let release: (value: { complete: boolean; n: number }) => void = () => {};
  const slow = new Promise<{ complete: boolean; n: number }>((resolve) => {
    release = resolve;
  });
  const fresh = createSnapshotCache<Entry>({ ...ttl, now: clock().now });
  const waiting = fresh.get(() => slow);
  fresh.reset();
  const next = counter();
  assert.equal((await fresh.get(next.load)).n, 1, "after the reset a new load starts");
  release({ complete: true, n: 99 });
  await waiting;
  assert.equal((await fresh.get(next.load)).n, 1, "the old load did not overwrite the newer snapshot");
  assert.equal(next.calls, 1);
});

test("the module instance uses 5 minutes and 30 seconds, and resetEmployeesSnapshot empties it", async () => {
  resetEmployeesSnapshot();
  const source = counter();
  assert.equal((await employeesSnapshot(source.load)).n, 1);
  assert.equal((await employeesSnapshot(source.load)).n, 1);
  resetEmployeesSnapshot();
  assert.equal((await employeesSnapshot(source.load)).n, 2);
  resetEmployeesSnapshot();
  const text = readFileSync(new URL("./employees-snapshot-cache.ts", import.meta.url), "utf8");
  assert.ok(text.includes("5 * 60 * 1000"));
  assert.ok(text.includes("30 * 1000"));
  assert.ok(text.includes("[ASSUMED]"));
});

test("the snapshot is shared by all viewers and holds no viewer data: the stored rows still decide the profiles", async (t) => {
  const { loadEmployeesFromRows } = await import("./portia-employees.ts");
  resetEmployeesSnapshot();
  t.after(() => resetEmployeesSnapshot());
  const header = '"Номер","Никнейм сотрудника","Позывной","Звание","Ранг"';
  let sheetCalls = 0;
  t.mock.method(globalThis, "fetch", async (url: string) => {
    if (String(url).includes("roblox.com")) return Response.json({ data: [] });
    sheetCalls += 1;
    return new Response([header, '"1","Fox","","",""'].join("\r\n"));
  });
  const profile = (biography: string) => ({ employee_id: "nick-fox", nickname: "Fox", biography, photo_url: "", knowledge_rating: 1 });
  const a = await loadEmployeesFromRows({ profiles: [profile("for viewer A")], manual: [] });
  const b = await loadEmployeesFromRows({ profiles: [profile("for viewer B")], manual: [] });
  const none = await loadEmployeesFromRows({ profiles: [], manual: [] });
  assert.equal(sheetCalls, 1, "one sheet read for three viewers");
  assert.equal(a.employees[0].biography, "for viewer A");
  assert.equal(b.employees[0].biography, "for viewer B");
  assert.equal(none.employees[0].biography, "");
});

test("a sheet that fails is not cached by the roster loader", async (t) => {
  const { loadEmployeesFromRows } = await import("./portia-employees.ts");
  resetEmployeesSnapshot();
  t.after(() => resetEmployeesSnapshot());
  let down = true;
  t.mock.method(globalThis, "fetch", async (url: string) => {
    if (String(url).includes("roblox.com")) return Response.json({ data: [] });
    if (down) return new Response("", { status: 500 });
    return new Response(['"Номер","Никнейм сотрудника","Позывной","Звание","Ранг"', '"1","Fox","","",""'].join("\r\n"));
  });
  await assert.rejects(loadEmployeesFromRows({ profiles: [], manual: [] }), /Google Sheets returned 500/);
  down = false;
  assert.equal((await loadEmployeesFromRows({ profiles: [], manual: [] })).employees.length, 1);
});
