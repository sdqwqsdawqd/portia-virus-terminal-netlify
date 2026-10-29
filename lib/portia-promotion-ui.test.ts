import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../components/portia-promotion.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/portia.css", import.meta.url), "utf8");

test("participant gate explains lookup binding and restores only through the HttpOnly-backed status flow", () => {
  assert.ok(source.includes("function PromotionIdentityGate"));
  assert.ok(source.includes("ПРОВЕРИТЬ ПОВЫШЕНИЕ"));
  assert.ok(source.includes("PORTIA // ПОВЫШЕНИЕ"));
  assert.ok(source.includes("Ник Roblox, указанный в таблице"));
  assert.ok(source.includes('placeholder="Введите ник Roblox из таблицы"'));
  assert.ok(!source.includes("КАДРОВЫЙ КОНТУР"));
  assert.ok(!source.includes("Portia_User"));
  assert.ok(source.includes("ПРОВЕРИТЬ НИК"));
  assert.ok(source.includes("Первая заявка закрепит этот ник за устройством. Сменить его сможет проверяющий."));
  assert.ok(source.includes('!error && <p className="promotion-binding-note"'));
  assert.ok(source.includes('autoComplete="off"'));
  assert.ok(source.includes('spellCheck={false}'));
  assert.doesNotMatch(source, /(?:localStorage|sessionStorage)\.setItem\([^\n]*(?:nickname|checkedNickname)/i);
  assert.ok(source.includes('loadStatus("", false, true)'));
  assert.ok(source.includes("setNickname(next.nickname)"));
});

test("admitted employees without a promotion row get a truthful disabled state", () => {
  assert.ok(source.includes("promotionRecord: null"));
  assert.ok(source.includes("promotionRecord === null"));
  assert.ok(source.includes("Запись о повышении пока не заведена"));
});

test("promotion calendar cooldowns avoid fake midnight precision while exact retakes stay in Moscow time", () => {
  assert.ok(source.includes('timeZone: "Europe/Moscow"'));
  assert.ok(source.includes("МСК"));
  assert.ok(source.includes("formatCalendarDate"));
  assert.ok(source.includes("Доступно с ${formatCalendarDate(eligibility.availableAt)}"));
  assert.ok(source.includes("Повторная проверка доступна ${formatDate(active.availableAt)}"));
  const localized = new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeZone: "Europe/Moscow" })
    .format(new Date("2026-11-11T00:00:00.000Z"));
  assert.equal(`${localized.replace(/\.$/, "")}.`, "11 ноября 2026 г.");
  assert.match(source, /calendarDate\.format\(new Date\(value\)\)\.replace\(\/\\\.\$\//);
});

test("participant eligibility matrix always exposes either one action or one stable reason", () => {
  const reasons = [
    "Доступно с",
    "Ожидается изменение звания в таблице",
    "Особое задание для звания",
    "Сначала необходимо пройти квалификацию",
    "Для текущего звания квалификационная проверка не требуется",
    "Повышение сейчас недоступно",
  ];
  for (const reason of reasons) assert.ok(source.includes(reason), reason);
  assert.match(source, /const canRequest = !active && \(eligibility\.status === "eligible" \|\| \(ordinary && eligibility\.status === "special-task"\)\)/);
  assert.match(source, /canRequest && <button[^>]*promotion-action/);
  assert.doesNotMatch(source, /!canRequest && <button[^>]*disabled/);
});

test("ordinary promotion and qualification remain visibly separate flows", () => {
  assert.ok(source.includes("ОБЫЧНОЕ ПОВЫШЕНИЕ"));
  assert.ok(source.includes("КВАЛИФИКАЦИЯ"));
  assert.ok(source.includes("ПОДАТЬ ЗАЯВКУ НА ЗАДАНИЯ"));
  assert.ok(source.includes("ЗАПРОСИТЬ КВАЛИФИКАЦИЮ"));
  assert.ok(source.includes("promotion-ordinary-card"));
  assert.ok(source.includes("promotion-qualification-card"));
  assert.ok(source.includes("Квалификация пройдена. Теперь отдельно запросите задания на повышение."));
  assert.ok(source.includes('status.ordinary.eligibility.status === "qualification-required"'));
  assert.ok(source.includes("ещё не взят проверяющим"));
  assert.ok(!source.includes("Заявка принята. Обновляем состояние"));
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
  for (const copy of ["Доступно с", "Ожидается изменение звания в таблице", "Особое задание", "Последние результаты"]) {
    assert.ok(source.includes(copy), copy);
  }
  assert.ok(source.includes(".slice(0, 3)"));
  assert.ok(source.includes('aria-live="polite"'));
});

test("ordinary and qualification submits have independent visible feedback", () => {
  assert.ok(source.includes('type SubmitPhase = "idle" | "submitting" | "error" | "success"'));
  assert.ok(source.includes("const [submitState, setSubmitState]"));
  assert.ok(source.includes("submittingRef.current.has(kind)"));
  assert.ok(source.includes("busy={submitState.ordinary.phase === \"submitting\"}"));
  assert.ok(source.includes("busy={submitState.qualification.phase === \"submitting\"}"));
  assert.ok(source.includes('className={`promotion-submit-feedback ${feedback.phase}`}'));
  assert.match(source, /feedback\.phase === "error" \? "alert" : "status"/);
  assert.ok(!source.includes('setError(publicError(body, "Заявку не удалось отправить."))'));
});

test("typed submit refusal stays local while transport failure alone marks the projection stale", () => {
  const submitStart = source.indexOf("const requestPromotion = async");
  const submitEnd = source.indexOf("\n  };", submitStart);
  const submit = source.slice(submitStart, submitEnd);
  assert.match(submit, /if \(!response\.ok\)[\s\S]*phase: "error"[\s\S]*publicError/);
  assert.match(submit, /catch[\s\S]*setStale\(true\)/);
  assert.match(submit, /phase: "success"[\s\S]*await loadStatus\(checkedNickname\)/);
  assert.match(submit, /requestAnimationFrame[\s\S]*submitFeedbackRefs\.current\[kind\]\?\.focus/);
});

test("promotion window is responsive and motion respects the desktop preference", () => {
  assert.match(styles, /\.promotion-app\s*\{/);
  assert.match(styles, /\.promotion-action[^{]*\{[^}]*min-height:\s*4[04]px/);
  assert.match(styles, /html\[data-motion="full"\][^{]*\.promotion-card/);
  assert.match(styles, /@media \(max-width:\s*520px\)[\s\S]*\.promotion-app/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.promotion-card/);
});

test("promotion copy and visual tokens follow the reviewed accessibility contract", () => {
  const promotionStyles = styles.slice(styles.indexOf("/* Promotion is a standalone"));
  assert.match(promotionStyles, /\.promotion-question h3[^\{]*\{[^}]*font:\s*400 15px\/1\.65 var\(--doc\)/);
  assert.doesNotMatch(promotionStyles, /oklch\(\.76 \.07 285\)/);
  assert.doesNotMatch(promotionStyles, /font(?:-size)?:[^;\n}]*(?:9|10)px/);
  assert.doesNotMatch(promotionStyles, /min-height:\s*38px/);
  assert.match(promotionStyles, /@media \(max-width:\s*520px\)[\s\S]*\.promotion-(?:action|final-actions|preview)[^\{]*\{[^}]*min-height:\s*44px/);
});
