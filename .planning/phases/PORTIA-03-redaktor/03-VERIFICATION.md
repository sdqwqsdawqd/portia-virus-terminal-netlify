---
phase: PORTIA-03-redaktor
verified: 2026-10-14T16:42:35Z
status: passed
score: 58/58 must-haves verified
covered_files:
  - ".planning/phases/PORTIA-03-redaktor/03-01-PLAN.md"
  - ".planning/phases/PORTIA-03-redaktor/03-01-SUMMARY.md"
  - ".planning/phases/PORTIA-03-redaktor/03-02-PLAN.md"
  - ".planning/phases/PORTIA-03-redaktor/03-02-SUMMARY.md"
  - ".planning/phases/PORTIA-03-redaktor/03-03-PLAN.md"
  - ".planning/phases/PORTIA-03-redaktor/03-03-SUMMARY.md"
  - ".planning/phases/PORTIA-03-redaktor/03-04-PLAN.md"
  - ".planning/phases/PORTIA-03-redaktor/03-04-SUMMARY.md"
  - ".planning/phases/PORTIA-03-redaktor/03-05-PLAN.md"
  - ".planning/phases/PORTIA-03-redaktor/03-05-SUMMARY.md"
  - ".planning/phases/PORTIA-03-redaktor/03-06-PLAN.md"
  - ".planning/phases/PORTIA-03-redaktor/03-06-SUMMARY.md"
  - ".planning/phases/PORTIA-03-redaktor/03-07-PLAN.md"
  - ".planning/phases/PORTIA-03-redaktor/03-07-SUMMARY.md"
  - ".planning/phases/PORTIA-03-redaktor/03-08-PLAN.md"
  - ".planning/phases/PORTIA-03-redaktor/03-08-SUMMARY.md"
  - "app/portia.css"
  - "components/portia-desktop.tsx"
  - "components/portia-editor.tsx"
  - "lib/accent-boot.ts"
  - "lib/accent-theme.test.ts"
  - "lib/content-sync.test.ts"
  - "lib/content-sync.ts"
  - "lib/editor-changes.test.ts"
  - "lib/editor-changes.ts"
  - "lib/editor-history.test.ts"
  - "lib/editor-history.ts"
  - "lib/editor-items.test.ts"
  - "lib/editor-items.ts"
  - "lib/editor-shortcuts.test.ts"
  - "lib/editor-shortcuts.ts"
covered_digest: "v3:sha256:e54f5da126e7b217f336dfab594a6f328f8e80cab52db6ded1bf8098c4bcc81b"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 30/36
  gaps_closed:
    - "SC1 / 03-03: 375px без горизонтальной прокрутки - UAT тест 1 (pass)"
    - "SC3 / 03-04: перетаскивание за ≡, один шаг отмены - UAT тест 11 (pass) после 03-05"
    - "03-03 / 03-07: панель форматирования на телефоне - UAT тесты 12 -> 14 (pass) после 03-06 и 03-07"
    - "03-02: × с несохранёнными правками (WR-02) - UAT тест 8 (pass)"
    - "Полоса сохранения на телефоне, Ctrl+S / Ctrl+Z, beforeunload - UAT тесты 4, 5, 6 (pass)"
    - "WR-01 выбор в Корзине - UAT тест 7 (pass)"
    - "Пропадающие и дублирующиеся посты (замечания владельца) - 03-08, UAT тесты 16, 17 (pass)"
  gaps_remaining: []
  regressions: []
---

# Фаза 3: Редактор — отчёт о повторной проверке

**Цель фазы:** Редактор удобен на телефоне и ясно показывает, что сохранено
**Проверено:** 2026-10-14T16:42:35Z
**Статус:** passed
**Повторная проверка:** Да — после планов закрытия пробелов 03-05..03-08 и прямых коммитов владельца 2df187d, dd26f5b

## Достижение цели

Цель достигнута. Все 4 критерия ROADMAP и все истины планов 03-01..03-08 подтверждены кодом и тестами, а поведенческие истины, которые тестом не проверить (телефон, перетаскивание, клавиатура, браузерные диалоги), подтверждены UAT владельца (`03-UAT.md`, status complete, 18 тестов; все 5 тестов с issue закрыты планами и перепроверены как pass в тестах 11-18). Шесть истин, которые прошлый отчёт оставил как PRESENT_BEHAVIOR_UNVERIFIED, теперь имеют поведенческое доказательство — UAT владельца.

Свежие прогоны (запускал сам, в корне `site/`):

| Команда | Результат | Exit |
| ------- | --------- | ---- |
| `npm test` | 82 пройдено, 0 упало | 0 |
| `npx tsc --noEmit` | без ошибок | 0 |
| `npm run lint` | 0 ошибок, 13 предупреждений (`no-img-element`, существовали раньше) | 0 |
| `npm run build` | сборка прошла; 1 предупреждение lightningcss про `::highlight(portia-format)` (IN-01, косметика) | 0 |

### Критерии ROADMAP

| # | Критерий | Статус | Доказательства |
| - | -------- | ------ | -------------- |
| SC1 | Запись редактируется на 375px без горизонтальной прокрутки | ✓ VERIFIED | CSS `@media (max-width: 900px)`: `data-mobile-view`, скрытая шапка, 16px поля, список в одну колонку; панель ✎ `max-height: min(38svh, 300px)` (portia.css:1028); UAT тест 1 pass, тест 14 pass |
| SC2 | Несохранённые изменения видны, сохранение подтверждается | ✓ VERIFIED | полоса, `statusText`, точки на вкладках (тесты `editor-changes`, `editor-history`); 03-08: `acceptFetchedContent` (portia-desktop.tsx:332) и `baseRevision` (portia-editor.tsx:583, 762) — сохранённое больше не откатывается поздним опросом; UAT тесты 4, 8, 16 pass |
| SC3 | Порядок записей меняется перетаскиванием | ✓ VERIFIED | `OrderDragHandle` в 4 списках (4 вхождения), слежение на `window` (portia-editor.tsx:217), FLIP `row.animate` 160 мс (176); UAT тест 11 pass |
| SC4 | Досье разбито на вкладки | ✓ VERIFIED | `DossierTabs`, `changedDossierTabs` с тестами; UAT без замечаний |

### Истины планов 03-01..03-04 (32)

Все 32 истины подтверждены. 26 из них уже были ✓ VERIFIED в прошлом отчёте; регрессионная проверка: артефакты 03-01..03-04 проходят `verify.artifacts` (6/6, 4/4, 2/2, 4/4), тесты зелёные. Шесть бывших PRESENT_BEHAVIOR_UNVERIFIED закрыты так:

| Истина (прошлый №) | Сейчас | Доказательство |
| ------------------ | ------ | -------------- |
| R1 / 3.4 — 375px без горизонтальной прокрутки | ✓ VERIFIED | UAT 1 pass; после 03-06 панель стала меньше, UAT 14 pass |
| R3 / 4.5 — удержание ≡ 170 мс, дорожки, автопрокрутка | ✓ VERIFIED | код 03-05; UAT 11 pass (ПК и телефон, вверх и вниз за одно удержание) |
| 4.7 — одно перетаскивание = один шаг ↶ | ✓ VERIFIED | `drag:`-ключ в редьюсере; UAT 11 pass («одно перетаскивание = один шаг ↶») |
| 3.6 — панель ✎ на телефоне | ✓ VERIFIED | истина в 03-03-PLAN переформулирована 03-07 по решению владельца (касание текста не закрывает панель, `inputMode="none"`); код portia-editor.tsx:837, 872, 1478, 1573; UAT 14 pass |
| 2.4 — × с правками, WR-02 | ✓ VERIFIED | исправления WR-02/WR-03 второго ревью (`03-REVIEW-FIX.md`: all_fixed); UAT 8 pass |

### Истины планов закрытия пробелов

| План | Истина | Статус | Доказательства |
| ---- | ------ | ------ | -------------- |
| 03-05 | Вверх и вниз за одно удержание, мышь и палец | ✓ VERIFIED | `window.addEventListener("pointermove", onTrack)` (217), обработчик на кнопке убран; UAT 11 pass |
| 03-05 | WR-03 сохранено: отпускание где угодно, отмена, потеря фокуса завершают; второй палец и правая кнопка не начинают; 170 мс, автопрокрутка, стрелки | ✓ VERIFIED | `pointerup`/`pointercancel`/`blur` на window → `stop()` (210-225), `!event.isPrimary \|\| event.button !== 0` (253), `ArrowUp/Down` (268); UAT 9 (замечание было только о направлении) и 11 |
| 03-05 | Одно перетаскивание = один шаг ↶ | ✓ VERIFIED | `dataset.dragId` на весь жест; UAT 11 pass |
| 03-05 | Любая смена позиции строки анимируется 160 мс во всех 4 списках | ✓ VERIFIED | `useLayoutEffect` в каждой ручке сравнивает `index`/`offsetTop` и вызывает `row.animate` (164-177) — срабатывает при любой смене индекса, не только при перетаскивании; 4 списка используют `OrderDragHandle`; UAT 11 pass |
| 03-05 | С выключенными анимациями строки прыгают без анимации | ✓ VERIFIED | `motion !== "full"` → return (174); после 2df187d `data-motion` всегда задан (`reduce` или `full`), ветка не изменилась; dd26f5b — только CSS, на скриптовый FLIP не влияет |
| 03-06 | Панель ✎ на 375×667: ≤ min(38svh, 300px), на таскбаре, шапка и подвал закреплены, прокручиваются только настройки, без прокрутки страницы | ✓ VERIFIED | portia.css:1028 (`bottom: 44px; max-height: min(38svh, 300px); display: flex; flex-direction: column; overflow: hidden`), 1039 (`overflow-y: auto; overscroll-behavior: contain`); UAT 12 (замечания были не о размере) → 14 pass |
| 03-06 | Все элементы панели на месте | ✓ VERIFIED | изменения 03-06 только в CSS; UAT 12/14 без жалоб на пропавшие настройки |
| 03-06 | Последнее поле прокручивается над панелью, ГОТОВО возвращает полосу | ✓ VERIFIED | `padding-bottom: calc(min(38svh, 300px) + 90px)` (1038); UAT 14 pass |
| 03-06 | «Kotik_play1232» в одну строку во всех размерах | ✓ VERIFIED | `clamp(24px, 8cqi, 44px)`, `overflow-wrap: break-word` (366); UAT 13 pass |
| 03-06 | Шапка профиля складывается при колонке ≤680px | ✓ VERIFIED | `@container (max-width: 680px)` (369); UAT 13 pass |
| 03-07 | Касание/долгое нажатие для выделения не закрывает панель; выделение становится целью | ✓ VERIFIED | слушателя `focusin` в редакторе больше нет (grep: 0); UAT 14 pass |
| 03-07 | Клавиатура скрыта: `inputMode="none"`, один blur при открытии ✎ | ✓ VERIFIED | portia-editor.tsx:837 (`phonePanelOpen`), 1478, 872; UAT 14 pass |
| 03-07 | ГОТОВО/× снимают `inputMode="none"` до возврата курсора | ✓ VERIFIED | `flushSync(onClose)` перед `field.focus` (1573-1578); UAT 14 pass |
| 03-07 | Выше 900px ✎ работает как раньше | ✓ VERIFIED | blur и `phonePanelOpen` под `matchMedia("(max-width: 900px)")` (837, 872) |
| 03-07 | Неактивные поля показывают настоящие цвета на фоне предпросмотра | ✓ VERIFIED | `.formatted-rich-input.preview-light` (portia.css:509); UAT 15 pass |
| 03-07 | Выделенный текст сохраняет свой цвет | ✓ VERIFIED | `.formatted-rich-input::selection { color: currentColor; }` (portia.css:70); UAT 15 pass |
| 03-08 | Сохранённый пост переживает опрос и перезагрузку: старые ответы GET и запросы до сохранения отбрасываются | ✓ VERIFIED | `acceptFetchedContent` (lib/content-sync.ts) с 5 тестами, гейт в `fetchContent` (portia-desktop.tsx:332), `knownRevision.current = savedRevision` (830); UAT 16 pass |
| 03-08 | PUT несёт ревизию черновика; устаревший черновик получает 409 | ✓ VERIFIED | `JSON.stringify({ content: next, revision: baseRevision })` (821); `baseRevision.current = revision` только в эффекте синхронизации чистого черновика (577-585) |
| 03-08 | Правки во время сохранения берут новую ревизию как базу | ✓ VERIFIED | `baseRevision.current = await onSave(...)` (762) до `dispatch saved`; тест «saved keeps edits typed while the request was in flight» |
| 03-08 | Посты и разделы Информации адресуются по id, включая сохранённый `onCommit` панели | ✓ VERIFIED | `updateById(next.broadcasts, broadcast.id, …)` (987-989), `updateById(next.infoSections, section.id, …)` (972-973); тест «editing a post by id after a new post is added at the top…»; UAT 17 pass |
| 03-08 | Удаление снимает `formattedText` в том же шаге и закрывает панель, если она на удалённом | ✓ VERIFIED | `closeFormatterFor` + `removeBroadcast`/`removeInfoSection` в одном `changeDraft` (971, 986); тесты `editor-items` |
| 03-08 | CDN, кэш и PUT-маршрут не тронуты | ✓ VERIFIED | `git log 2d2e8e6..HEAD -- lib/portia-cdn.ts app/api/content/route.ts netlify.toml next.config.ts` пусто |

**Счёт:** 58/58 (4 критерия ROADMAP + 32 истины 03-01..03-04 + 22 истины 03-05..03-08), 0 present-but-behavior-unverified.

### Прямые коммиты владельца

- **2df187d** (анимации по умолчанию включены, «Как в системе» убран): `defaultDesktopSettings.motion = "on"`, эффект и boot-скрипт ставят `data-motion` в `reduce` только при `motion === "off"`; тест `accent-theme.test.ts` обновлён и зелёный. Сохранённое старое значение `"system"` не проходит `settingValues` и падает на значение по умолчанию (portia-desktop.tsx:464-466), то есть «включено». Истины фазы не нарушает.
- **dd26f5b** (мягкий режим «Выключены»): только CSS — глобальное правило `reduce` больше не обнуляет `transition-duration` и не трогает обои, добавлены мягкие анимации Вивиан. Специфичность проверена: правила Вивиан и `.assistant-bubble` стоят позже глобального правила и перекрывают его. Тест-страж в `accent-theme.test.ts` (правила `prefers-reduced-motion` только под `html:not([data-motion])`) зелёный. UAT 18 pass.

### Артефакты и связи

- `verify.artifacts`: все 8 планов проходят (6/6, 4/4, 2/2, 4/4, 1/1, 1/1, 2/2, 6/6).
- `verify.key-links` не смог разобрать описательные поля `from:` (ошибка «Source file not found»), поэтому все шаблоны `pattern:` планов 03-05..03-08 проверены grep вручную: найдены все 13 (строки указаны в таблицах выше).

### Требования

| Требование | Планы | Статус | Доказательства |
| ---------- | ----- | ------ | -------------- |
| EDIT-01 (удобно на телефоне) | 03-03, 03-06, 03-07 | ✓ SATISFIED | SC1, UAT 1, 3→12→14, 15 |
| EDIT-02 (состояние сохранения) | 03-01, 03-02, 03-08 | ✓ SATISFIED | SC2, UAT 4-8, 16, 17 |
| EDIT-03 (дорожки, перетаскивание) | 03-04, 03-05 | ✓ SATISFIED | SC3, UAT 2/9 → 11 |
| EDIT-04 (вкладки досье) | 03-04 | ✓ SATISFIED | SC4 |
| LOOK-02 (03-06, правка ника) | 03-06 | ✓ SATISFIED (требование Фазы 2, здесь только исправление вёрстки ника) | UAT 13 |

Осиротевших требований Фазы 3 нет.

### Запреты

В 03-05..03-08 блоков `prohibitions` нет. 11 запретов 03-01..03-04 (уровень judgment, `status: resolved`) соблюдены; единственное прошлое нарушение — «не терять правки при закрытии без явного выбора» (WR-02) — исправлено во втором раунде ревью и подтверждено владельцем в UAT 8.

### Анти-паттерны

Маркеров `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` в изменённых файлах фазы нет. Заглушек нет.

| Файл | Что | Вес |
| ---- | --- | --- |
| app/portia.css:435 | `::highlight(portia-format)` не распознаётся lightningcss (IN-01) | ℹ️ Info, косметика |
| components/*.tsx | 13 предупреждений lint `no-img-element`, были до фазы | ℹ️ Info |

### Замечания (не блокируют)

- ℹ️ Код планов 03-05..03-08 и коммитов 2df187d, dd26f5b не проходил `/gsd-code-review` (последний `03-REVIEW.md` охватывает только исправления до 6d82cc2). Покрытие: тесты, UAT 11-18 и эта проверка.
- ℹ️ После 2df187d системная настройка «уменьшить движение» игнорируется, пока посетитель сам не выключит анимации. Это решение владельца; мягкий режим dd26f5b смягчает последствия, но посетитель с вестибулярной чувствительностью при первом визите увидит полные анимации.
- ℹ️ В ROADMAP.md у Фазы 3 указано «4/4 plans executed» и перечислены только 03-01..03-04 — устарело, планов 8.

### Требуется проверка человеком

Нет: все бывшие пункты human_needed закрыты UAT владельца.

### Пробелы

Нет.

---

_Проверено: 2026-10-14T16:42:35Z_
_Проверяющий: Claude (gsd-verifier)_
