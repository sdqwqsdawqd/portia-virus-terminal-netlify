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

test("retake notification requires a previously observed wait and appears once when ready", () => {
  const first = updateRetakeLedger([], wait, new Date("2026-10-29T12:00:00.000Z"), false);
  assert.equal(first.notification, null);
  const ready = updateRetakeLedger(first.ledger, wait, new Date("2026-10-30T12:00:00.000Z"), false);
  assert.equal(ready.notification?.availableAt, wait.availableAt);
  assert.equal(updateRetakeLedger(ready.ledger, wait, new Date("2026-10-31T12:00:00.000Z"), false).notification, null);
});

test("retake notification is suppressed and consumed while participant views the ready state", () => {
  const observed = updateRetakeLedger([], wait, new Date("2026-10-29T12:00:00.000Z"), false).ledger;
  const viewed = updateRetakeLedger(observed, wait, new Date("2026-10-30T12:00:00.000Z"), true);
  assert.equal(viewed.notification, null);
  assert.equal(updateRetakeLedger(viewed.ledger, wait, new Date("2026-10-30T12:01:00.000Z"), false).notification, null);
});

test("retake ledgers isolate nicknames, reject junk and stay bounded", () => {
  const other = updateRetakeLedger([], { ...wait, nickname: "Other" }, new Date("2026-10-29T12:00:00.000Z"), false).ledger;
  assert.equal(updateRetakeLedger(other, wait, new Date("2026-10-31T12:00:00.000Z"), false).notification, null);
  assert.deepEqual(parseRetakeLedger("broken"), []);
  assert.deepEqual(parseRetakeLedger(JSON.stringify([{ id: 1 }])), []);
  let ledger: RetakeLedger = [];
  for (let index = 0; index < 240; index += 1) ledger = updateRetakeLedger(ledger, { ...wait, attemptId: `attempt-${index}` }, new Date("2026-10-29T12:00:00.000Z"), false).ledger;
  assert.ok(ledger.length <= 200);
});

test("retake notification reuses the quiet in-site quest toast pattern and opens Promotion", () => {
  assert.ok(participant.includes("onRetakeReady"));
  assert.ok(desktop.includes("function PromotionRetakeToast"));
  assert.ok(desktop.includes('openApp("promotion")'));
  assert.ok(desktop.includes("ПОВТОРНАЯ ПРОВЕРКА ДОСТУПНА"));
  assert.match(styles, /\.promotion-retake-toast[^\{]*\{/);
  assert.match(styles, /html\[data-motion="full"\][^\n]*\.promotion-retake-toast/);
});
