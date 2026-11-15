---
phase: PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische
plan: 08
subsystem: client-device-cache
tags: [sec-04, device-cache, access-gate, d-09, d-16, d-21, in-03, in-05, in-07, tracer]
status: complete

requires:
  - phase: PORTIA-25 plan 01
    provides: expand migration (server reads by viewer)
  - phase: PORTIA-25 plan 03
    provides: /api/employees behind the gate, answers 401 access-required
  - phase: PORTIA-25 plan 05
    provides: gate decision shape used by the client
  - phase: PORTIA-25 plan 06
    provides: gate mounts the desktop with an empty initial content
provides:
  - "lib/device-cache.ts: CONTENT_CACHE_KEY / EMPLOYEES_CACHE_KEY = -v2 (single source), LEGACY_CACHE_KEYS, purgeLegacyDeviceCaches, cacheMatchesViewer(cached, viewerKey, person), identityChanged"
  - "lib/access-viewer.ts: viewerPersonOf, cacheIdentityOf (viewer key + nickname key)"
  - "Gate wipes both device copies on any identity change between two answers; deletes the v1 copies once on mount"
  - "accessGateLayout: with closure off rejected and revoked read as none (D-09, D-21)"
  - "Desktop: copies of content and roster stamped with viewer and person and shown only to the same person and level; one writeContentCache; ordered 401 for content; 401 access-required from employees = lost access"
affects: [25-10 (browser proof of SEC-04 on a local build, review and matrix), 25-RELEASE-NOTES.md and 25-OWNER-CHECKLIST.md (marks "план 25-08")]

actuals:
  tokens: 12700
  tasks: 2
  commits: 2
plan_head_before: 8cd2cfa4aa553b6154fccf82eac4335cc255a07e
plan_head_after: 185726dac709dcea10fa5c7e80ed391d865543a1
commits: 2

tech-stack:
  added: []
  patterns:
    - "Cache identity = '<viewer key>|<nickname key>' compared between gate answers (first answer wipes nothing)"
    - "Key names in one module, imported by the desktop, the gate and the e2e specs"

key-files:
  created: []
  modified:
    - lib/device-cache.ts
    - lib/device-cache.test.ts
    - lib/access-viewer.ts
    - lib/access-viewer.test.ts
    - lib/access-gate-view.ts
    - lib/access-gate.test.ts
    - components/portia-access-gate.tsx
    - components/portia-desktop.tsx
    - lib/portia-desktop.test.ts
    - lib/level-visitor.test.ts
    - tests/e2e/specs/access-levels.spec.ts
    - tests/e2e/specs/app-states.spec.ts

key-decisions:
  - "person = nicknameKey of the approved request; empty for an editor and for an open-site visitor without approval. The gate passes it to the desktop as viewerPerson (the desktop does not import lib/nickname.ts, access-foundation test)."
  - "Identity change wipes both copies in either direction, including a level raise: a copy of another level cannot be shown anyway, and the rule does not depend on direction."
  - "The server key payload.viewer is not extended; person is a client-only stamp."
  - "writeContentCache takes person as an argument (the module-level function has no ref access); the plan sketched it inside."

requirements-completed: []  # SEC-04 is NOT checked off: the unit and source contracts pass, the browser proof on a local build is plan 25-10, authenticated roles and physical devices are BLOCKED

duration: about 40 min
completed: 2026-11-16

coverage:
  - id: D1
    description: "Gate wipes both -v2 copies on any identity change (approved to rejected/revoked, level up or down, editor leaving); first answer wipes nothing; closed-and-not-allowed rule kept"
    requirement: SEC-04
    verification:
      - { kind: test, ref: "lib/device-cache.test.ts#SEC-04: identityChanged", status: pass }
      - { kind: test, ref: "lib/access-viewer.test.ts#SEC-04: the cache identity", status: pass }
      - { kind: test, ref: "lib/level-visitor.test.ts#SEC-04: the gate wipes both device copies", status: pass }
    human_judgment: true
    rationale: "Behaviour in a browser (cache really empty after a revoke) is proved in plan 25-10; here only unit and source contracts."
  - id: D2
    description: "v1 copies deleted once on gate mount; keys -v2 from a single source, no literals in the desktop; e2e specs read the keys from lib/device-cache.ts"
    requirement: SEC-04
    verification:
      - { kind: test, ref: "lib/device-cache.test.ts#T-25-28", status: pass }
      - { kind: test, ref: "lib/portia-desktop.test.ts#STAB-DESK-07", status: pass }
      - { kind: command, ref: "node node_modules/typescript/bin/tsc --noEmit (e2e specs type-checked)", status: pass }
    human_judgment: false
  - id: D3
    description: "D-09/D-21: with closure off rejected and revoked show the card as none (form, reopen button, no status text); pending keeps its status; closed mode unchanged"
    requirement: SEC-04
    verification:
      - { kind: test, ref: "lib/access-gate.test.ts#gate layout: an approved visitor on an open desktop", status: pass }
      - { kind: test, ref: "lib/access-gate.test.ts#gate layout: closed mode keeps the rejected and revoked statuses", status: pass }
    human_judgment: true
    rationale: "Layout function proved; how the card looks in a browser is not asserted here."
  - id: D4
    description: "D-16: content and roster copies carry viewer and person; a copy of another person or level, or one without the stamp, is deleted before it is shown, at load and when the viewer changes"
    requirement: SEC-04
    verification:
      - { kind: test, ref: "lib/device-cache.test.ts#LVL-05, D-16", status: pass }
      - { kind: test, ref: "lib/portia-desktop.test.ts#device copies of content and roster are stamped", status: pass }
    human_judgment: true
    rationale: "Same-level-other-person is proved on the predicate and the source order, not in a browser."
  - id: D5
    description: "IN-03 one writeContentCache with documents; IN-05 keys from one source; IN-07 late 401 does not wipe a fresh copy; 401 access-required from /api/employees wipes and asks the gate"
    requirement: SEC-04
    verification:
      - { kind: test, ref: "lib/portia-desktop.test.ts#IN-07 and the roster 401", status: pass }
      - { kind: test, ref: "lib/portia-desktop.test.ts#device copies of content and roster are stamped", status: pass }
    human_judgment: false
---

# Phase 25 Plan 08: Кэш устройства по человеку и уровню Summary

Кэш устройства стирается при любой смене личности в ответе шлюза (человек или уровень), ключи `-v2` из одного модуля, старые `-v1` удаляются при монтировании шлюза, отклонённые и отозванные при выключенном закрытии видят экран как люди без заявки, а копии контента и сотрудников показываются только тому же человеку того же уровня.

## Что сделано

**Задача 1 (трассер, `bf3f1eb`).** Один путь через слои клиента: ответ `/api/access/status` -> `cacheIdentityOf(decision)` -> сравнение с прошлым ответом (`identityChanged`) -> `clearDeviceContentCaches` -> вид карточки.
- `lib/device-cache.ts`: `CONTENT_CACHE_KEY` / `EMPLOYEES_CACHE_KEY` теперь `-v2`, `LEGACY_CACHE_KEYS`, `purgeLegacyDeviceCaches`, `identityChanged(previous, next)` (первый ответ, `null`, ничего не стирает).
- `lib/access-viewer.ts`: `viewerPersonOf`, `cacheIdentityOf` = `<ключ зрителя>|<ключ ника>`.
- `components/portia-access-gate.tsx`: ref `previousIdentity` (стартует с `null`), стирание рядом с прежним правилом «закрыт и не допущен», `purgeLegacyDeviceCaches` в эффекте монтирования, проп `viewerPerson` для рабочего стола.
- `lib/access-gate-view.ts`: при `mode: "open"` состояния `rejected`/`revoked` читаются как `none` (D-09, D-21); закрытый режим не тронут.
- Рабочий стол импортирует константы ключей из `@/lib/device-cache` (IN-05), литералов `last-success` в нём нет; e2e-спеки передают ключи в `page.evaluate` аргументом.

**Задача 2 (`185726d`).**
- `cacheMatchesViewer(cached, viewerKey, person)`: копия без штампа `person` или с чужим не показывается.
- `writeContentCache` одна для записи после опроса и после сохранения, всегда с `documents`, `viewer`, `person` (IN-03).
- Копия сотрудников пишется со штампом `viewer`/`person` и проверяется на загрузке; эффект по `[viewerKey, viewerPerson]` удаляет копии чужого штампа.
- IN-07: 401 `access-required` от `/api/content` стирает кэш только при `requestSeq === contentRequestSeq.current`.
- 401 `access-required` от `/api/employees`: стереть кэши и сразу спросить шлюз, не «unexpected».

## Проверки

- Red-window gate (`node --experimental-strip-types --test` с двумя skip-паттернами, `lib/*.test.ts`): 2205 тестов, 2202 pass, 0 fail, 3 skipped.
- `node node_modules/typescript/bin/tsc --noEmit`: 0 ошибок (e2e-спеки в проверке).
- ESLint: 0 ошибок, 17 предупреждений (те же на HEAD до плана; в `tests/e2e/visual-candidates/.runs/` и других файлах вне плана).
- Критерии приёмки: `portia-content-last-success-v2` в `device-cache.ts` = 1; `last-success-v1` в рабочем столе и в обеих e2e-спеках = 0; `purgeLegacyDeviceCaches(` и `cacheIdentityOf(` в шлюзе по 1; `writeContentCache(` = 3; `viewerPerson` в рабочем столе = 11; строка `requestSeq === contentRequestSeq.current` стоит в ветке `access-required`.
- Трассер: после задачи 1 `<verify>` пройден до расширения (автоматический режим, ручных проверок нет).

## Отклонения от плана

**1. [Rule 3 - Blocker] `lib/level-visitor.test.ts` и `lib/access-viewer.test.ts` не в списке файлов плана**
- Найдено в: задача 1.
- Проблема: `lib/level-visitor.test.ts` пинил литералы `contentCacheStorageKey = "…-v1"` в рабочем столе и вызов `cacheMatchesViewer` с двумя аргументами; после замены ключей импортом тест падал. Тесты `cacheIdentityOf` логично лежат в `lib/access-viewer.test.ts`.
- Исправление: пины переписаны на импорт констант и трёхаргументный вызов; добавлен тест источника шлюза (стирание при смене личности до `setView`, очистка `-v1` в эффекте монтирования); добавлен тест `cacheIdentityOf`/`viewerPersonOf`.
- Коммиты: `bf3f1eb`, `185726d`.

**2. [Rule 1 - Design] `writeContentCache` принимает `person` аргументом**
- План описывал штамп «внутри»; функция уровня модуля не видит ref рабочего стола, поэтому вызовы передают `viewerPersonRef.current`. Поведение то же.

**Итого:** 1 авто-исправление (Rule 3), 1 уточнение сигнатуры. Влияния на область плана нет.

## Не сделано / за пределами плана

- `25-RELEASE-NOTES.md` (строки 13, 15) и `25-OWNER-CHECKLIST.md` (строка 23) всё ещё помечают кэш `-v2` и D-09/D-21 как «(план 25-08)»; эти файлы не входят в список плана. Для 25-10 или отдельного правка-коммита: снять пометки и заменить «Сейчас ключи `-v1`».
- В памяти рабочего стола список сотрудников, уже показанный до смены человека на странице, обновляется очередным опросом; повторный запрос сотрудников при смене зрителя не добавлялся (вне плана). Кэш устройства стирается сразу.
- Не доказано в браузере (план 25-10): что после отзыва `localStorage` пуст на локальной сборке. Роли с аутентификацией, Postgres/RLS, staging/production и физические устройства остаются BLOCKED.
- Требование SEC-04 не отмечено выполненным по этой причине.

## Known Stubs

Нет.

## Threat Flags

Нет новой поверхности: правки только на клиенте, без новых эндпоинтов и обращений к хранилищу (литералов `/api/` в рабочем столе не добавлено, пин сохранён).

## Self-Check: PASSED

- Файлы из key-files.modified существуют; коммиты `bf3f1eb` и `185726d` в истории ветки `design/stage-1-desktop`; `git rev-list --count` от `plan_head_before` до HEAD = 2.
