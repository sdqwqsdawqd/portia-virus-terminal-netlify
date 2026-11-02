import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  parseRetakeLedger,
  updateRetakeLedger,
  type RetakeLedger,
} from "./portia-promotion-notifications.ts";

const participant = readFileSync(new URL("../components/portia-promotion.tsx", import.meta.url), "utf8");
const desktop = readFileSync(new URL("../components/portia-desktop.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/portia.css", import.meta.url), "utf8");

const wait = { nickname: "PORTIA_User", attemptId: "attempt-1", availableAt: "2026-10-30T12:00:00.000Z" };

test("retake notification appears once on the first return after eligibility", () => {
  const firstReady = updateRetakeLedger([], wait, new Date("2026-10-30T12:00:00.000Z"), false);
  assert.equal(firstReady.notification?.availableAt, wait.availableAt);
  assert.equal(updateRetakeLedger(firstReady.ledger, wait, new Date("2026-10-31T12:00:00.000Z"), false).notification, null);
});

test("retake notification still appears after a previously observed wait", () => {
  const first = updateRetakeLedger([], wait, new Date("2026-10-29T12:00:00.000Z"), false);
  assert.equal(first.notification, null);
  const ready = updateRetakeLedger(first.ledger, wait, new Date("2026-10-30T12:00:00.000Z"), false);
  assert.equal(ready.notification?.availableAt, wait.availableAt);
  assert.equal(updateRetakeLedger(ready.ledger, wait, new Date("2026-10-31T12:00:00.000Z"), false).notification, null);
});

test("retake notification is suppressed but not consumed while participant views the ready state", () => {
  const observed = updateRetakeLedger([], wait, new Date("2026-10-29T12:00:00.000Z"), false).ledger;
  const viewed = updateRetakeLedger(observed, wait, new Date("2026-10-30T12:00:00.000Z"), true);
  assert.equal(viewed.notification, null);
  assert.equal(updateRetakeLedger(viewed.ledger, wait, new Date("2026-10-30T12:01:00.000Z"), false).notification?.availableAt, wait.availableAt);
});

test("retake ledgers isolate nicknames, reject junk and stay bounded", () => {
  const other = updateRetakeLedger([], { ...wait, nickname: "Other" }, new Date("2026-10-29T12:00:00.000Z"), false).ledger;
  const isolated = updateRetakeLedger(other, wait, new Date("2026-10-31T12:00:00.000Z"), false);
  assert.equal(isolated.notification?.availableAt, wait.availableAt);
  assert.deepEqual(Object.keys(isolated.ledger.at(-1) ?? {}).sort(), ["availableAt", "id", "nicknameKey", "notified"]);
  assert.deepEqual(parseRetakeLedger("broken"), []);
  assert.deepEqual(parseRetakeLedger(JSON.stringify([{ id: 1 }])), []);
  let ledger: RetakeLedger = [];
  for (let index = 0; index < 240; index += 1) ledger = updateRetakeLedger(ledger, { ...wait, attemptId: `attempt-${index}` }, new Date("2026-10-29T12:00:00.000Z"), false).ledger;
  assert.ok(ledger.length <= 200);
});

test("polling the same attemptId again never produces a second notification, even long after", () => {
  const first = updateRetakeLedger([], wait, new Date("2026-10-30T12:00:00.000Z"), false);
  assert.ok(first.notification);
  let ledger = first.ledger;
  for (const at of ["2026-10-30T12:00:05.000Z", "2026-10-30T12:00:10.000Z", "2026-11-05T00:00:00.000Z"]) {
    const poll = updateRetakeLedger(ledger, wait, new Date(at), false);
    assert.equal(poll.notification, null);
    ledger = poll.ledger;
  }
  assert.equal(ledger.filter((entry) => entry.id === first.notification!.id).length, 1);
});

test("two consecutive calls with the same now keep exactly one record and do not lose the first", () => {
  const now = new Date("2026-10-29T12:00:00.000Z");
  const one = updateRetakeLedger([], wait, now, false);
  const two = updateRetakeLedger(one.ledger, wait, now, false);
  assert.equal(two.ledger.length, 1);
  assert.deepEqual(two.ledger, one.ledger);
  const ready = new Date("2026-10-30T12:00:00.000Z");
  const a = updateRetakeLedger(two.ledger, wait, ready, false);
  const b = updateRetakeLedger(a.ledger, wait, ready, false);
  assert.ok(a.notification);
  assert.equal(b.notification, null);
  assert.equal(b.ledger.length, 1);
  assert.equal(b.ledger[0].notified, true);
});

test("a new attemptId for the same nickname is a separate wait with its own single notification", () => {
  const ready = new Date("2026-10-30T12:00:00.000Z");
  const first = updateRetakeLedger([], wait, ready, false);
  const second = updateRetakeLedger(first.ledger, { ...wait, attemptId: "attempt-2" }, ready, false);
  assert.ok(second.notification);
  assert.notEqual(second.notification!.id, first.notification!.id);
  assert.equal(second.ledger.length, 2);
});

test("retake notification reuses the quiet in-site quest toast pattern and opens Promotion", () => {
  assert.ok(participant.includes("onRetakeReady"));
  assert.ok(desktop.includes("function PromotionRetakeToast"));
  assert.ok(desktop.includes('openApp("promotion")'));
  assert.ok(desktop.includes("ПОВТОРНАЯ ПРОВЕРКА ДОСТУПНА"));
  assert.match(styles, /\.promotion-retake-toast[^\{]*\{/);
  assert.match(styles, /html\[data-motion="full"\][^\n]*\.promotion-retake-toast/);
});
