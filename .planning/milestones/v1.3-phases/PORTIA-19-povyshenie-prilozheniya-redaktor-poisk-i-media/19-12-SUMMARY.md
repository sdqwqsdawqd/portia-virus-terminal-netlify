---
phase: 19-povyshenie-prilozheniya-redaktor-poisk-i-media
plan: 12
subsystem: ui
tags: [editor, save-status, revision-conflict, partial-save, d-09, d-10, d-12]
requires:
  - phase: 19-01
    provides: 19-OWNER-DECISIONS.md verdict 5 («Заменить своей» без отдельного диалога)
  - phase: 19-02
    provides: UI-SPEC E3 (единый словарь статуса, панель конфликта, частичная ошибка)
  - phase: 19-11
    provides: lib/app-state.ts syncTimeText и общий каркас portia-desktop.tsx
provides:
  - lib/editor-save-status.ts (SaveStatus, saveStatusText, partialSave, draftEdits, SaveConflictError, SectionClosedError, parseRefusedSections, networkSaveError)
  - ConflictPanel и блок «Ваши правки» в portia-editor.tsx
  - историческое действие "saved" с необязательными keep/rebase в lib/editor-history.ts
affects: [19-13, 19-14]
status: complete
actuals:
  tokens: 10650
  tasks: 3
  commits: 3
plan_head_before: 167f73bbd09a112d22ba5406cc7e9835bedfabe8
plan_head_after: cae93e32f03eae4559f05d8e32931c4f57434477
tech-stack:
  added: []
  patterns:
    - "Типизированные ошибки из saveContent (SaveConflictError, SectionClosedError) вместо общего Error: редактор решает по instanceof, API не меняется."
    - "Статус сохранения = одна функция saveStatusText(status, counts); статус выводится из ответа сервера (saveState) и чистоты черновика, а не из оптимистичного флага."
    - "Повторная отправка без отказанных разделов = revertSections(serverBase, wanted, refused); reducer получает keep (полный черновик) чтобы отказанные правки остались несохранёнными."
key-files:
  created:
    - lib/editor-save-status.ts
    - lib/editor-save-status.test.ts
  modified:
    - components/portia-editor.tsx
    - components/portia-desktop.tsx
    - lib/editor-history.ts
    - app/portia.css
key-decisions:
  - "Вердикт 5 (вариант A): «Заменить своей» без ConfirmDialog; рядом с кнопкой стоит «Их изменения будут перезаписаны.» и связано aria-describedby."
  - "«Заменить своей» заменяет на уровне разделов: разделы, которые пользователь менял, уходят его версией поверх последней серверной ревизии, остальные и закрытые берутся с сервера (T-19-26). Так чужие правки в нетронутых разделах не откатываются молча."
  - "Панель конфликта активна (кнопки без aria-disabled) только когда подтянута серверная версия: revision из props отличается от ревизии, на которой строился отказанный save."
  - "Статус «Сохранено» остаётся производным: saveState==='saved' && черновик чист; таймер гашения 4000ms в desktop и в редакторе сотрудников."
requirements-completed: []
requirements-advanced: [STAB-APP-07]
---

# Phase 19 Plan 12: Editor save status, revision conflict and partial save Summary

Редактор показывает статус сохранения одним словарём и только по ответу сервера, при 409 даёт явный выбор «Загрузить их версию» / «Заменить своей» без потери правок и при отказе сервера по части разделов сохраняет остальные с итогом «Сохранено N из M».

## Tasks

| Task | What | Commit |
|------|------|--------|
| 1 tracer | `lib/editor-save-status.ts` (`saveStatusText`, `partialSave`); статус редактора и редактора сотрудников из одной лексики, без заглавных вариантов; «Сохранено» гаснет через 4s; кнопка «Сохранить» `aria-disabled` и синхронный `inflight`-замок против дубля запроса; `.editor-save-status.dirty/.partial` | d4af198 |
| 2 | 409 бросает `SaveConflictError` и перечитывает серверную копию; `ConflictPanel` (role=alert) над формой; `<details>` «Ваши правки» с «Копировать» по каждому полю (`draftEdits`); «Заменить своей» с ревизией последней серверной версии; отдельный текст «Нет связи с сервером. Попробуйте ещё раз.»; reducer `saved` принимает `keep`/`rebase` | 7a20e66 |
| 3 | 403 `section-closed` бросает `SectionClosedError` с `refusedSections`; редактор один раз повторяет отправку без отказанных разделов; они остаются черновиками (маркер `data-save-error`, `role="alert"` текст, `aria-describedby`, фокус на первой вкладке); «Сохранено N из M» держится до следующей правки; повтор отправляет только оставшиеся | cae93e3 |

## Verification

- `node --experimental-strip-types --test lib/editor-save-status.test.ts`: 25 pass, 0 fail.
- `lib/editor-history.test.ts lib/editor-changes.test.ts lib/content-sync.test.ts lib/editor-tabs.test.ts`: 95 pass, 0 fail, ожидания не менялись.
- `npm test`: 1022 pass, 3 fail. Все три падения были на базе 167f73b до плана (проверено на `git archive 167f73b`): `lib/phase16-guard-boundary.test.ts` (нет `.claude/hooks/guard.mjs` в worktree), «every result type opens its owner ... (D-14, STAB-SEARCH-02)» и «editor form cards ... (D-15)» в `lib/portia-desktop.test.ts`. Новых падений нет.
- `npm exec tsc -- --noEmit`: одна ошибка TS2307 в `lib/phase16-guard-boundary.test.ts` (та же отсутствующая `guard.mjs`); новых нет.
- `npm run lint`: 0 ошибок, 14 предупреждений (столько же, сколько на базе).
- `next build --webpack --experimental-build-mode compile` из worktree: проходит (`npm run build` с Turbopack на junction `node_modules` не используется, см. заметки оркестратора).
- `git diff --name-only -- app/api/` пуст.

## Deviations from Plan

### Auto-fixed / adjustments

**1. [Rule 2 - correctness] «Заменить своей» работает по разделам, а не всем черновиком**
- **Found during:** Task 2
- **Issue:** отправка всего черновика с новой ревизией откатила бы чужие правки в разделах, которых пользователь не касался (его baseline старый), то есть молча перезаписала бы чужую ревизию (D-09, prohibition 1). Закрытые разделы так же откатились бы к устаревшему baseline и сервер отказал бы по `contentRefusal` (T-19-26).
- **Fix:** `revertSections(content /* серверная копия */, normalized, [не менявшиеся + закрытые])`; при вводе во время запроса `rebase` подтягивает не тронутые разделы черновика к сохранённой копии.
- **Files modified:** components/portia-editor.tsx, lib/editor-history.ts
- **Commit:** 7a20e66

**2. [Rule 3 - blocking] Отказанные правки не удержались бы в reducer**
- **Found during:** Task 3
- **Issue:** действие `saved` заменяло черновик на сохранённую копию, так что отказанный раздел терял правки.
- **Fix:** необязательные поля `keep` (черновик при отсутствии набора во время запроса) и `rebase` (проекция набранного во время запроса). Поведение без них прежнее, `editor-history.test.ts` не менялся.
- **Commit:** 7a20e66

**3. Единый статус живёт во всплывающем окне чипа.** В редакторе нет шапки с `.editor-save-status`: он существовал только внутри popover чипа (виден при несохранённых правках) и в `sr-only` aria-live. Структуру не менял: один словарь питает чип, popover и `role="status" aria-live="polite"`. Для ошибки сервера рядом с «Не удалось сохранить» выводится текст сервера (если строка) или «Нет связи с сервером. Попробуйте ещё раз.».

**4. TDD:** тесты и реализация писались и коммитятся вместе на задачу (один `feat`-коммит); раздельных RED/GREEN-коммитов нет и падение теста до реализации отдельно не фиксировалось.

**5. «ОТМЕНИТЬ» в popover тоже `aria-disabled` во время запроса** (было `disabled`), по тому же принципу «не терять фокус»; обработчик игнорирует клик.

## Known Gaps (не блокируют цель плана)

- Ошибка под конкретным полем (Label 11px под полем из UI-SPEC «Частичная ошибка») не сделана: план требует маркер у раздела, он есть (вкладка + `role="alert"` текст + `aria-describedby`). Полевые ошибки не входили в `must_haves`.
- Серверные поля `formattedText` не попадают в «Ваши правки» (стили без смены текста не копируются); значения текстовых полей попадают, так как строковое поле и его документ меняются вместе.
- Плашка D-11 «Запись изменили» при poll во время ввода, права и WYSIWYG остаются за 19-13.

## BLOCKED lanes

- Браузерный прогон авторизованного редактора (409 / 403 section-closed / «Сохранено N из M» на живом сервере): **BLOCKED (ENV)**, изолированных учётных данных редактора для staging в worktree нет, а production Supabase не используется. Поведение закрыто source- и поведенческими тестами на реальных helpers (`contentRefusal`, `revertSections`, `changedSections`, `historyReducer`). Физическая проверка владельцем PC/phone: 19-14.

## Known Stubs

Нет.

## Threat Flags

Нет новой сетевой поверхности: API, auth и схема не менялись. T-19-26: `contentRefusal` на сервере не тронут; закрытые разделы реверсируются до отправки к серверной копии; T-19-SC: пакеты не устанавливались.

## Self-Check: PASSED

- lib/editor-save-status.ts, lib/editor-save-status.test.ts, этот SUMMARY: FOUND
- Коммиты d4af198, 7a20e66, cae93e3 лежат на gsd/19-12-editor-save: FOUND
