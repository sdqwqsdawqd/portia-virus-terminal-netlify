---
phase: 17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora
plan: 07
subsystem: ui
tags: [decomposition, pure-move, seam-modules, stab-desk-07, sandbox, sec-03, playwright-blocked]

requires:
  - phase: 17-03
    provides: components/portia-desktop-dossier.tsx (FormattedText, LoadingState)
  - phase: 17-06
    provides: components/portia-desktop-window.tsx и portia-desktop-shortcuts.tsx
provides:
  - "components/portia-desktop-documents.tsx: EmbeddedDocument, GuideApp, YoutubeFigure (внутри embedSandbox, zoomSteps, zoomModifier, guideCollapsedStorageKey, GuideBlockView, GuidePhoto)"
affects: [PORTIA-17.1, PORTIA-18, PORTIA-20]

tech-stack:
  added: []
  patterns: ["pure move проверяется scripts/phase17-move-parity.mjs; source-тесты читают всё семейство portia-desktop*"]

key-files:
  created:
    - components/portia-desktop-documents.tsx
  modified:
    - components/portia-desktop.tsx

key-decisions:
  - "embeddedApps (адреса таблицы и устава) остался в portia-desktop.tsx: он выбирает документ для окна, а не рендерит его."
  - "embedSandbox экспортировался только между Task 1 и Task 2 (его использовал YoutubeFigure в desktop); после Task 2 снова модульно-приватный."

patterns-established:
  - "Единый sandbox iframe (D-19/SEC-03) живёт в одном файле рядом с обоими iframe (EmbeddedDocument и YoutubeFigure)."

requirements-completed: []
requirements-note: "STAB-DESK-01/07 отмечает оркестратор в конце фазы."

status: complete
commits: 2
plan_head_before: 3565f0e25e170bd2cc6919a4b35b9273dc3d8b5b
plan_head_after: 440d4113a1e5b379e529766b540c757d344b9df9
actuals:
  tokens: 7300
  tasks: 2
  commits: 2

duration: ~20min
completed: 2026-11-01
---

# Phase 17 Plan 07: окна-документы и «Справочник» в seam-модуль Summary

**Встроенные документы с масштабом, единый sandbox iframe и «Справочник» перенесены байт-в-байт в components/portia-desktop-documents.tsx (196 строк); portia-desktop.tsx уменьшился до 1567 строк.**

## Что сделано

| Task | Имя | Коммит | Файлы |
|------|-----|--------|-------|
| 1 (tracer) | EmbeddedDocument, zoomSteps, zoomModifier, embedSandbox (D-19) | `b9a9728` | portia-desktop-documents.tsx, portia-desktop.tsx |
| 2 | GuideApp, GuideBlockView, GuidePhoto, YoutubeFigure, guideCollapsedStorageKey | `440d411` | portia-desktop-documents.tsx, portia-desktop.tsx |

- Task 1: `phase17-move-parity` — "pure move: 61 lines"; tracer-гейт (npm test, tsc, lint) пройден до расширения на Task 2.
- Task 2: `phase17-move-parity` — "pure move: 113 lines" (накопительно от `b9a9728`); exports в модуле: ровно `EmbeddedDocument`, `GuideApp`, `YoutubeFigure`.
- Изменения в `portia-desktop.tsx` кроме удаления: три строки import (documents) и подчистка ставших неиспользуемыми импортов (`useLayoutEffect`, `GuideBlock`, `GuideSection`); места вызова не тронуты.

## Результаты проверок

| Шаг | Исход |
|-----|-------|
| `node scripts/phase17-move-parity.mjs --from components/portia-desktop.tsx --to components/portia-desktop-documents.tsx` | exit 0, "pure move" |
| `npm test` (Node 22.13.1) | tests 680, pass 679, fail 0, skipped 1 (1 пропуск был и в эталоне) |
| `npm exec tsc -- --noEmit` | чисто |
| `npm run lint` | 0 errors, 18 warnings (как в эталоне) |
| `npm run build` | exit 0 |
| `node --experimental-strip-types --test lib/phase15-visual-manifest.test.ts` | tests 37, pass 37 |
| `node scripts/phase15-visual-manifest.mjs --verify-promotion` | "Verified 33 exact owner-approved snapshot bytes; 18 non-approved rows excluded." |
| SEC-03 / ZOOM-01 / ZOOM-02 / «guide sections start folded» | проходят в составе `npm test` по семейству |
| acceptance greps | `export function` в documents = 3; в desktop остаточных объявлений = 0; ключ `portia-guide-collapsed-v2` = 1 |
| `git diff --name-only 55f51d6..HEAD -- portia-wallpaper*.tsx app/portia.css package*.json` | пусто |
| `git status --porcelain -- tests/e2e/visual/__screenshots__` | пусто |

### BLOCKED (не pass)

| Шаг | Статус | Причина |
|-----|--------|---------|
| `npm exec playwright -- test --list` | BLOCKED (ENV) | `[PORTIA_E2E_PREFLIGHT:missing-environment] Check: NEXT_PUBLIC_SUPABASE_ANON_KEY.` — в окружении процесса нет `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY`; `.env.local` по правилам проекта не читается, окружение не менялось |
| `tests/e2e/specs/window-reopen.spec.ts --project=chromium-desktop` | BLOCKED (ENV) | тот же preflight; в 17-05-SUMMARY он тоже записан как BLOCKED (ENV), не pass |
| `tests/e2e/visual --update-snapshots=none` (application-guide, application-charter, application-table и остальные) | BLOCKED (ENV) | тот же preflight; ни один тест не запускался; исход идентичен эталону 17-PARITY-BASELINE.md (BLOCKED = BLOCKED) |

Пиксельная parity-проверка в Phase 17 недоступна без preflight-окружения от владельца. Доказательство переносов: `phase17-move-parity` (построчно), source-тесты по семейству, tsc, lint, build, `--verify-promotion` (байты утверждённых снимков). Снимки application-charter/-table/-guide сравнить с эталоном нельзя: BLOCKED.

## Итог фазы 17

### Размеры главных файлов (строки)

| Файл | До фазы (HEAD `55f51d6`) | Сейчас (HEAD `440d411`) | Разница |
|------|------|------|------|
| components/portia-desktop.tsx | 2317 | 1567 | -750 |
| components/portia-editor.tsx | 3033 | 2052 | -981 |

### Seam-модули и откат

Откат любого seam: `git revert` его коммитов в обратном порядке (от новых к старым). Столбец «от каких seam зависит» говорит, что нужно откатывать раньше (зависимые первыми).

| Модуль | Что внутри | План | Коммиты для отката | От каких seam зависит |
|--------|-----------|------|--------------------|-----------------------|
| components/portia-editor-dossier.tsx (373 стр.) | ClassificationField, поле картинки, перетаскивание, вкладки, диалог, форма досье (восемь частей редактора досье) | 17-02 | `52ece89`, `ef6912d` (+ `c2f9040` makeId в lib/editor-items.ts из 17-01) | нет |
| components/portia-desktop-dossier.tsx (201 стр.) | FormattedText, VirusRecord, DossierSection, MediaBlock, LoadingState, prioritizeImage, ScientistDocument | 17-03 | `17fe02c`, `47085c5` | нет |
| components/portia-editor-rich-text.tsx (626 стр.) | ActiveFormatContext, FormattedTextarea, FloatingTextFormatPanel, палитры, replaceRichText, findFormatField | 17-04 | `abf03d6`, `e8c2f2a` | нет |
| lib/window-open.ts (41 стр.) | чистые openedWindow, exitedWindow, originOf, типы WindowState/OpenOrigin | 17-05 | `df2f1df`, `0913e37` (+ тесты `fe3ade8`, `337208f`, e2e `76a5d7a`) | нет |
| components/portia-desktop-window.tsx (178 стр.) | type AppId, appMeta, minimumWindowSize, AppWindow | 17-06 | `d647dcb` | lib/window-open |
| components/portia-desktop-shortcuts.tsx (182 стр.) | DesktopIcon, StartPanelButton, DesktopShortcutId, ShortcutPosition | 17-06 | `cb2792e` | portia-desktop-window, lib/window-open |
| components/portia-desktop-documents.tsx (196 стр.) | EmbeddedDocument (масштаб), embedSandbox, GuideApp, GuideBlockView, GuidePhoto, YoutubeFigure | 17-07 | `b9a9728`, `440d411` | portia-desktop-dossier (FormattedText, LoadingState) |

Основа (17-01, не seam): scripts/phase17-move-parity.mjs, 17-PARITY-BASELINE.md, source-тесты по семействам (`c2f9040`, `70cbcd5`).

### Готово для Phase 17.1

- Досье-редактор (`portia-editor-dossier`), форматирование текста (`portia-editor-rich-text`) и просмотр досье (`portia-desktop-dossier`) вынесены как самостоятельные модули без зависимостей от других seam; Phase 17.1 может строить на них.
- Источник окон: единый контракт открытия (`lib/window-open`) и вынесенные рамка/ярлыки.
- Остались в `portia-desktop.tsx` (1567 строк): тело `PortiaDesktop` (состояние, поиск, трансляции, настройки, окна приложений), BootScreen, RowBadges, QuestToast, PromotionRetakeToast, SettingGroup. Это следующие кандидаты, если понадобится ещё нарезка.

### Журнал багов (17-FOUND-BUGS.md)

| план | где | что видит пользователь | целевая фаза |
|------|-----|------------------------|--------------|
| 17-05 | Настройки: `accentPickerOpen` и `accentDraft` живут в `PortiaDesktop` и не сбрасываются при закрытии окна | Закрыть «Настройки» при открытом выборе своего цвета, затем открыть снова: выбор цвета снова открыт (наблюдение по коду, в браузере не воспроизводилось: BLOCKED ENV) | Phase 18/20 (сбросить при закрытии или держать внутри тела окна) |

В этом плане новых багов не найдено.

## Deviations from Plan

None - plan executed exactly as written. Единственное уточнение: после переноса Guide-блока понадобилось добавить в documents импорты `useLayoutEffect`, `findGuide`, `portiaTextKey`, `PortiaIllustration` и удалить ставшие неиспользуемыми из desktop (`useLayoutEffect`, `GuideBlock`, `GuideSection`); это механика импортов, а не изменение поведения (plan разрешал импорты "по tsc").

## Known Stubs

None.

## Threat Flags

None. Новых сетевых поверхностей нет; T-17-13 закрыт переносом байт-в-байт и тестом SEC-03 (ровно два iframe, оба с `sandbox={embedSandbox}`), T-17-14 - тестом ZOOM-01 (парные add/removeEventListener). package.json и package-lock.json не менялись.

## Self-Check: PASSED

- FOUND: components/portia-desktop-documents.tsx
- FOUND commit b9a9728, FOUND commit 440d411 (ancestors of HEAD)
