---
phase: PORTIA-07-server-sohranenie-sotrudnikov-i-bezopasnyy-json
verified: 2026-10-20T07:00:00Z
status: passed
score: 11/11 must-haves verified
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
covered_digest: "v3:sha256:343045c0e71199ce41f949a8878732e46e7d4b01b9ff6cde2979defeeaa67502"
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "35-й и последующие сотрудники таблицы не пропадают молча — лимит поднят или виден"
    reason: "Владелец подтвердил: в таблице ровно 34 места (строки 2-35), строки после 34-го не заполняются; лимит не поднимается и не предупреждает, правило записано у staffRowsEnd и в EMP-10 (07-CONTEXT D-13)"
    accepted_by: "владелец (решение D-13, 07-CONTEXT.md)"
    accepted_at: "2026-10-20T00:00:00Z"
re_verification:
  previous_status: passed
  previous_score: 10/11
  gaps_closed:
    - "Истина 9 (D-10, регистр ника): закрыта живой проверкой владельца, 07-UAT.md 1/1 pass"
  gaps_remaining: []
  regressions: []
---

# Фаза 7: Сервер: сохранение сотрудников и безопасный JSON — отчёт о проверке

**Цель фазы:** Сервер сохраняет сотрудника только по присланным полям, не зависит от Roblox и Google-таблицы и на плохой запрос отвечает 400, а не 500
**Проверено:** 2026-10-20
**Статус:** passed
**Повторная проверка:** Да — прежний отчёт устарел: коммиты ревью-фиксов 364404d, a63990d, 4a21aa2 изменили покрываемые исходники; закрыт пункт человеческой проверки D-10

Исходная позиция «цель не достигнута» опровергнута чтением кода и дифов, а не SUMMARY. Все критерии ROADMAP подтверждены; ревью-фиксы регрессий не вносят.

## Достижение цели

### Наблюдаемые истины

| # | Истина | Статус | Доказательство |
|---|--------|--------|----------------|
| 1 | SC1: сохранение с одним полем не трогает остальное; пустая оценка очищает только оценку; неверный тип даёт 400; старый формат принимается | ✓ VERIFIED | `sanitizeEmployeeUpdate` отдаёт только присланные ключи, неверный тип -> 400 в PATCH; `saveEmployeeProfile` кладёт в upsert только присланные колонки, `knowledge_rating` из запроса не пишется. Именованные тесты проходят (234/234); живая проверка владельца на roblox-9094194542 |
| 2 | SC2: сохранение известного сотрудника без 404 и без Roblox/таблицы; детали вне таблицы без полузаписи, верная причина ошибки | ✓ VERIFIED | `findKnownEmployee` -> известный id сохраняется без `fetchSheetRows`/`resolveRobloxProfiles` (тест «a known employee is saved with zero network calls»). Новичок проверяется только по таблице; недоступная таблица -> 503. Детали пишутся первыми, откат только изменённых ключей. Ревью-фиксы WR-01/WR-02 сужают только ветку новичка и не затрагивают известный путь (дифы просмотрены) |
| 3 | SC3: пустое тело, не-JSON и не-объект в API сотрудников, редакторов и контента дают 400, а не 500 | ✓ VERIFIED | `parseJsonObject` используется во всех пяти обработчиках; `grep "request\.json()\|JSON\.parse" app/api` — пусто; проверка доступа раньше чтения тела; DELETE после 4a21aa2 по-прежнему сначала разбирает тело и отвечает 400 на отсутствие id |
| 4 | SC4a: ник сотрудника вне таблицы хранится в написании Roblox | ✓ VERIFIED | `addManualEmployee` пишет и возвращает `found.name`; юнит-тесты проходят; живая проверка владельца (07-UAT) |
| 5 | SC4b: отказ удалить сотрудника таблицы определяется по коду ответа | ✓ VERIFIED | DELETE -> 403 `{ error, code: "sheet-employee" }`; редактор сверяет `payload.code`. Новый ответ 503 от WR-03 идёт до `removeManualEmployee` и не затрагивает этот код |
| 6 | SC5: 35-й и последующие сотрудники таблицы не пропадают молча | ✓ PASSED (override) | Решение владельца D-13: 34 места, `staffRowsEnd = 35` (lib/portia-employees.ts:93, `rows.slice(1, staffRowsEnd)`), EMP-10 в REQUIREMENTS.md отражает то же правило. Override сохранён |
| 7 | 07-04: объединённое дерево проходит npm test и tsc | ✓ VERIFIED | Мой прогон: `npm test` 234/234 (было 231; +3 теста ревью-фиксов), `npx tsc --noEmit` без ошибок |
| 8 | 07-04: живая проверка владельца на временном сотруднике вне таблицы (шаги 4-10) | ✓ VERIFIED | 07-04-SUMMARY и перечитанное оркестратором состояние |
| 9 | 07-04: временный сотрудник с ником в другом регистре показан в написании Roblox (D-10) | ✓ VERIFIED | 07-UAT.md: status complete, 1/1 pass — владелец добавил ник в другом регистре на localhost:3123, показано в написании Roblox, дубль в другом регистре отклонён, затем удалён (оркестратор видел POST 201 / DELETE 200). Подкреплено юнит-тестами |
| 10 | 07-04: сохранённая карточка сохраняет аватар и написание Roblox (слияние D-07) | ✓ VERIFIED | `merged = { ...selected, ...payload.employee }`; живая проверка владельца |
| 11 | 07-04: журналы ревью 03.1/03.2/03.3 отражают закрытое фазой, с коммитами | ✓ VERIFIED | как в прежнем отчёте; 07-REVIEW-DISPOSITION.md обновлён записью о ревью-фиксах (9e76475) |

**Счёт:** 11/11 (из них 1 — PASSED по override; 0 — behavior-unverified)

### Проверка ревью-фиксов на регрессии (git show)

| Коммит | Изменение | Регрессия? | Доказательство |
|--------|-----------|-----------|----------------|
| 364404d (WR-01) | в ветке новичка id `roblox-N` сверяется с сохранённым id ника; несовпадение -> `not-found`, без записи | Нет | Ветка выполняется только при `!hasProfile && !manual`; известный путь, ник-формат `nick-...` и новичок без сохранённого id проходят как прежде. Тест «a newcomer id cannot be re-pointed» (test:314) проходит. Остаточный риск (первая запись неверного id для ника без сохранённого id) честно описан в 07-REVIEW-FIX и AR-07-03 |
| a63990d (WR-02) | `rosterFromRows` внутри `try`; смена заголовка -> `sheet-unavailable` (503) | Нет | поведение при недоступной таблице прежнее; ветка не касается известного пути (EMP-03) |
| 4a21aa2 (WR-03) | `loadEmployees` отдаёт `manualRead`; DELETE даёт 503 при `!manualRead` | Нет | `complete` и `profilesRead` не менялись; недостающая таблица считается здоровым чтением; тест (test:361-363) проходит |

### Обязательные артефакты и связи

Без изменений относительно прежнего отчёта: `lib/request-json.ts`, `lib/portia-employees.ts` (+тесты), три route-файла и `components/portia-editor.tsx` существуют, содержательны и подключены (parseJsonObject -> 5 обработчиков; PATCH -> `saveEmployeePatch` -> `findKnownEmployee`/`saveEmployeeProfile`; `removeSelected` -> `code: "sheet-employee"`). Level 4: данные идут из реальных запросов к базе, статических заглушек нет.

### Покрытие требований

| Требование | Статус | Доказательство |
|------------|--------|----------------|
| EMP-01 | ✓ SATISFIED | истина 1 |
| EMP-03 | ✓ SATISFIED | истина 2 |
| EMP-04 | ✓ SATISFIED | истина 2 |
| EMP-09 | ✓ SATISFIED | истины 4, 5, 9 (живой регистр подтверждён) |
| EMP-10 | ✓ SATISFIED (override D-13) | истина 6 |
| ROB-02 | ✓ SATISFIED | истина 3 |

Все 6 ID есть в REQUIREMENTS.md ([x], Phase 7 / Complete). Осиротевших нет.

### Безопасность

07-SECURITY.md: status verified, threats_open 0.

### Антипаттерны

Маркеров TBD/FIXME/XXX в изменённых файлах нет. Замечания ревью WR-01..WR-03 закрыты; IN-01..IN-03 — info, предшествуют фазе или косметические, фазу не блокируют.

### Нужна проверка человеком

Нет. Прежний пункт (D-10, регистр ника) закрыт 07-UAT.md.

### Итог

Цель фазы достигнута: частичное сохранение по присланным полям, независимость известного сотрудника от Roblox и таблицы, безопасный JSON с 400, код отказа вместо русской строки, правило 34 мест (override D-13). Блокеров, пробелов и человеческих пунктов нет. Рекомендация: привести формулировку SC5 в ROADMAP.md к правилу D-13.

---

_Проверено: 2026-10-20_
_Верификатор: Claude (gsd-verifier)_
