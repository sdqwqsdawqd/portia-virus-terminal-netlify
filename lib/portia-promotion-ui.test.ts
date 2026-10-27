import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../components/portia-promotion.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/portia.css", import.meta.url), "utf8");

test("participant gate explains binding and keeps the nickname in session state only", () => {
  assert.ok(source.includes("function PromotionIdentityGate"));
  assert.ok(source.includes("ПРОВЕРИТЬ ПОВЫШЕНИЕ"));
  assert.ok(source.includes("ПРОВЕРИТЬ НИК"));
  assert.ok(source.includes("Первая заявка закрепит этот ник за устройством. Сменить его сможет проверяющий."));
  assert.ok(source.includes('autoComplete="off"'));
  assert.ok(source.includes('spellCheck={false}'));
  assert.doesNotMatch(source, /(?:localStorage|sessionStorage)\.setItem\([^\n]*(?:nickname|checkedNickname)/i);
});

test("ordinary promotion and qualification remain visibly separate flows", () => {
  assert.ok(source.includes("ОБЫЧНОЕ ПОВЫШЕНИЕ"));
  assert.ok(source.includes("КВАЛИФИКАЦИЯ"));
  assert.ok(source.includes("ПОДАТЬ ЗАЯВКУ НА ЗАДАНИЯ"));
  assert.ok(source.includes("ЗАПРОСИТЬ КВАЛИФИКАЦИЮ"));
  assert.ok(source.includes("promotion-ordinary-card"));
  assert.ok(source.includes("promotion-qualification-card"));
});

test("public participant surface has immutable tasks and no private reviewer fields", () => {
  assert.ok(source.includes("Назначенные задания"));
  assert.ok(source.includes("promotion-task-list"));
  assert.doesNotMatch(source, /value=\{task\.text\}|onChange=[^>]*task\.text/i);
  for (const forbidden of ["answerKey", "reviewerId", "internalNote", "riskBucket", "tokenHash", "ipBucket"]) {
    assert.ok(!source.includes(forbidden), `private field ${forbidden} must not enter the participant component`);
  }
});

test("polling runs only for a visible window and a stale response preserves safe state", () => {
  assert.ok(source.includes("if (!visible || document.visibilityState !== \"visible\") return"));
  assert.ok(source.includes("setStale(true)"));
  assert.ok(source.includes("Состояние временно не обновляется"));
  assert.ok(source.includes("disabled={busy || stale}"));
});

test("participant states cover cooldown, sheet wait, special task and compact history", () => {
  for (const copy of ["Доступно после", "Ожидается изменение звания в таблице", "Особое задание", "Последние результаты"]) {
    assert.ok(source.includes(copy), copy);
  }
  assert.ok(source.includes(".slice(0, 3)"));
  assert.ok(source.includes('aria-live="polite"'));
});

test("promotion window is responsive and motion respects the desktop preference", () => {
  assert.match(styles, /\.promotion-app\s*\{/);
  assert.match(styles, /\.promotion-action[^{]*\{[^}]*min-height:\s*4[04]px/);
  assert.match(styles, /html\[data-motion="full"\][^{]*\.promotion-card/);
  assert.match(styles, /@media \(max-width:\s*520px\)[\s\S]*\.promotion-app/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.promotion-card/);
});
