import test from "node:test";
import assert from "node:assert/strict";
import { appViewState, contentSyncFailed, contentSyncSucceeded, failureCopy, failureFromResponse, staleBannerText, type AppFailure, type AppViewState } from "./app-state.ts";

const clock = (date: Date) => new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" }).format(date);

test("failureFromResponse separates offline, outage and unexpected answers (D-06 catalogue)", () => {
  const rows: [number | null, boolean, AppFailure][] = [
    [null, false, "offline"],
    [null, true, "unavailable"],
    [500, false, "unavailable"],
    [502, false, "unavailable"],
    [503, false, "unavailable"],
    [504, false, "unavailable"],
    [400, false, "unexpected"],
    [404, false, "unexpected"],
    [422, false, "unexpected"],
  ];
  for (const [status, timedOut, expected] of rows) assert.equal(failureFromResponse(status, timedOut), expected, `${status}/${timedOut}`);
});

test("failureCopy has one fixed Russian reason per failure and never echoes a status", () => {
  assert.deepEqual(Object.keys(failureCopy).sort(), ["offline", "unavailable", "unexpected"]);
  assert.equal(failureCopy.offline.heading, "Нет связи с сервером");
  assert.equal(failureCopy.unavailable.body, "Данные не потеряны. Повторите через минуту.");
  for (const copy of Object.values(failureCopy)) assert.doesNotMatch(`${copy.heading} ${copy.body}`, /\d{3}|error/i);
});

test("staleBannerText shows the clock for today and day plus month for an earlier day", () => {
  const moment = new Date("2026-11-02T11:05:00Z");
  const today = staleBannerText(moment.toISOString(), moment);
  assert.ok(today.startsWith("Не удалось обновить — показаны данные на "), today);
  assert.ok(today.includes(clock(moment)), today);
  assert.doesNotMatch(today, /нояб|янв|окт/);

  const later = new Date(moment.getTime() + 3 * 24 * 3600_000);
  const earlier = staleBannerText(moment.toISOString(), later);
  const day = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(moment);
  assert.ok(earlier.includes(day), earlier);
  assert.ok(earlier.includes(clock(moment)), earlier);
});

test("staleBannerText never prints Invalid Date for a tampered savedAt (T-19-01)", () => {
  for (const bad of ["", "not a date", "2026-13-45T99:99:99Z"]) {
    const text = staleBannerText(bad, new Date("2026-11-02T11:05:00Z"));
    assert.doesNotMatch(text, /Invalid/i, bad);
    assert.ok(text.startsWith("Не удалось обновить"), bad);
  }
});

test("appViewState: priority denied > loading > fatal > stale > empty > populated, with the 0/1 record boundary", () => {
  const rows: [string, Parameters<typeof appViewState>[0], AppViewState][] = [
    ["denied beats everything", { denied: true, ready: false, hasData: true, count: 3, failure: "offline" }, "denied"],
    ["not ready is loading", { denied: false, ready: false, hasData: false, count: 0, failure: null }, "loading"],
    ["loading beats a failure", { denied: false, ready: false, hasData: false, count: 0, failure: "unavailable" }, "loading"],
    ["ready without data or failure is still loading", { denied: false, ready: true, hasData: false, count: 0, failure: null }, "loading"],
    ["0 records and a failure is fatal", { denied: false, ready: true, hasData: true, count: 0, failure: "offline" }, "fatal"],
    ["built-in defaults are not loaded data", { denied: false, ready: true, hasData: false, count: 5, failure: "unexpected" }, "fatal"],
    ["1 record and a failure is stale", { denied: false, ready: true, hasData: true, count: 1, failure: "unavailable" }, "stale"],
    ["0 records without a failure is empty", { denied: false, ready: true, hasData: true, count: 0, failure: null }, "empty"],
    ["1 record without a failure is populated", { denied: false, ready: true, hasData: true, count: 1, failure: null }, "populated"],
  ];
  for (const [name, input, expected] of rows) assert.equal(appViewState(input), expected, name);
});

test("a repeated failure with the same reason keeps the same banner state and lastGoodAt (idempotency)", () => {
  const start = { lastGoodAt: null, failure: null, retrying: false };
  const first = contentSyncFailed(start, "unavailable", "2026-11-02T11:05:00.000Z");
  assert.deepEqual(first, { lastGoodAt: "2026-11-02T11:05:00.000Z", failure: "unavailable", retrying: false });
  assert.equal(contentSyncFailed(first, "unavailable", "2026-11-02T12:00:00.000Z"), first);
  // A different reason while already failing changes the reason, never the time.
  assert.equal(contentSyncFailed(first, "offline", "2026-11-02T12:00:00.000Z").lastGoodAt, first.lastGoodAt);
  assert.equal(appViewState({ denied: false, ready: true, hasData: true, count: 2, failure: first.failure }), appViewState({ denied: false, ready: true, hasData: true, count: 2, failure: first.failure }));
});

test("a success clears the failure and takes the new time; a quiet success does not touch state", () => {
  const failing = { lastGoodAt: "2026-11-02T11:05:00.000Z", failure: "offline" as const, retrying: true };
  assert.deepEqual(contentSyncSucceeded(failing, "2026-11-02T12:00:00.000Z"), { lastGoodAt: "2026-11-02T12:00:00.000Z", failure: null, retrying: true });
  const quiet = { lastGoodAt: "2026-11-02T11:05:00.000Z", failure: null, retrying: false };
  assert.equal(contentSyncSucceeded(quiet, "2026-11-02T12:00:00.000Z"), quiet);
});
