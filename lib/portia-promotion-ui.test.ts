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
  // D-56 (20-37): the binding note is one short phrase.
  assert.ok(source.includes("Первая заявка закрепит ник за устройством."));
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

test("cooldown and retake deadlines come from promotionAvailabilityText in device time, history stays in Moscow time", () => {
  assert.ok(source.includes('import { promotionAvailabilityText } from "@/lib/portia-promotion"'));
  assert.ok(source.includes("promotionAvailabilityText(eligibility.availableAt, new Date())"));
  assert.ok(source.includes("promotionAvailabilityText(active.availableAt, new Date())"));
  assert.ok(source.includes("Повторная проверка будет доступна по решению проверяющего."));
  assert.ok(!source.includes("formatCalendarDate"));
  assert.doesNotMatch(source, /\.replace\(\/\\.\$\//);
  assert.ok(!source.includes("Доступно с"));
  assert.ok(source.includes('timeZone: "Europe/Moscow"'));
});

test("participant eligibility matrix always exposes either one action or one stable reason", () => {
  const reasons = [
    "promotionAvailabilityText(eligibility.availableAt",
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

test("status poll routes refusals through the decision and only resets the gate on reset", () => {
  const loadStart = source.indexOf("const loadStatus = useCallback");
  const loadEnd = source.indexOf("\n  }, [status]);", loadStart);
  const load = source.slice(loadStart, loadEnd);
  assert.ok(load.includes("statusPollOutcome("));
  assert.match(load, /if \(outcome === "keep-stale"\)[\s\S]*setStale\(true\)/);
  assert.match(load, /if \(outcome === "ignore"\) return/);
  assert.match(load, /if \(outcome === "reset"\)[\s\S]*setStatus\(null\)/);
  assert.equal((source.match(/setStatus\(null\)/g) ?? []).length, 1);
  assert.match(load, /catch[\s\S]*if \(status\) \{ setStale\(true\); setError\(""\); \}/);
});

test("participant states cover cooldown, sheet wait, special task and compact history", () => {
  for (const copy of ["promotionAvailabilityText(", "Ожидается изменение звания в таблице", "Особое задание", "Последние результаты"]) {
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
  assert.match(submit, /if \(!response\.ok \|\| !createdRequest\(body\)\)[\s\S]*phase: "error"[\s\S]*publicError/);
  assert.match(submit, /catch[\s\S]*setStale\(true\)/);
  assert.match(submit, /phase: "success"[\s\S]*await loadStatus\(checkedNickname\)/);
  assert.match(submit, /requestAnimationFrame[\s\S]*submitFeedbackRefs\.current\[kind\]\?\.focus/);
});

test("promotion window is responsive and motion respects the desktop preference", () => {
  assert.match(styles, /\.promotion-app\s*\{/);
  assert.match(styles, /\.promotion-action[^{]*\{[^}]*min-height:\s*4[04]px/);
  assert.match(styles, /html\[data-motion="full"\][^{]*\.promotion-card/);
  assert.match(styles, /@media \(max-width:\s*520px\)[\s\S]*\.promotion-app/);
  assert.match(styles, /html:is\(\[data-motion="reduced"\], \[data-motion="off"\]\)[^\n]*\.promotion-card[^\n]*animation:\s*none/);
  assert.doesNotMatch(styles, /prefers-reduced-motion/);
});

test("promotion copy and visual tokens follow the reviewed accessibility contract", () => {
  const promotionStyles = styles.slice(styles.indexOf("/* Promotion is a standalone"));
  assert.match(promotionStyles, /\.promotion-question h3[^\{]*\{[^}]*font:\s*400 15px\/1\.65 var\(--doc\)/);
  assert.doesNotMatch(promotionStyles, /oklch\(\.76 \.07 285\)/);
  assert.doesNotMatch(promotionStyles, /font(?:-size)?:[^;\n}]*(?:9|10)px/);
  assert.doesNotMatch(promotionStyles, /min-height:\s*38px/);
  assert.match(promotionStyles, /@media \(max-width:\s*520px\)[\s\S]*\.promotion-(?:action|final-actions|preview)[^\{]*\{[^}]*min-height:\s*44px/);
});

test("the mode warning shows both approved owner texts, chosen by the server clientMode, and never claims hardware attestation", () => {
  const desktopText = "Не переключайте вкладку и окно: потеря фокуса завершит попытку как проваленную.";
  // D-56 (20-37): the phone text is one short phrase; the desktop warning keeps the owner-approved wording of 19.
  const phoneText = "Можно переключаться между приложениями.";
  assert.ok(source.includes(desktopText));
  assert.ok(source.includes(phoneText));
  assert.match(source, /className="promotion-mode-warning"/);
  assert.match(source, /test\.clientMode === "phone"[\s\S]{0,80}phoneModeWarning : desktopModeWarning/);
  assert.doesNotMatch(source, /аттестац|hardware/i);
});

test("the cleanup hint sits under the action cards and history stays at three results", () => {
  // D-56 (20-37): the hint keeps the limit of three results and drops the retold cleanup rule.
  assert.ok(source.includes('<p className="promotion-cleanup-hint">Хранятся три последних результата.</p>'));
  assert.ok(source.indexOf("promotion-cleanup-hint") > source.indexOf("promotion-flow-list"));
  assert.ok(source.includes("status.results.slice(0, 3)"));
  assert.ok(source.includes("Math.min(status.results.length, 3)"));
});

test("the submitted message is produced only after the server created the request", () => {
  const submitStart = source.indexOf("const requestPromotion = async");
  const submit = source.slice(submitStart, source.indexOf("\n  };", submitStart));
  const createdAt = submit.indexOf("createdRequest(body)");
  const successAt = submit.indexOf('phase: "success"');
  const sendingAt = submit.indexOf("Отправляем заявку…");
  assert.ok(sendingAt >= 0 && createdAt > sendingAt && successAt > createdAt, "success text must follow the created check");
  // D-56 (20-37): the two success texts lost their second sentence.
  assert.equal(source.split('? "Заявка на задания отправлена в очередь."').length - 1, 1);
  assert.equal(source.split(': "Запрос на квалификацию отправлен в очередь."').length - 1, 1);
  assert.match(source, /function createdRequest[\s\S]*typeof [^\n]*requestId === "string"/);
  assert.match(submit, /if \(!response\.ok \|\| !createdRequest\(body\)\)[\s\S]*phase: "error"[\s\S]*publicError/);
});

test("participant component never receives reviewer identity, keys, notes or future questions", () => {
  for (const forbidden of ["futureQuestions", "answerKey", "reviewerId", "reviewerName", "reviewerNote", "internalNote", "correctAnswer", "isCorrect", "reviewerCorrect"]) {
    assert.ok(!source.includes(forbidden), forbidden);
  }
});
