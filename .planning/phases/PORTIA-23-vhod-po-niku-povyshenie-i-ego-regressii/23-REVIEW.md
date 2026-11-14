---
phase: PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii
reviewed: 2026-11-15T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - app/api/access/request/route.ts
  - app/portia.css
  - components/portia-access-gate.tsx
  - lib/access-gate-view.ts
  - lib/access-gate.test.ts
  - lib/access-request-reply.test.ts
  - lib/access-request-reply.ts
  - lib/style-tokens.test.ts
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
  necessity: 1
status: issues_found
---

# Phase 23: Code Review Report (round 3, gap closure 23-12)

**Reviewed:** 2026-11-15
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Объём: diff `d98723e..HEAD` для плана 23-12 (G-PORTIA-23-3-r2 и G-PORTIA-23-3-log): одноразовое уведомление «Доступ подтверждён» вместо карточки для одобренного посетителя и одна константная строка `console.error` на каждый отказ `unauthorized` при отправке заявки.

Структурных (fallow) находок не передавали. Оценку необходимости (#4100) я провёл по diff: одна находка IN-11 (недостижимая ветка).

Прогнал `lib/access-gate.test.ts`, `lib/access-request-reply.test.ts`, `lib/style-tokens.test.ts` на node 22.13.1: 27 тестов, 0 падений.

Проверено и признано корректным:

- Алерт. `reportAccessSubmit` получает только `result`, поэтому ник, хеш токена, IP-bucket, подпись и секрет не могут попасть в строку. Строка константная, без переводов строк. Вызывается на каждый ответ, а не раз на процесс. HTTP-ответ клиенту не изменился: `accessSubmitStatus` повторяет прежнюю карту статусов, а условие `Set-Cookie` не тронуто. Подделать `unauthorized` анонимный посетитель не может: подпись считает сервер, так что отказ возможен только при рассинхроне секрета или часов, и флуд логов от посетителя исключён.
- Логика раскладки. `approvedOnDesktop` исключает редактора (D-03, D-08, WR-04). В закрытом режиме `approved` всегда означает `allowed` (`access-gate.ts:83`), поэтому для одобренного карточка и кнопка «ПОДАТЬ ЗАЯВКУ» больше не показываются. Это закрывает часть WR-07 прошлого раунда, подробности в конце.
- `claimApprovedNotice`: ошибка чтения или записи в storage даёт `false` («нет уведомления»), а не «уведомление при каждой загрузке». Вызов `storage()` лежит внутри `try`, так что запрет доступа к `localStorage` тоже перехвачен. В хранилище пишется только `"1"`.
- Цвета `--teal` и `--teal-dim`, класс `.sr-only` и `.portia-dialog` существуют. Специфичность `.access-approved-toast .quest-toast-eyebrow` выше правила `.quest-toast-eyebrow` (строка 528), поэтому override срабатывает. Разметка и обработчик Escape повторяют `QuestToast` и `PromotionRetakeToast` в `portia-desktop.tsx`. Паттерн `role="status"` внутри `aside` проект уже принял, отдельной находкой я его не считаю.

Критичных проблем нет. Две проблемы класса WARNING (логика уведомления) и три INFO.

## Warnings

### WR-08: повторное одобрение на том же устройстве проходит молча, а `noticeOpen` не сбрасывается

**File:** `components/portia-access-gate.tsx:49-53`, `lib/access-gate-view.ts:42-57`
**Issue:** Ключ `portia-access-approved-notice-v1` ставится один раз на устройство, а не на одобрение. Сценарий: посетитель получил уведомление, позже доступ отозвали или заявку отклонили, он подал новую, и её одобрили. Статус идёт `rejected → pending → approved`, карточка со статусом «pending» исчезает (`approvedOnDesktop` скрывает карточку), а `claimApprovedNotice` возвращает `false`, потому что ключ уже `"1"`. Итог: заявка одобрена, рабочий стол появился, но ни карточки, ни уведомления, то есть единственная подтверждающая реакция пропала. То же для второго посетителя с другим ником на том же браузере. Второе следствие: `noticeOpen` никогда не сбрасывается в `false` при смене решения. Если уведомление ещё открыто, а статус ушёл `approved → revoked → approved` в одной сессии (poll раз в 5 секунд), оно покажется повторно без нового claim. Тест `claimApprovedNotice` проверяет только однократность и отказ storage, но не повторное одобрение.
**Fix:** Привязать claim к конкретному одобрению, а не ставить булев флаг. Записывать в хранилище не `"1"`, а несекретный идентификатор состояния (ник уже есть в `state.nickname`, но по CLAUDE.md и комментарию в коде ник в storage не хранят, поэтому лучше короткий хеш или счётчик «одобрений»). Минимальный вариант: сбрасывать флаг, когда статус стал не `approved`, чтобы следующее одобрение снова давало уведомление:
```ts
// в refresh(), после setView:
const isApproved = accessGateLayout({ kind: "decision", decision }, true).approvedNotice;
if (!isApproved) { noticeClaimed.current = false; setNoticeOpen(false); }
else if (!noticeClaimed.current) { noticeClaimed.current = true; if (claimApprovedNotice(...)) setNoticeOpen(true); }
```
и вместо постоянного ключа хранить в storage маркер конкретного одобрения (например, дату `decision.state` из ответа), чтобы «один раз на одобрение», а не «один раз на браузер». Если владелец осознанно выбрал «один раз на устройство» (D-решение G-PORTIA-23-3-r2), задокументировать, что повторное одобрение на этом устройстве молчит, и закрыть хотя бы сброс `noticeOpen`.

### WR-09: уведомление «Доступ подтверждён» накладывается на квест-тост, а один Escape может закрыть оба

**File:** `components/portia-access-gate.tsx:115, 147-176`, `app/portia.css:605, 1330, 619-620`
**Issue:** `AccessApprovedToast` использует класс `quest-toast`: `position: fixed; top: 106px; right: 12px; z-index: 965`. Тот же класс и те же координаты у `QuestToast` и `PromotionRetakeToast` в `portia-desktop.tsx`. Первый заход одобренного посетителя как раз совпадает по времени с квест-тостом: оба появляются после загрузки контента и окончания загрузочного экрана. Тосты встают в одну точку, а поздний по DOM (`AccessApprovedToast` рендерится после `PortiaDesktop`) перекрывает квест-тост целиком, пока его не закроют. Дополнительно Escape: `QuestToast` не вызывает `preventDefault()`, а `AccessApprovedToast` вызывает. Если квест-тост смонтировался раньше (его слушатель на `document` зарегистрирован раньше), один Escape закроет оба тоста (`defaultPrevented` ещё `false` у второго слушателя). Если позже, закроется только уведомление. Порядок зависит от времени монтирования, то есть поведение недетерминировано. Комментарий в коде («preventDefault keeps one Escape from also closing a quest notice opened later») описывает только один из двух порядков.
**Fix:** Разнести тосты по вертикали или показывать их очередью. Простой вариант: поднять уведомление выше или сдвинуть квест-тост, когда оно открыто:
```css
.access-approved-toast { border-color: var(--teal-dim); top: 16px; }
```
и убрать `preventDefault()` из обработчика уведомления (как в `QuestToast`), либо добавить `preventDefault()` во все три тоста, чтобы Escape закрывал ровно один. Лучше провести уведомление через ту же очередь тостов в `portia-desktop.tsx`, а не вторым независимым слоем.

## Info

### IN-11: ветка `approved` в `statusText` теперь недостижима

**File:** `components/portia-access-gate.tsx:108`
**Issue:** **Category:** necessity. Строка `"Доступ подтверждён. Открываем рабочий стол."` показывается, только если `showCard` истинно при `status === "approved"`. После 23-12 это значит `desktop === false`, то есть закрытый режим с `allowed === false`. Но `resolveGate` отдаёт `approved` только вместе с `allowed: true` (`lib/access-gate.ts:83`), поэтому состояние «одобрен, но не допущен» недостижимо. Тест `gate layout ... notAllowed` проверяет именно это искусственное состояние. Доказательство невозможности: единственная ветка, где `state.state === "approved"` в `closed`, возвращает `allowed: true`. Сообщение при этом ещё и было бы ложным («открываем рабочий стол», а он не открывается).
**Fix:** Удалить ветку `approved` из `statusText` и тестовый случай `notAllowed` (или оставить как защиту и поменять текст на нейтральный «Доступ подтверждён.»). Если ветка нужна как fail-safe, зафиксировать это комментарием.

### IN-12: пустой экран между исчезновением карточки и загрузкой `PortiaDesktop`

**File:** `components/portia-access-gate.tsx:11, 113-117`, `lib/access-gate-view.ts:33`
**Issue:** `PortiaDesktop` подгружается через `dynamic(..., { ssr: false })` без `loading`. Раньше одобренный посетитель видел карточку «Открываем рабочий стол» поверх загрузки. Теперь при `approved` карточка сразу скрыта (`approvedOnDesktop`), а чанк рабочего стола ещё не загружен: до появления загрузочного экрана `BootScreen` страница пуста. На медленной сети это заметная пауза без индикатора. Фокус тоже теряется: после отправки формы `statusRef.current?.focus()` выполняется уже на размонтированной карточке (`statusRef.current === null`), так что пользователь скринридера не получает ни фокуса, ни уведомления, если ключ claim уже занят (см. WR-08).
**Fix:** Передать `loading` в `dynamic`, например то же «Проверяем доступ…» или минимальный `boot-screen`, и после успешной отправки переносить фокус на `h1`/область уведомления, когда карточки нет.

### IN-13: тесты проверяют подстроки исходников, а не поведение `refresh()`

**File:** `lib/access-gate.test.ts` (тест «approved notice looks like the quest notice…»), `lib/access-request-reply.test.ts` (тест «the request route reports every result…»)
**Issue:** Тест на тост читает `portia-access-gate.tsx` и `portia.css` и проверяет `includes` для дословных строк (включая CSS-правила `.access-approved-toast { border-color: var(--teal-dim); }`). Тест маршрута требует `route.split("console.").length - 1 === 1`. Любая безвредная правка форматирования или добавление второго `console.*` в маршрут роняет тесты, а реальное связывание (claim один раз на страницу, `noticeOpen && layout.approvedNotice`) поведением не проверено: достаточно, чтобы строки остались в файле. Именно из-за этого WR-08 не ловится тестами. Закреплённый `PRE_PHASE_PORTIA_CSS_SHA256` в `style-tokens.test.ts` тоже придётся обновлять при каждой правке `portia.css`; это известный механизм фазы, но он добавляет шум.
**Fix:** Вынести логику «claim один раз» из `refresh()` в чистую функцию (принимает предыдущее состояние и новое решение, возвращает `{ claimed, open }`) и тестировать её поведением. Для маршрута оставить проверку, что в ответ не попадают секреты, а число `console.` не пинить.

## Previous reviews

Эта версия файла заменяет отчёт раунда 2. Его история сохранена здесь, чтобы не потерять ранние раунды.

**Раунд 2 (gap closure 23-09..23-11, G-PORTIA-23-4): 0 critical, 1 warning, 5 info.** Дифф `9a7b0db..HEAD`: fail-closed gate при отсутствующей функции closure, редактор скрыт от формы посетителя (WR-04), честный текст ошибки отправки (WR-03), миграция «closure ON по умолчанию». Findings:

- WR-07: одобренному или ожидающему посетителю предлагается «ПОДАТЬ ЗАЯВКУ», карточка статуса не закрывается сама (`access-gate-view.ts:35`, `portia-access-gate.tsx:106`). **Статус после 23-12: частично закрыто.** Для `approved` на рабочем столе карточка и кнопка больше не показываются (`approvedOnDesktop`). Остаётся для `pending`, `rejected`, `revoked` в режиме `open`: `showReopen: desktop && !editor && !approvedOnDesktop && !cardOpen` по-прежнему истинно, а `showForm` для `pending` ложно, то есть после «×» кнопка «ПОДАТЬ ЗАЯВКУ» не открывает форму (для `pending` её нет). Тест 23-12 («D-05 unchanged») закрепляет `showReopen: true` для `pending`. Не регрессия 23-12, но остаточный дефект WR-07.
- IN-06: `isMissingClosureFunction` объявлена как type predicate, который ложен для части `AccessStoreError` (`lib/access-gate.ts:26`).
- IN-07: текст «Проверьте соединение» при серверном отказе; магическое число 300 (`access-gate-view.ts`, `portia-access-gate.tsx`).
- IN-08: `routeEditorAccess` в `access-gate.test.ts` скопирован из status-маршрута без проверки совпадения.
- IN-09: replay `alter column` в `portia-migration-fingerprint.test.ts` не ловит многострочные и составные формы.
- IN-10: хрупкие константы и неэкранированные имена файлов в `phase23-evidence.test.ts`.

**Раунд 1 (перенесён из раунда 2, вне диффа, не пересматривался)**, по `23-REVIEW-DISPOSITION.md`: WR-02, WR-03, WR-04 исправлены. Открыты:

- WR-01: `app/api/promotion/test/route.ts` имеет GET и POST без `try/catch`.
- WR-05: `editor-request` молча заменяет cookie гостевого устройства.
- WR-06: `portia-promotion.tsx` «Проверяем доступ…» может зависнуть, плюс sentinel в `checkedNickname`.
- IN-01: `device-busy`, `unauthorized`, `unavailable` возвращаются как HTTP 503 (связано с IN-07; алерт 23-12 покрывает только `unauthorized`).
- IN-02: форма запроса редактора теряет причину для `cooldown` и `throttled`.
- IN-03: `import` в середине и в конце файла.
- IN-04: `AccessStoreError.code` содержит сообщение, а `sqlState` содержит код PostgREST.
- IN-05: дубль CSS-правила и переименованный «пин» хеша.

---

_Reviewed: 2026-11-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
