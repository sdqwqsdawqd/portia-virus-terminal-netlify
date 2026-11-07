---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 45
subsystem: ui
tags: [accessibility, wcag-2.5.3, label-in-name, format-launch, editor, gap-closure, d-57]

requires:
  - phase: PORTIA-20-security-accessibility-i-priemka-reliza
    provides: 20-37 (D-57, FormatLaunchButton в конструкторе шаблона), lib/format-launch.ts
provides:
  - кнопка «ОФОРМЛЕНИЕ» редактора сайта — общий FormatLaunchButton, доступное имя содержит видимый текст целыми словами
  - постоянная охрана в lib/format-launch.test.ts: portia-editor.tsx равен образцу 449c756 плюс единственная разрешённая замена
affects: [20-13, 20-43, 20-44, 20-47, следующая правка components/portia-editor.tsx]

estimate_actuals_note: "chars/4 над diff a3e43e3..7696015 (12576 символов)"
actuals:
  tokens: 3144
  tasks: 2
  commits: 2

plan_head_before: a3e43e36757929d192c9272ccff59f2f85eafb95
plan_head_after: 769601524e4d76773bede7be2c1f063365b17211

key-files:
  created: []
  modified:
    - components/portia-editor.tsx
    - lib/format-launch.test.ts

key-decisions:
  - "D-57 для редактора: встроенный блок кнопки запуска заменён общим FormatLaunchButton (одна строка) и имя добавлено в импорт; больше в файле ничего не менялось."
  - "Охрана берёт образец 449c756 из git (git show) и требует полной истории; shallow-клон, отсутствие git или коммита-образца роняют тест с понятным сообщением, а не пропускают."
  - "Любая будущая одобренная правка components/portia-editor.tsx обязана расширить охрану (новый образец или новая разрешённая замена), иначе тест упадёт (D-58)."

requirements-completed: [STAB-A11Y-01, STAB-A11Y-03]

coverage:
  - id: D1
    description: "Кнопка «ОФОРМЛЕНИЕ» редактора — общий FormatLaunchButton; в исходнике нет прежних литералов имени и встроенного блока"
    requirement: "STAB-A11Y-01"
    verification:
      - kind: unit
        ref: "lib/format-launch.test.ts#D-57: the editor renders the shared launch button"
        status: pass
    human_judgment: false
  - id: D2
    description: "Постоянная охрана: components/portia-editor.tsx отличается от образца 449c756 только заменой кнопки запуска и именем в импорте; охрана ловит постороннюю правку"
    requirement: "STAB-A11Y-03"
    verification:
      - kind: unit
        ref: "lib/format-launch.test.ts#D-57: portia-editor.tsx differs from 449c756 only by the launch button hunk"
        status: pass
      - kind: unit
        ref: "lib/format-launch.test.ts#D-57: the guard notices any other edit, a missing hunk and an unreadable sample"
        status: pass
    human_judgment: false
  - id: D3
    description: "Имя кнопки в живом редакторе в браузере (axe label-content-name-mismatch) и озвучивание экранным диктором"
    requirement: "STAB-A11Y-01"
    verification: []
    human_judgment: true
    rationale: "BLOCKED (ENV): живой редактор требует роли редактора, полоса ролей в accessibility.spec.ts не выполнима без неё; диктор — BLOCKED (DEVICE). Компонент тот же, что проверяется axe в полосе конструктора шаблона."

duration: 3 min
completed: 2026-11-07
status: complete
---

# Phase PORTIA-20 Plan 45: Кнопка «ОФОРМЛЕНИЕ» редактора на общем FormatLaunchButton Summary

**Доступное имя кнопки «ОФОРМЛЕНИЕ» в редакторе сайта теперь содержит видимый текст целыми словами (общий FormatLaunchButton, D-57), а постоянный git-тест гарантирует, что это единственная правка components/portia-editor.tsx.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-11-07T06:45:04Z
- **Completed:** 2026-11-07T06:47:26Z
- **Tasks:** 2
- **Files modified:** 2
- **PLAN_BASE:** a3e43e36757929d192c9272ccff59f2f85eafb95
- **Node:** 22.13.1 (из `%TEMP%\portia-node-v22.13.1\node-v22.13.1-win-x64`)

## Accomplishments

- Для пользователя изменилось только доступное имя кнопки (и озвучиваемая подсказка экранного чтеца): в пустом состоянии оно начинается с «выберите текст», в состоянии с полем содержит «ОФОРМЛЕНИЕ <название поля>». Видимые надписи, подсказка под кнопкой, title, aria-expanded, снятие фокуса с поля на телефоне и переключение панели — прежние, потому что `FormatLaunchButton` рендерит ту же разметку.
- Встроенный блок `global-format-launch` (20 строк) в components/portia-editor.tsx заменён одной строкой `FormatLaunchButton`; имя добавлено в существующий импорт, `findFormatField` остаётся (используется дальше).
- Введена постоянная охрана (ранее правило 20-39 жило только в acceptance плана): образец файла берётся `git show 449c756…:components/portia-editor.tsx`, в нём блок кнопки заменяется на строку FormatLaunchButton, имя добавляется в импорт, результат сравнивается с текущим файлом. Самопроверка: лишняя строка, лишний перевод строки и файл без встроенного блока дают расхождение/ошибку.
- Шапка теста фиксирует: нужен полный клон (не shallow), перечень одобренных правок (449c756 — баг владельца, D-57 — кнопка) и правило «любая будущая одобренная правка расширяет охрану».

## Task Commits

1. **Task 1 (tracer, RED):** `6bb8cf9` (test) — охрана и проверка имени. RED подтверждён: на прежнем редакторе падали «D-57: the editor renders the shared launch button» (в исходнике ещё встроенный блок и литерал «Оформление текста: ») и «D-57: portia-editor.tsx differs from 449c756 only by the launch button hunk» (расхождение на строке 35 — импорт без FormatLaunchButton); прежние тесты и самопроверка охраны проходили (pass 6, fail 2).
2. **Task 1 (GREEN):** `7696015` (fix) — кнопка редактора на FormatLaunchButton; `node --experimental-strip-types --test lib/format-launch.test.ts lib/portia-template-builder.test.ts` — 20/20 pass, tsc exit 0.
3. **Task 2:** отдельного коммита нет — полный прогон выявил расхождений, правка теста не потребовалась.

editor_fix_commit: 769601524e4d76773bede7be2c1f063365b17211

`git diff --numstat a3e43e3 HEAD -- components/portia-editor.tsx`: добавлено 2, удалено 21. `lib/format-launch.test.ts`: добавлено 123, удалено 1 (переименование теста конструктора).

**Plan metadata:** коммит `docs(PORTIA-20-45)` следует за этим файлом.

## Files Created/Modified

- `components/portia-editor.tsx` — встроенная кнопка запуска формата заменена `FormatLaunchButton`; импорт дополнен.
- `lib/format-launch.test.ts` — тесты D-57 (имя в редакторе, охрана образца 449c756, самопроверка охраны), шапка с предусловием и списком одобренных правок; тест конструктора переименован («D-57 (20-37): the template builder uses the shared launch button»).

## Decisions Made

- Охрана запоминает правку по образцу в истории, а не по копии файла в репозитории: копия образца дублировала бы ~1700 строк редактора.
- Позиция `FormatLaunchButton` в импорте — после `FloatingTextFormatPanel`; та же строка закреплена в охране, поэтому порядок имён менять нельзя без правки охраны.

## Deviations from Plan

**1. [Rule 1 - Plan arithmetic] Предел удалённых строк в acceptance: 19, фактически 21**
- **Found during:** Task 1 (проверка acceptance_criteria)
- **Issue:** План считает встроенный блок строками 1212-1229 (18 строк), но блок включает `<small>` и закрывающий `</div>`, то есть 1212-1231 (20 строк); вместе со строкой импорта удалено 21, добавлено 2. Критерий «не больше 19 удалённых» ошибочно арифметически; его цель («только блок и строка импорта») выполнена, и её независимо подтверждает охрана (разница с образцом равна ровно разрешённой замене).
- **Fix:** нет, правка редактора верна; зафиксировано в SUMMARY.
- **Files modified:** нет
- **Verification:** `git diff --numstat` 2/21; тест «differs from 449c756 only by the launch button hunk» проходит.

**2. [Rule 3 - Blocking] `npm exec tsc` и `npm run lint` не запускаются через npm на Node 22.13.1 из %TEMP%**
- **Found during:** Task 1/2 (verify)
- **Issue:** npm падает с `Cannot find module 'node-gyp/bin/node-gyp.js'` (сбой, предусмотренный планом).
- **Fix:** прямые команды из плана: `node node_modules/typescript/bin/tsc --noEmit` (exit 0) и `node node_modules/eslint/bin/eslint.js . --ignore-pattern dist --ignore-pattern .next` (0 errors, 17 warnings, все прежние).
- **Files modified:** нет

**Total deviations:** 2 (1 ошибка арифметики плана, 1 блокирующий обходной путь команд). **Impact:** без влияния на результат.

## Issues Encountered

- Первый вариант регулярного выражения импорта в тесте был записан в шаблонной строке с `\s`/`\{` (теряет обратные косые); заменён на литерал регулярного выражения до коммита RED.
- Хук lint-edited один раз сообщил `'FormatLaunchButton' is not defined` между двумя правками редактора (импорт ещё не был добавлен); после второй правки ошибок нет.

## Проверка

- `node --experimental-strip-types --test lib/*.test.ts`: tests 1521, pass 1517, fail 0, skipped 4.
- `node node_modules/typescript/bin/tsc --noEmit`: exit 0.
- eslint: 0 errors; предупреждений в components/portia-editor.tsx и lib/format-launch.test.ts новых нет (только прежние `no-img-element`).
- acceptance Task 1: `grep -c FormatLaunchButton components/portia-editor.tsx` = 2; `grep -c 'Оформление текста: '` = 0.
- Сборка и Playwright в плане не запускались (не требуются).

BLOCKED (ENV): живой редактор — проверка кнопки «ОФОРМЛЕНИЕ» в браузере требует роли редактора; полоса ролей в `tests/e2e/specs/accessibility.spec.ts` не выполнима без неё. Не записано как пройденное. Тот же компонент проверяется axe в полосе конструктора шаблона («template builder» в accessibility.spec.ts) и будет перепроверен в 20-43/20-44/20-47. Озвучивание экранным диктором — BLOCKED (DEVICE), как и в STAB-A11Y-03.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Готово для 20-46/20-47 и пересъёмки по D-53..D-58; охрана редактора действует, любая следующая правка components/portia-editor.tsx должна расширить её (новый образец или новая разрешённая замена).
- Clean-checkout (20-13) обязан клонировать с полной историей (не shallow), иначе охрана D-57 упадёт по замыслу.
- STAB-A11Y-01/-03 остаются в статусе Pending в REQUIREMENTS.md: живая проверка редактора и диктор — BLOCKED; закрытие требования отдаёт верификатор фазы.

## Threat Flags

None.

---
*Phase: PORTIA-20-security-accessibility-i-priemka-reliza*
*Completed: 2026-11-07*

## Self-Check: PASSED

- FOUND: components/portia-editor.tsx, lib/format-launch.test.ts
- FOUND: 6bb8cf9, 7696015 (`git merge-base --is-ancestor` ok)
