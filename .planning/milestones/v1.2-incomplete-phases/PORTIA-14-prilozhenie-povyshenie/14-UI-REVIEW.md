# Phase 14 — UI Review

**Проверено:** 2026-10-28  
**Базовая спецификация:** `14-UI-SPEC.md` (approved)  
**Браузерные доказательства:** предоставлен live-прогон `http://localhost:3000` при `395×734`; новые снимки не создавались  
**Охват:** публичное приложение участника, trusted-вкладка проверяющего, банки, квалификационный runner, desktop-интеграция и релевантные UI-тесты

---

## Pillar Scores

| Pillar | Score | Ключевой вывод |
|--------|-------|----------------|
| 1. Copywriting | 3/4 | Основные CTA и ошибка отсутствующего ника точны, но текст о привязке противоречит UI-SPEC/D-02, а реальный empty state очереди отсутствует. |
| 2. Visuals | 2/4 | Участнический экран и ярлык визуально цельны, но в error-state остаётся осиротевшая бирюзовая линия, а phone-workspace проверяющего не становится последовательным. |
| 3. Color | 3/4 | Семантические warning/danger состояния различимы, однако teal используется в 22 правилах scoped-блока и есть нетематизируемый фиолетовый акцент квалификации. |
| 4. Typography | 2/4 | Участническая иерархия близка к контракту, но scoped CSS содержит 7 объявлений `9px` и 14 объявлений `10px`, включая интерактивные подписи. |
| 5. Spacing | 2/4 | На телефоне нет горизонтального переполнения и основные padding совпадают, но реализация широко отходит от заявленной 4px-шкалы. |
| 6. Experience Design | 2/4 | Основные состояния и fail-closed runner покрыты, но мобильная навигация проверяющего, доступные tabs и модальные подтверждения не выполняют контракт. |

**Overall: 14/24**

---

## Top 3 Priority Fixes

1. **Сделать reviewer UI на телефоне настоящим последовательным flow** — сейчас media rule лишь складывает queue/detail/preview друг под другом, оставляя длинную совмещённую страницу без требуемой кнопки «Назад». Добавить состояние текущего phone-view (`queue → detail`, `bank-list → editor → preview`), компактный back control и скрывать неактивные панели.
2. **Унифицировать необратимые действия через доступный ConfirmDialog** — экспортируемый workspace смешивает самодельный `aria-modal` без focus trap/Escape/return-focus и `window.confirm`. Перевести issue/delete/finalize/reset/release-retake на один диалог с начальным фокусом, циклом Tab, Escape и возвратом фокуса.
3. **Исправить error-state nickname gate** — сохранить читаемый текст о привязке и убрать осиротевшую бирюзовую вертикаль; одновременно заменить текст на точный контракт «Первая заявка закрепит этот ник за устройством…».

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

- **WARNING — неверная формулировка момента привязки.** В `components/portia-promotion.tsx:175` написано «Первая успешная проверка закрепит этот ник…», хотя UI-SPEC и D-02 говорят, что привязка происходит при первой подтверждённой заявке, а простой поиск ника не связывает устройство. Это не стилистическая разница, а неверное ожидание пользователя. Заменить на контрактный текст: «Первая заявка закрепит этот ник за устройством. Сменить его сможет проверяющий.»
- **WARNING — empty-state существует только в legacy-разметке.** Фактически экспортируется `PromotionEditorMain` (`components/portia-promotion-editor.tsx:79`), а в его очереди (`components/portia-promotion-editor-main.tsx:63`) нет «НОВЫХ ЗАПРОСОВ НЕТ» и пояснения об автообновлении. Эти строки есть в legacy-компоненте (`components/portia-promotion-editor.tsx:210`), который не является рабочим экспортом. Добавить точный empty-state в `PromotionEditorMain`.
- **PASS — ключевые участнические строки совпадают.** Заголовок и CTA находятся в `components/portia-promotion.tsx:171-177`; live-прогон подтвердил точную ошибку отсутствующего ника: «Ник не найден в списке PORTIA. Проверьте написание или обратитесь к руководителю.»
- **PASS — обычный и квалификационный процессы названы разными существительными и CTA.** Разделение реализовано в `components/portia-promotion.tsx:217-223`, а история ограничена тремя результатами в `components/portia-promotion.tsx:342`.

### Pillar 2: Visuals (2/4)

- **WARNING — наблюдаемый дефект error-state на телефоне.** При `395×734` после запроса `UI_AUDIT_NONEXISTENT_92841` helper о привязке визуально исчезает, но между input и error-card остаётся короткая бирюзовая вертикальная линия. Источник декоративной линии — `border-left` у `.promotion-binding-note` (`app/portia.css:1763`). Проверить computed layout/paint этого блока в состоянии ошибки и гарантировать, что border отображается только вместе с видимым текстом.
- **WARNING — phone reviewer layout не соответствует последовательным видам.** UI-SPEC требует queue/detail/preview как отдельные экраны с back control. Реализация при `max-width: 900px` только задаёт `display: block` (`app/portia.css:1928-1931`); разметка `components/portia-promotion-editor-main.tsx:63` одновременно держит list и detail, а bank-компоненты одновременно держат list/editor/preview (`components/portia-promotion-ordinary-editor.tsx:59-67`, `components/portia-promotion-qualification-editor.tsx:74-82`).
- **PASS — участническая визуальная иерархия ясна.** Live-прогон подтвердил один доминирующий CTA, читаемый заголовок, label, explanation и отсутствие горизонтального overflow. Карточки обычного потока и квалификации имеют разные символы и заголовки (`components/portia-promotion.tsx:217-223`).
- **PASS — desktop-интеграция цельна.** Ярлык, окно и title используют «Повышение» (`components/portia-desktop.tsx:132`, `components/portia-desktop.tsx:1460-1462`), а иконка построена на общей 24px/1.75 сетке (`components/portia-icons.tsx:126-131`, `components/portia-icons.tsx:249`). Live-прогон подтвердил coherent icon grid и видимого паука.
- **needs_human_review: true — brand feel.** Автоматические доказательства подтверждают интеграцию с PORTIA OS, но субъективную «процедурную и спокойную» тональность всех reviewer-состояний следует оценить человеком на заполненных очередях/банках.

### Pillar 3: Color (3/4)

- **WARNING — акцент визуально распределён шире заявленных 10%.** В promotion-секции CSS найдено 22 использования `var(--teal)`, 6 — `var(--teal-soft)` и 3 — `var(--teal-dim)`. Акцент применяется не только к CTA/selection/focus/timer, но и к eyebrow, task indices, history counters, queue status, detail headings и grading labels (`app/portia.css:1768`, `1788`, `1818`, `1863`, `1867`, `1877`). Снизить второстепенные подписи и индексы до нейтральных text tokens, оставив teal текущему выбору и действию.
- **WARNING — отдельный фиолетовый цвет квалификации не связан с темой.** `.promotion-qualification-card .promotion-flow-icon` использует `oklch(.76 .07 285)` (`app/portia.css:1781`). При custom accent этот цвет не проходит существующую токенизацию/контрастные гарантии. Ввести семантический token либо различать поток формой и существительным без нового hue.
- **PASS — warning/danger не наследуют custom accent и сопровождаются текстом.** Timer использует `--warning`/`--danger` (`app/portia.css:1797-1798`), terminal/error states имеют текстовые метки (`components/portia-promotion.tsx:138-142`), grading controls сочетают цвет и «ВЕРНО/НЕВЕРНО» (`app/portia.css:1891-1892`).

### Pillar 4: Typography (2/4)

- **WARNING — контракт минимального размера системно нарушен.** В scoped promotion CSS найдено 7 объявлений `9px` и 14 объявлений `10px`. Среди них интерактивные/значимые labels: timer и progress (`app/portia.css:1795`, `1799`), answer legend (`1803`), device reset label/button (`1854-1856`), request status (`1863`), grading controls (`1890`), final-decision label (`1897`) и bank labels (`1905`, `1909`). UI-SPEC запрещает body ниже 12px и interactive label ниже 11px. Поднять интерактивные подписи минимум до 11px, вторичный body — до 12px.
- **WARNING — long question style отклонён от контракта.** Вопрос рендерится `17px/1.55` с weight 600 (`app/portia.css:1801`) вместо `15px/1.65`, weight 400. Это увеличивает плотность и нарушает единую типографическую роль long copy. Вернуть специфицированный размер/вес/line-height, сохранив heading hierarchy через surrounding labels.
- **PASS — основные роли участника соблюдены.** Gate heading использует `clamp(27px, 4vw, 42px)/1.08` (`app/portia.css:1757`), card heading — `18px/1.25` (`1782`), task copy — `15px/1.65 var(--doc)` (`1789`), timer — `24px` tabular mono (`1796`).

### Pillar 5: Spacing (2/4)

- **WARNING — заявленная 4px-шкала не является фактической шкалой.** В promotion CSS регулярно встречаются `5`, `6`, `7`, `9`, `10`, `11`, `13`, `14`, `18` и `22px`: gate gap/padding (`app/portia.css:1755`, `1759`, `1761`), cards (`1779`, `1783`, `1800`), timer (`1794`), reviewer detail (`1864`, `1868`) и bank editor (`1903`, `1905`, `1908`, `1914`). Исключения UI-SPEC разрешают только существующие corner radii и 28px window controls, а не layout spacing.
- **WARNING — touch targets ниже контракта в reviewer UI.** Device reset input/button имеют `38px` (`app/portia.css:1855-1856`), bank settings inputs — `38px` (`1910`), тогда как контракт требует минимум 40px и 44px для phone primary controls. Привести к 40/44px и проверить плотные bank controls на телефоне.
- **PASS — participant phone padding и основные карточки совпадают.** На `max-width: 520px` используются 16px боковые padding, 16px card padding и 44px action (`app/portia.css:1828`, `1832`, `1834`). Live-прогон подтвердил отсутствие horizontal overflow при `395×734`.

### Pillar 6: Experience Design (2/4)

- **WARNING — подтверждения не соответствуют interaction contract.** `PromotionConfirmDialog` объявляет `aria-modal`, но не реализует focus trap, initial focus, Escape и возврат фокуса (`components/portia-promotion-editor-main.tsx:38-40`). Банки дополнительно используют `window.confirm` для delete/immutable issue (`components/portia-promotion-ordinary-editor.tsx:42-53`, `components/portia-promotion-qualification-editor.tsx:61-68`) вместо единого `ConfirmDialog`.
- **WARNING — tabs фактически недоступны как tabs.** В экспортируемом `PromotionEditorMain` nav/filter buttons не имеют `aria-pressed`, role/tab semantics или `aria-label` (`components/portia-promotion-editor-main.tsx:63`). В legacy-компоненте эти атрибуты частично есть (`components/portia-promotion-editor.tsx:203-207`), из-за чего source-based тесты создают ложное чувство покрытия.
- **WARNING — UI-тест проверяет не всю рабочую реализацию.** `lib/portia-promotion-editor.test.ts` ищет queue/copy/claim в `portia-promotion-editor.tsx`, хотя тот экспортирует `PromotionEditorMain`, а большая часть актуальной разметки находится в трёх других файлах. Тест «phone sequential view» проверяет только наличие media selector, но не переключение видов или back control. Перенаправить contract assertions и DOM-тесты на фактический экспорт.
- **WARNING — empty queue и phone back flow отсутствуют в фактическом component tree.** Это ухудшает ориентацию и прямо расходится с Information Architecture/Phone contract; исправление должно быть покрыто UI/DOM тестом, а не только regex по CSS.
- **PASS — участнические состояния и защита runner проработаны.** Есть disabled submit, loading, not-found, stale-safe polling, cooldown, immutable tasks, max-three history и terminal replacement (`components/portia-promotion.tsx:77-159`, `242-342`). Тесты для participant/reviewer/qualification прошли: `525/525` в выполненном релевантном прогоне.
- **PASS — reduced motion и server-derived timer присутствуют.** Timer вычисляется из deadline (`components/portia-promotion.tsx:44-48`, `87-101`), motion gated через `html[data-motion]` (`app/portia.css:1823`, `1842-1844`).

---

## Actionable Findings

| Severity | Finding | Действие |
|----------|---------|----------|
| WARNING | Error-state оставляет бирюзовую вертикальную линию без helper-текста | Исправить layout/paint `.promotion-binding-note`, добавить screenshot/DOM regression для not-found при `395×734`. |
| WARNING | Текст привязки обещает привязку после проверки, а не после заявки | Заменить строку на точный UI-SPEC copy и обновить тест. |
| WARNING | Reviewer phone layout не sequential | Добавить отдельные view states, back control и скрытие неактивных панелей. |
| WARNING | Empty queue отсутствует в экспортируемом main | Добавить обе контрактные строки в `PromotionEditorMain`. |
| WARNING | ConfirmDialog не управляет фокусом; банки используют `window.confirm` | Ввести единый доступный dialog primitive для всех необратимых действий. |
| WARNING | Reviewer tabs/filter buttons не имеют заявленной семантики | Добавить accessible tabs/button-tab pattern с `aria-pressed`, именованием и keyboard behavior. |
| WARNING | 21 scoped typography declaration ниже допустимого минимума | Поднять labels до 11px, body до 12px; закрепить проверкой CSS tokens. |
| WARNING | Reviewer controls имеют 38px hit targets | Поднять минимум до 40px, phone primary — до 44px. |
| WARNING | Layout использует множество значений вне 4px-шкалы | Свести spacing к `4/8/16/24/32/48`, оставив разрешённые radius/window-control exceptions. |
| WARNING | Accent распределён по множеству вторичных labels | Перевести декоративные/метаданные labels на neutral text tokens. |
| WARNING | Qualification icon hue hardcoded | Заменить семантическим theme token либо оставить различие только формой/текстом. |
| WARNING | Тесты проверяют legacy вместо actual export | Проверять `portia-promotion-editor-main.tsx` и split editors; добавить реальные DOM assertions для mobile navigation/dialog focus. |

**BLOCKER findings:** 0  
**WARNING findings:** 12

---

## Registry Safety

Registry audit не требовался: `components.json` отсутствует, UI-SPEC фиксирует `shadcn_initialized: false` и не использует сторонние registries/blocks.

---

## Files Audited

- `.planning/phases/PORTIA-14-prilozhenie-povyshenie/14-CONTEXT.md`
- `.planning/phases/PORTIA-14-prilozhenie-povyshenie/14-UI-SPEC.md`
- `.planning/phases/PORTIA-14-prilozhenie-povyshenie/14-01-PLAN.md` … `14-10-PLAN.md`
- `.planning/phases/PORTIA-14-prilozhenie-povyshenie/14-01-SUMMARY.md` … `14-09-SUMMARY.md`
- `components/portia-promotion.tsx`
- `components/portia-promotion-editor.tsx`
- `components/portia-promotion-editor-main.tsx`
- `components/portia-promotion-ordinary-editor.tsx`
- `components/portia-promotion-qualification-editor.tsx`
- `components/portia-desktop.tsx`
- `components/portia-icons.tsx`
- `app/portia.css`
- `lib/portia-promotion-ui.test.ts`
- `lib/portia-qualification-ui.test.ts`
- `lib/portia-promotion-editor.test.ts`
- `lib/portia-desktop.test.ts`

---

## Verification Notes

- Live evidence at `395×734`: correct shortcut/window title, no initial horizontal overflow, correct initial content and exact not-found message; observed orphan turquoise rule in error-state.
- Relevant automated run: `525/525` tests passed. Passing source-contract tests do not invalidate the findings above because several assertions target legacy source or only check selector/string presence rather than rendered behavior.
- Новый screenshot capture не выполнялся: пользователь предоставил достаточное automated browser evidence, а аудит ограничен созданием только этого review-файла.

