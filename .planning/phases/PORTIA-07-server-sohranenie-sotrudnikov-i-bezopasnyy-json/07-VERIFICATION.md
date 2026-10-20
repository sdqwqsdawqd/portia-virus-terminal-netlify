---
phase: PORTIA-07-server-sohranenie-sotrudnikov-i-bezopasnyy-json
verified: 2026-10-20T06:00:00Z
status: passed
score: 10/11 must-haves verified
covered_files:
  - ".planning/phases/PORTIA-07-server-sohranenie-sotrudnikov-i-bezopasnyy-json/07-01-PLAN.md"
  - ".planning/phases/PORTIA-07-server-sohranenie-sotrudnikov-i-bezopasnyy-json/07-01-SUMMARY.md"
  - ".planning/phases/PORTIA-07-server-sohranenie-sotrudnikov-i-bezopasnyy-json/07-02-PLAN.md"
  - ".planning/phases/PORTIA-07-server-sohranenie-sotrudnikov-i-bezopasnyy-json/07-02-SUMMARY.md"
  - ".planning/phases/PORTIA-07-server-sohranenie-sotrudnikov-i-bezopasnyy-json/07-03-PLAN.md"
  - ".planning/phases/PORTIA-07-server-sohranenie-sotrudnikov-i-bezopasnyy-json/07-03-SUMMARY.md"
  - ".planning/phases/PORTIA-07-server-sohranenie-sotrudnikov-i-bezopasnyy-json/07-04-PLAN.md"
  - ".planning/phases/PORTIA-07-server-sohranenie-sotrudnikov-i-bezopasnyy-json/07-04-SUMMARY.md"
  - "app/api/content/route.ts"
  - "app/api/editors/route.ts"
  - "app/api/employees/route.ts"
  - "components/portia-editor.tsx"
  - "lib/portia-employees.test.ts"
  - "lib/portia-employees.ts"
  - "lib/request-json.test.ts"
  - "lib/request-json.ts"
covered_digest: "v3:sha256:cd3f2912fce67ca374a8243ae4ba52981286ae7af7436562b89ae38fe16637eb"
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "35-й и последующие сотрудники таблицы не пропадают молча — лимит поднят или виден"
    reason: "Владелец подтвердил: в таблице ровно 34 места (строки 2-35), строки после 34-го не заполняются; лимит не поднимается и не предупреждает, правило записано у staffRowsEnd и в EMP-10 (07-CONTEXT D-13)"
    accepted_by: "владелец (решение D-13, 07-CONTEXT.md)"
    accepted_at: "2026-10-20T00:00:00Z"
human_verification:
  - test: "Добавить временного сотрудника вне таблицы, набрав ник в ДРУГОМ регистре, чем пишет Roblox (например, Roblox показывает jppk070, ввести JPPK070), затем удалить его"
    expected: "В списке и в ответе POST /api/employees ник показан в написании Roblox (jppk070), а не как набрано; повторное добавление в другом регистре даёт «Уже есть в списке»"
    why_human: "Живая проверка владельца вводила ник в том же регистре, что и Roblox, поэтому исправление регистра при добавлении (D-10) подтверждено только юнит-тестами с подменой Roblox; реальный ответ Roblox и запись в живую базу в этой ветке не проверялись"
---

# Фаза 7: Сервер: сохранение сотрудников и безопасный JSON — отчёт о проверке

**Цель фазы:** Сервер сохраняет сотрудника только по присланным полям, не зависит от Roblox и Google-таблицы и на плохой запрос отвечает 400, а не 500
**Проверено:** 2026-10-20
**Статус:** human_needed
**Повторная проверка:** Нет, первичная проверка

Исходная позиция была «цель не достигнута»; она опровергнута чтением кода, а не SUMMARY. Все критерии ROADMAP подтверждены кодом и тестами; открыт один пункт плана 07-04 (живая проверка регистра ника).

## Достижение цели

### Наблюдаемые истины

| # | Истина | Статус | Доказательство |
|---|--------|--------|----------------|
| 1 | SC1: сохранение с одним полем не трогает остальное; пустая оценка очищает только оценку; неверный тип даёт 400; старый формат принимается; проверено на тестовом сотруднике вне таблицы | ✓ VERIFIED | `sanitizeEmployeeUpdate` (lib/portia-employees.ts:~447) отдаёт только присланные ключи, неверный тип -> null -> 400 в PATCH; `saveEmployeeProfile` кладёт в upsert только присланные колонки, `knowledge_rating` из запроса не пишется. Тесты «one-field save writes only that column», «a rating key missing from the update is left out of the row; null and empty clear it», «wrong types in changes are refused», «the old whole-profile request is still accepted and never writes knowledge_rating» проходят. Живая проверка владельца (шаги 4-10) на roblox-9094194542, состояние перечитано оркестратором анонимным GET |
| 2 | SC2: сохранение известного сотрудника без 404 и без Roblox/таблицы; детали вне таблицы без полузаписи, верная причина ошибки | ✓ VERIFIED | `findKnownEmployee` (2 запроса к базе) -> известный id сохраняется без `fetchSheetRows` и без `resolveRobloxProfiles` (тест «a known employee is saved with zero network calls»). Новичок проверяется только по таблице; недоступная таблица -> `sheet-unavailable` -> 503, не 404. Детали пишутся первыми, при сбое профиля восстанавливаются только изменённые ключи; сбой деталей -> `details-failed` с текстом «Профиль не изменён.»; пропавшая строка -> 404 без записи профиля. Тесты на каждый из случаев проходят |
| 3 | SC3: пустое тело, не-JSON и не-объект в API сотрудников, редакторов и контента дают 400, а не 500 | ✓ VERIFIED | `parseJsonObject` (lib/request-json.ts) возвращает null на пустое/битое/не-объект; используется в employees PATCH/POST/DELETE, editors POST, content PUT; в app/api нет `request.json()`/`JSON.parse`. Проверка доступа стоит до чтения тела во всех обработчиках; content PUT сохраняет 413 до разбора. Editors DELETE без тела, 400 «Некорректный email.» уже был. Тесты `parseJsonObject` проходят; владелец подтвердил 400 на сломанных телах, DELETE "x" и POST /api/editors "x"; оркестратор: анонимный PATCH "x" -> 403 JSON |
| 4 | SC4a: ник сотрудника вне таблицы хранится в написании Roblox | ✓ VERIFIED | `addManualEmployee` вставляет и возвращает `nickname: found.name`, `mergeManualEmployees` показывает `profile?.name ?? row.nickname`, старые строки не переписываются. Тесты «a manual employee is stored and returned in Roblox spelling, whatever case was typed» и «an old manual row shows the Roblox spelling when Roblox answered…» проходят. Живая проверка регистра не делалась — см. пункт 9 |
| 5 | SC4b: отказ удалить сотрудника таблицы определяется по коду ответа | ✓ VERIFIED | DELETE отвечает 403 `{ error, code: "sheet-employee" }`; `removeSelected` проверяет `payload.code !== "sheet-employee"`; в редакторе нет сравнений по русскому тексту ошибки (grep). Тест «removing a sheet employee is refused and never issues a delete» |
| 6 | SC5: 35-й и последующие сотрудники таблицы не пропадают молча | ✓ PASSED (override) | Формулировка «лимит поднят или виден» заменена решением владельца D-13: в таблице ровно 34 места, строки после 34-го не заполняются, `staffRowsEnd = 35` с комментарием-правилом, запись EMP-10 в REQUIREMENTS.md говорит то же, тест «only the 34 staff slots are read…» проходит без изменений. Рекомендация: привести формулировку SC5 в ROADMAP.md к этому правилу |
| 7 | 07-04: объединённое дерево проходит npm test, tsc, eslint, build; dev-сервер отвечает JSON 403 на анонимный PATCH | ✓ VERIFIED | Мой прогон: `npm test` 231/231, `npx tsc --noEmit` без ошибок. eslint/build/dev-smoke — по данным оркестратора (eslint 0 ошибок, build OK, PATCH "x" -> 403 JSON) |
| 8 | 07-04: живая проверка владельца на временном сотруднике вне таблицы (шаги 4-10) | ✓ VERIFIED | 07-04-SUMMARY и перечитанное оркестратором состояние: первая запись создала строку только с биографией, одно-полевые записи не трогали остальное, null очистил только лапки, детали с одним ключом сохранили два других, неверный тип и битые тела -> 400. Сотрудник вне таблицы, `PUT /api/content` не вызывался (D-03) |
| 9 | 07-04: временный сотрудник добавлен с ником в другом регистре и показан в написании Roblox (D-10) | ? UNCERTAIN | Владелец набрал ник в том же регистре, что в Roblox; поведение подтверждено только юнит-тестами с подменой. Код прямолинеен (`found.name` из ответа Roblox `users`), риск низкий, но пункт плана буквально не выполнен вживую — см. «Нужна проверка человеком» |
| 10 | 07-04: сохранённая карточка сохраняет аватар и написание Roblox (слияние D-07) | ✓ VERIFIED | Код: `merged = { ...selected, ...payload.employee }`, ответ PATCH содержит только профиль (+ детали ручного). Шаг 11 владельца подтвердил живьём; удаление (шаг 12) подтверждено GET |
| 11 | 07-04: журналы ревью 03.1/03.2/03.3 отражают закрытое фазой, с коммитами | ✓ VERIFIED | 03.1: WR-02 (d3bfdd9), WR-03 (d3bfdd9, 05342e8), IN-03 (1ea2040), IN-06 (2cd4851, 423579e) fixed, open 18; 03.3: WR-03, IN-01, IN-02, IN-03 fixed с коммитами, IN-04 open (часть b закрыта, часть a — SEC-03); 03.2 WR-04 open с пометкой (серверная половина готова, редактор — EMP-02). Строка IN-01 честно сообщает, что регистр не проверялся вживую |

**Счёт:** 10/11 (из них 1 — PASSED по override; 1 — UNCERTAIN, 0 — behavior-unverified)

Поведенческие истины (откат деталей, отсутствие вызовов сети на известном пути) подкреплены именованными тестами, которые проходят, поэтому не помечены как PRESENT_BEHAVIOR_UNVERIFIED.

### Обязательные артефакты

| Артефакт | Ожидается | Статус | Детали |
|----------|-----------|--------|--------|
| `lib/request-json.ts` | `parseJsonObject` | ✓ VERIFIED | реальная реализация, используется 5 обработчиками |
| `lib/request-json.test.ts` | таблица плохих/хороших тел | ✓ VERIFIED | 2 теста проходят |
| `lib/portia-employees.ts` | частичные санитайзеры, upsert, `findKnownEmployee`, `saveEmployeePatch`, `RobloxProfile.name`, правило staffRowsEnd | ✓ VERIFIED | все экспорты на месте, подключены |
| `lib/portia-employees.test.ts` | тесты на каждую истину | ✓ VERIFIED | проходят |
| `app/api/employees/route.ts` | тонкий PATCH, код `sheet-employee` | ✓ VERIFIED | |
| `app/api/editors/route.ts`, `app/api/content/route.ts` | разбор через `parseJsonObject` | ✓ VERIFIED | |
| `components/portia-editor.tsx` | `payload.code`, слияние ответа, `nickname` в теле | ✓ VERIFIED | строки 1446, 1456, 1554 |
| Журналы ревью 03.1/03.2/03.3 | записи с коммитами | ✓ VERIFIED | |

### Проверка ключевых связей

| От | К | Через | Статус |
|----|---|-------|--------|
| employees/editors/content route | `parseJsonObject` | импорт и вызов | WIRED |
| employees PATCH | `saveEmployeePatch` | вызов, карта отказов статус -> ответ | WIRED |
| `saveEmployeePatch` | `findKnownEmployee` -> `saveEmployeeProfile`; только неизвестный id -> `fetchSheetRows` | прямые вызовы | WIRED |
| editor `removeSelected` | DELETE-отказ | `code: "sheet-employee"` | WIRED |
| editor `save` | PATCH | тело `{id, nickname, changes, details?}`, слияние ответа | WIRED |
| `resolveRobloxProfiles` | `addManualEmployee` / `mergeManualEmployees` | `name: user.name` | WIRED |

### Покрытие требований

| Требование | План | Статус | Доказательство |
|------------|------|--------|----------------|
| EMP-01 | 07-03, 07-04 | ✓ SATISFIED | истина 1 |
| EMP-03 | 07-03, 07-04 | ✓ SATISFIED | истина 2 |
| EMP-04 | 07-03, 07-04 | ✓ SATISFIED | истина 2 (детали первыми, откат, причины) |
| EMP-09 | 07-01, 07-02, 07-04 | ✓ SATISFIED (живой регистр — на проверку) | истины 4, 5 |
| EMP-10 | 07-02, 07-04 | ✓ SATISFIED (override D-13) | истина 6 |
| ROB-02 | 07-01, 07-04 | ✓ SATISFIED | истина 3 |

Все 6 ID из PLAN-фронтматтера есть в REQUIREMENTS.md (отмечены [x], Phase 7 / Complete). Осиротевших требований Phase 7 нет.

### Антипаттерны

Маркеров TBD/FIXME/XXX в файлах фазы нет (новые `shortcut:` задокументированы). Заглушек нет.

Замечания ревью 07-REVIEW.md (0 critical, все 6 open, советующие):

| Файл | Замечание | Серьёзность | Влияние |
|------|-----------|-------------|---------|
| lib/portia-employees.ts:~523 | WR-01: id `roblox-<цифры>` не привязан к нику новичка (нужен подделанный запрос редактора) | Warning | не нарушает критерии; рекомендуется закрыть до выхода (риск порчи идентичности ростера) |
| lib/portia-employees.ts:~523 | WR-02: ошибка заголовков таблицы в проверке новичка даёт 500, а не 503 | Warning | сообщение менее точное |
| app/api/employees/route.ts DELETE | WR-03: сбой чтения ручных строк даёт 404 вместо 503 | Warning | ложный текст при сбое базы |
| lib/portia-employees.ts:459 | IN-01: `photoUrl` допускает `//host` | Info | предшествует фазе |
| lib/portia-employees.ts:545 | IN-02: результат отката деталей не логируется | Info | |
| components/portia-editor.tsx:1456 | IN-03: слияние в устаревшее замыкание `selected` | Info | |

### Нужна проверка человеком

### 1. Регистр ника при добавлении сотрудника вне таблицы (D-10)

**Тест:** добавить временного сотрудника, набрав ник в другом регистре, чем пишет Roblox (Roblox: `jppk070`, ввести `JPPK070`), затем удалить его.
**Ожидается:** в списке и в ответе ник в написании Roblox; повторное добавление в другом регистре даёт «Уже есть в списке».
**Почему человек:** живая проверка владельца вводила ник в том же регистре; исправление подтверждено только юнит-тестами с подменой Roblox. Если владелец считает юнит-покрытие достаточным, можно принять как override (accepted_by владелец).

### Итог

Цель фазы достигнута в коде: частичное сохранение, независимость известного сотрудника от Roblox/таблицы, безопасный JSON с 400, код отказа вместо русской строки, правило 34 мест. Блокеров нет. Единственный открытый пункт — живая проверка регистра ника (низкий риск). Замечания ревью WR-01..WR-03 остаются советующими.

---

_Проверено: 2026-10-20_
_Верификатор: Claude (gsd-verifier)_
