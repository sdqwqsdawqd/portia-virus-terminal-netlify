---
status: diagnosed
trigger: "Да шрифт до сих пор остался таким как есть (UAT Test 5, PORTIA-01, gap G-PORTIA-01-5; ожидание: шрифт поля = «такой как в области сайта которую я редактирую»)"
created: 2026-10-13T06:30:03Z
updated: 2026-10-13T06:45:00Z
---

## Current Focus

hypothesis: CONFIRMED. Поле редактора (`.formatted-rich-input`) имеет ОДИН жёстко заданный шрифт `var(--serif)` для всех 15 типов полей, а на публичном сайте только запись учёного (`.scientist-rich-text`) набрана serif; остальные 14 типов текста наследуют Golos Text (`--sans`) от `body`, либо задают sans/Segoe UI явно.
test: сопоставление каждого FormattedTextarea с рендерящим его селектором + live computed-style в headless Edge (CDP) на http://localhost:3123
expecting: mismatch по семье у всех пар кроме scientist log
next_action: нет (goal find_root_cause_only) — передать в /gsd-plan-phase --gaps
bug_class: bohrbug
reasoning_checkpoint: null
tdd_checkpoint: null

## Symptoms

expected: «такой как в области сайта которую я редактирую» — поле описания вируса выглядит как описание вируса в архиве, поле рассылки как рассылка, раздела информации как раздел информации, записи учёного как запись учёного и т.д. (WYSIWYG)
actual: «Да шрифт до сих пор остался таким как есть»
errors: нет
reproduction: Test 5 в .planning/phases/PORTIA-01-ispravlenie-bagov/01-UAT.md
started: обнаружено в UAT фазы PORTIA-01 после FIX-03 (план 01-01, коммит 2be1417: Georgia -> IBM Plex Serif / --serif)

## Eliminated

- hypothesis: IBM Plex Serif не загружается / FIX-03 не применён технически
  evidence: orchestrator: document.fonts содержит IBM Plex Serif 400/600/700; computed font-family у .formatted-rich-input, .scientist-rich-text = IBM Plex Serif; Georgia в исходниках нет (grep пуст)
  timestamp: 2026-10-13T06:35:00Z
- hypothesis: при фокусе поле переключается на другое семейство (старый баг с font-family в :focus)
  evidence: коммит 2be1417 убрал font-family из правила фокуса (portia.css:470); остаётся только font-family: var(--sans) в .is-editor-active.preview-dark (portia.css:471), это намеренный, но неверно привязанный override
  timestamp: 2026-10-13T06:37:00Z

## Evidence

- timestamp: 2026-10-13T06:33:00Z
  checked: app/portia.css:55 (body), :96 (.system-bar), :21-24 (токены)
  found: body { font-family: var(--sans) } = Golos Text; --serif объявлен только в :24 и используется ровно в 3 правилах: :467 .formatted-rich-input, :521 .scientist-rich-text, :778 .archive-document-section p
  implication: любой текст сайта без явного font-family наследует Golos Text (sans)
- timestamp: 2026-10-13T06:36:00Z
  checked: git show 2be1417 -- app/portia.css
  found: FIX-03 заменил Georgia на var(--serif) там, где Georgia был (поле, фокус, .scientist-rich-text, .archive-document-section p); display-селекторы, не имевшие Georgia (lead-copy, metric-grid, mutation-copy, info-document-copy, broadcast-card-copy, trash-*, search, assistant), не затронуты
  implication: FIX-03 менял один serif на другой serif; визуально «шрифт остался таким же» (serif -> serif), а расхождение с sans-областями сайта не устранено
- timestamp: 2026-10-13T06:38:00Z
  checked: components/portia-desktop.tsx:1327 и :1275, app/portia.css:778,783
  found: `.archive-document-section p` совпадает только с абзацем «Текущий уровень…» в restricted-документе (portia-desktop.tsx:1275), и его перебивает `.restricted-document > p { font-family: var(--sans) }` (portia.css:783, позже по порядку). Текст записи учёного рендерится как <span class="formatted-content scientist-rich-text"> (FormattedText, portia-desktop.tsx:1330-1380), не <p>
  implication: из трёх правил FIX-03 реально работает как serif на сайте только .scientist-rich-text
- timestamp: 2026-10-13T06:42:00Z
  checked: live headless Edge (CDP) на localhost:3123, getComputedStyle, окно ~500x320 (мобильные размеры шрифта)
  found: body = "Golos Text"; .info-document-copy = Golos Text 16px (15px mobile); .broadcast-card-copy = Golos Text 11px w700 color rgb(0,188,166) (!); .search-recommendations button = Golos Text 11px; Корзина: .trash-formatted-text = Golos Text; .trash-image-document figcaption = Golos Text 14px; .trash-virus-document .lead-copy (тот же компонент VirusRecord, что в архиве) = Golos Text 15px
  implication: подтверждено вживую, что display-области кроме записи учёного — sans. Окно архива в моём прогоне показало «Совпадений нет» (виртуальный список пуст), поэтому досье проверено через VirusRecord в Корзине; .scientist-rich-text взят из замеров orchestrator
- timestamp: 2026-10-13T06:43:00Z
  checked: app/portia.css:375 vs :380 (специфичность), live computed
  found: FormattedText рендерит корневой <span>, т.е. прямой потомок article.broadcast-card; `.broadcast-card > span` (0,1,1) перебивает `.broadcast-card-copy` (0,1,0): тело рассылки на сайте = 700 11px teal, а не 15px/1.7 #a3b6b1 как задумано в :380
  implication: отдельный display-баг, влияющий на WYSIWYG для рассылок: если зеркалить «как есть», поле будет копировать этот 11px bold teal; сначала решить, считать ли это багом
- timestamp: 2026-10-13T06:44:00Z
  checked: app/portia.css:467-472 и components/portia-editor.tsx:417, :1078, :1170, :39
  found: previewSurface (light|dark) — одно глобальное состояние, по умолчанию "light" (editor:417), переключается кнопками БЕЛЫЙ/ЧЁРНЫЙ в плавающей панели (editor:1170) и применяется классом preview-{surface} к активному полю (editor:1078). CSS: light = бумага #f3f1e9 + шрифт базы (serif); dark = тёмный фон + font-family: var(--sans) (portia.css:471). Выбор семейства привязан к ЦВЕТУ фона, а не к полю
  implication: логика поверхностей инвертирована для 4 из 5 светлых областей (досье, PPU, мутации, Корзина-текст — светлая бумага, но sans) и верна для тёмных (info, рассылки, поиск, помощник — тёмные, sans); серифа в предпросмотре на светлом фоне ожидает только запись учёного

## Resolution

root_cause: Поле редактора получает единственный жёстко прошитый шрифт `font: 17px/1.65 var(--serif)` (app/portia.css:467) независимо от того, какая область сайта рендерит этот текст; FIX-03 (D-03) заменил Georgia на IBM Plex Serif только в тех трёх правилах, где Georgia был, поэтому поле осталось serif, а область-источник у 14 из 15 типов полей — Golos Text (`--sans`, унаследован от `body`, portia.css:55) или явный sans/Segoe UI; совпадает только запись учёного (`.scientist-rich-text`, :521). Переключатель БЕЛЫЙ/ЧЁРНЫЙ (portia.css:471, editor:1078) выбирает семейство по цвету фона, а не по области, и потому не исправляет картину.
fix: (не применялся — goal find_root_cause_only)
verification: n/a
oracle_type: n/a
files_changed: []
