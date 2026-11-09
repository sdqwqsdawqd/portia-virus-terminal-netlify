---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 47
subsystem: ui
tags: [visual-approval, recapture, gap-closure, owner-verdict, flasks, template-builder, spider]

requires:
  - phase: PORTIA-20-security-accessibility-i-priemka-reliza
    provides: "20-40/20-41 паук D-53, 20-42 колбы D-54, 20-43/20-44 конструктор шаблона D-55, 20-45 кнопка «ОФОРМЛЕНИЕ» D-57, 20-46 подсказки D-56"
provides:
  - "пересъёмка всех кандидатных кадров на H4 ecf5173a5d51616ac3a1f1cc044e2b536a61a2fb (набор phase20-refresh-ecf5173a5d51) и галерея review.html с роликами и файлами"
  - "раунд 13 в lib/phase20-visual-approval.test.ts и таблица раздела 13 ledger (34 отклонённых 2026-11-07 кадра с hash и коммитами исправления)"
  - "вердикт владельца 2026-11-07 в ledger (раунд 14 раздела 13)"
affects: [20-12, 20-13, 20-14, следующий цикл gap closure]

outcome: stopped-for-fixes

actuals:
  tokens: 110000
  tasks: 3
  commits: 4

plan_head_before: a3fa23060448f818eabb68348b053695e1d22d03
plan_head_after: 837a14a41146aeb56d8a8da99d2c83effb89c3fb
commits: 4

key-files:
  created:
    - tests/e2e/visual-candidates/phase20-review-extras.spec.ts
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-47-SUMMARY.md
  modified:
    - lib/phase20-visual-approval.test.ts
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-VISUAL-APPROVAL.md
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-EVIDENCE-REFRESH.md
    - .planning/todos/pending/2026-11-06-flasks-wallpaper-redo.md

key-decisions:
  - "Вердикт 2026-11-07: колбы «исправить» (убрать лишние часы, анимация доскам и волнам у доски), предел анимаций 140 принят, сокращённые тексты D-56 приняты"
  - "Ответ «4. Да исправить» неоднозначен: толкование оркестратора (перенос слова «Предупреждение»), записано у template-builder-preview:pc, подтвердить в следующей галерее"
  - "application-information переведена в BLOCKED (DATA): гейт проходит на сегодняшних данных цели"

requirements-completed: []

coverage:
  - id: D1
    description: "Все CANDIDATE-строки пересняты на одном коммите H4, 34 отклонённых 2026-11-07 кадра закреплены в разделе 13, повторный показ отклонённых байтов и кадр до коммита исправления отвергаются тестом"
    requirement: STAB-REL-08
    verification:
      - kind: unit
        ref: "lib/phase20-visual-approval.test.ts#20-47 recapture guard"
        status: pass
    human_judgment: false
  - id: D2
    description: "Паук без канта и белого внутри ног, ходят все 8 ног, волна на каждый шаг (D-53) на пересъёмке"
    requirement: STAB-VIS-01
    verification: []
    human_judgment: true
    rationale: "Вердикта по строкам spider-* владелец не дал; остаются ОЖИДАЕТ"
  - id: D3
    description: "Колбы: пламя, полка, часы, плотность (D-54)"
    requirement: STAB-VIS-02
    verification: []
    human_judgment: true
    rationale: "Владелец вынес «исправить» по 12 строкам flasks-*"
  - id: D4
    description: "Конструктор шаблона: карточка базы вирусов (D-55)"
    requirement: STAB-TMPL-01
    verification: []
    human_judgment: true
    rationale: "Вердикт только по template-builder-preview:pc (исправить, перенос слова); остальные строки без вердикта; вопрос про колонки не понят владельцем"

duration: три запуска исполнителя 2026-11-07
completed: 2026-11-07
status: complete
---

# Phase PORTIA-20 Plan 47: пересъёмка пакета после исправлений D-53..D-57 и вердикт владельца Summary

**Все кандидаты пересняты на H4 `ecf5173a5d51`, раунд 13 закрепил 34 отклонённых кадра в тесте и ledger; владелец 2026-11-07 принял предел анимаций 140 и сокращённые тексты D-56, но вынес «исправить» по 12 строкам колб и по строке предпросмотра конструктора (перенос слова), остальное без вердикта, поэтому план закрыт с `outcome: stopped-for-fixes`.**

## Что сделано

- **Task 1:** RED-тест раунда 13 и describe «20-47 recapture guard» (`ecf5173`), затем 36 строк (16 паука, 12 колб, 8 конструктора) пересняты на H4 и сброшены в ОЖИДАЕТ, раздел 13 получил таблицу 34 строк с коммитами spider_fix `db151677cf01d45f852b32e14d73725dd515dc70`, flask_fix `859a493fb295cd6a7a879b0f0ae12b25efeac45f`, template_fix `be9af79925cb12dd1d6dcb933d7b48a3de3c956e` (`eeb8a44`). RED-прогон: `# tests 36, pass 29, fail 6, skipped 1`; после правки ledger `pass 35, fail 0, skipped 1`.
- **Task 2:** остальные кандидатные спеки, прежние эталоны с `--retries=0` без флага обновления, строки rebaseline-*, раздел доказательств, спек сопровождения галереи, галерея `review.html` (`b2afe81`).
- **Task 3 (checkpoint, blocking-human):** галерея показана, вердикт владельца записан (`837a14a`), см. ниже.
- **PLAN_BASE:** `a3fa23060448f818eabb68348b053695e1d22d03`.

## Вердикт владельца 2026-11-07 (дословно)

«1 не понял вопроса, 2 Принять, убрать лишние часы ведь их там два и добавить анимацию к доскам и волнам которые были показаны которые прекрепленные к доске, 3. Принять, 4. Да исправить». Затем: «Закрыть баги с фазой 20 потом следующую».

Записано только сказанное:

- **Вопрос 2 (колбы):** предел бесконечных анимаций 140 вместо 100 ПРИНЯТ. 12 строк `flasks-*` «исправить»: убрать лишние часы (их показано два), добавить анимацию доскам и волнам, прикреплённым к доске.
- **Вопрос 3:** сокращённые утверждённые тексты (телефонный тест «Можно переключаться между приложениями.», подсказка «Анимации» «Системная настройка движения не учитывается.») ПРИНЯТЫ; вердикты кадров не меняет.
- **Вопрос 4 («Да исправить») неоднозначен.** Оркестратор спросил, к чему он относится, и ответа не получил. Рабочее толкование оркестратора: перенос слова «Предупреждение» («Предупреждени-е») в карточке и скачанных HTML/PNG. Записано как «исправить: …, толкование оркестратора, подтвердить в следующей галерее» у `template-builder-preview:pc`. Это единственный кадр ledger, где перенос виден: на телефоне (`template-builder-preview:phone`) переноса нет, вкладки «Основное», «Описание», «Мутации» карточку не показывают. Остальные семь строк `template-builder-*` остались ОЖИДАЕТ. Скачанные файлы с переносом лежат в `extras/` галереи, но это не строки ledger.
- **Вопрос 1** (карточка шаблона в одну колонку в окне «Повышение» по умолчанию, две колонки только в развёрнутом окне): владелец вопроса не понял, вердикта нет; вопрос остаётся открытым, задать снова в следующей галерее.
- Остальные строки ОЖИДАЕТ (`spider-*`, остальные `template-builder-*`, `rebaseline-*`, прочие изменившиеся) вердикта не получили и остаются ОЖИДАЕТ. Ни одна строка не отмечена «принято».

## Строки «исправить» (13, дата 2026-11-07, принятого hash нет)

- 12 `flasks-*` (D-54), каждая на pc и phone: flasks-full, flasks-off, flasks-reduced, flasks-accent-default, flasks-accent-custom-dark, flasks-accent-custom-light.
- 1 строка `template-builder-preview:pc` (перенос слова, толкование оркестратора).

## Итог ledger

133 строки: 16 принято (побайтно те же кадры), 13 исправить, 68 ОЖИДАЕТ, 36 BLOCKED. Из 68 ОЖИДАЕТ: 16 `spider-*` (включая `spider-off:pc/phone`), 7 `template-builder-*`, 24 `rebaseline-*`, 21 прочая изменившаяся строка. `20-12` не запускается. Todo `2026-11-06-flasks-wallpaper-redo.md` остаётся в `.planning/todos/pending` со `status: pending` и записью вердикта; `2026-11-06-spider-match-logo.md` без изменений (по пауку вердикта нет).

## Новые замечания владельца для закрытия в фазе 20 (не реализованы, уходят в gap planning)

1. В конструкторе шаблона («Повышение») при скачивании показывается ошибка «не удалось… повторите скачивание», хотя файл скачался.
2. Кнопка создания нового раздела должна стоять вверху рядом с вкладками разделов; внизу остаётся только кнопка создания подраздела.

## Отклонения от плана

1. **`rebaseline-application-information--chromium-desktop:pc` переведена из CANDIDATE в BLOCKED (DATA):** гейт на H4 проходит на сегодняшних данных цели (на H3 падал на 25449 px из-за данных, B1), нового actual нет; тот же подход, что у `application-virus-archive`. Строк `rebaseline-*` в ledger 29 (≥27).
2. **Две новые строки rebaseline:** `rebaseline-promotion-participant-lookup--chromium-desktop:pc` (гейт FAIL 21225 px, на H3 проходил; подсказки D-56 и паук) и `rebaseline-editor-signed-out-login--chromium-desktop:pc` (оценка 10301 px; подпись входа D-56, h-01).
3. **Пять ранее принятых строк сброшены в ОЖИДАЕТ** по D-19: четыре строки Promotion на телефоне (подсказки D-56) и `info-phone-next:phone-webkit` (изменение ниже порога канала 16).
4. **Строки `motion-web-rest`, `motion-vivian-idle`, `motion-vivian-activity`:** реальный гейт PASS в допуске; строки оставлены кадром кандидата «для сравнения».
5. **`spider-off:pc/phone`:** байты изменились без паука в кадре (PC: 5808 px по краям нитей, причина не установлена; телефон: младшие разряды цвета).
6. **Окружение:** Node 22.13.1 из `%TEMP%\portia-node-v22.13.1\node-v22.13.1-win-x64`; `npm run` падает на node-gyp, использованы прямые команды. `scripts/phase15-visual-manifest.mjs --verify` не запускался.

## Проверка

- Обязательные проверки до показа (`--retries=0`): UI-контракт конструктора и полоса accessibility 32 passed; `phase20-art.spec.ts` в S4 60 passed; `visual-candidates/template-builder.spec.ts` 8 passed; остальные кандидатные спеки 157 passed, 153 skipped, 0 failed; `phase20-review-extras.spec.ts` 8 passed, ноль запросов записи.
- Прежние эталоны: chromium-desktop и dpr125 11 failed, 5 passed; chromium-phone, webkit-phone, firefox-desktop 5 failed. Классификация в `20-EVIDENCE-REFRESH.md`, раздел «Пересъёмка после исправлений D-53..D-57 (20-47)»; незакрытых блокеров нет.
- Галерея: 81 кадр, 286 ссылок, 0 отсутствующих.
- `node --experimental-strip-types --test lib/*.test.ts`: 1546 tests, 1542 pass, 0 fail, 4 skipped (до записи вердикта); после записи вердикта `lib/phase20-visual-approval.test.ts` 36 tests, 35 pass, 0 fail, 1 skipped; `lib/phase20-requirements-ledger.test.ts` 15 pass. `tsc --noEmit` код 0, eslint по новым файлам чистый.
- Строгий прогон `PORTIA_REQUIRE_APPROVAL=1`: ожидаемо красный, только «owner asked for a fix» (13 строк) и «owner verdict is still pending» (68 строк); нет «captured outside candidates_set», «stale candidates», «does not match», «re-presents the rejected frame».
- `git diff --exit-code --stat HEAD -- tests/e2e/visual/__screenshots__` код 0; `git log a3fa230..HEAD` по каталогу эталонов пуст; сервер на 3100 остановлен (PID 20056, `next start` этого проекта).

## Known Stubs

Нет.

## Threat Flags

Нет новой поверхности: добавлен только спек сопровождения галереи (чтение, ноль запросов записи, трекер роняет тест при любой записи), документы планирования и тест ledger.

## Issues Encountered

- `accessibility.spec.ts:674` (телефон, «Информация») устарел и падает (`deferred-items.md`), это не проход.
- Физический бюджет кадров на телефоне остаётся BLOCKED до 20-14.

## Self-Check: PASSED

Файлы плана на диске; коммиты `ecf5173`, `eeb8a44`, `b2afe81`, `837a14a` проверены как предки HEAD при сдаче.
