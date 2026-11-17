# Phase 18: Рабочий стол, окна и живые анимации - Context

**Gathered:** 2026-11-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Рабочий стол одинаково надёжен на PC и phone, а живая motion-система (ярлыки, паук, паутина, обои, Вивьян, boot, окна) следует утверждённому контракту без потери художественной основы и производительности. Требования: STAB-DESK-02..06, STAB-MOTION-01..08, STAB-MEDIA-06. Новых приложений и новой оконной архитектуры фаза не добавляет.

</domain>

<decisions>
## Implementation Decisions

### Ярлыки и их анимация (STAB-MOTION-05, STAB-DESK-06)
- **D-01:** Artwork ярлыков **не перерисовывается**. Меняется только анимация: она приводится к единой системе (общие правила длительности, easing, конечного кадра). — **Reversibility:** costly — перерисовка позже потребует новых approved snapshots.
- **D-02:** При наведении проигрывается **один полный цикл**. Цикл доигрывается до конца, даже если курсор ушёл раньше, и заканчивается на статичном кадре, визуально и геометрически совпадающем с покоем.
- **D-03:** Двигается **только рисунок внутри иконки**. Контейнер ярлыка и подпись неподвижны, соседи не сдвигаются.
- **D-04:** На телефоне (без hover) касание запускает **один цикл**, а приложение открывается сразу, не дожидаясь конца анимации. Клавиатурный focus ведёт себя как hover.
- **D-05:** 9 отклонённых в Phase 15 motion-кадров (shortcut ×5, spider ×3, web-wave) заменяются новыми кандидатами по D-01..D-04 и D-06..D-09, затем идут на owner review (STAB-MOTION-08).

### Паук и паутина (STAB-MOTION-03/04, STAB-DESK-05)
- **D-06:** Скорость паука **как сейчас**, но движение **плавное**: без рывков, телепортаций и резких поворотов. Поворот интерполируется, переход между соседними секторами непрерывный.
- **D-07:** Тело паука **плотное и приглушённое**: непрозрачное и читаемое на любом accent (включая «Свой»), но тёмное, не спорит с окнами. Закрывает todo `spider-body-visible-and-toggle.md`, часть «тело прозрачное».
- **D-08:** След на паутине: **короткая волна от постановки каждой лапы**, с обеих сторон тела, в такт шагам, быстро затухает. Сейчас след односторонний и не синхронизирован с ходьбой, это исправляется.
- **D-09:** При выключенном пауке паутина **остаётся на том же месте и живая**: лёгкое покачивание нитей сохраняется, если анимации включены. Сейчас при выключении фон смещается, это исправляется. Переключатель паука уже есть (`spiderModes` в `lib/accent-boot.ts`), его не нужно создавать заново.

### Анимации и заставка (STAB-MOTION-01/02/06/07)
- **D-10:** Главный **только переключатель «Анимации» на сайте**. Системную настройку `prefers-reduced-motion` не учитываем: ни как значение по умолчанию, ни как ограничение. — **Reversibility:** costly — затрагивает accessibility. Phase 20 (a11y) должна явно пересмотреть это решение. Существующие `@media (prefers-reduced-motion: reduce)` в `app/portia.css` (строки ~1382 и ~1861) приводятся к этому решению.
- **D-11:** Режимов **три: вкл / уменьшено / выкл**. В режиме «уменьшено» нет зацикленного движения (паук сидит, обои и паутина неподвижны), но короткие отклики окон и ярлыков остаются. Сейчас `motionModes = ["on", "off"]`: добавление `"reduced"` должно сохранить совместимость со старыми сохранёнными значениями. Повреждённое значение возвращает к default только эту настройку (STAB-DESK-05).
- **D-12:** В режиме «выкл» **всё статично**: заставки нет, Вивьян меняет выражение мгновенно без плавных переходов, обои и паук неподвижны.
- **D-13:** Заставка показывается **один раз за вкладку** (session). Reload её не повторяет, новая вкладка показывает (STAB-MOTION-02).

### Окна, телефон и скорость (STAB-DESK-02/03/04, STAB-MEDIA-06)
- **D-14:** «Кивок» уже открытого окна, выведенного вперёд повторным открытием (17-CONTEXT D-05): **лёгкое покачивание** на пару пикселей, коротко. В режимах «уменьшено» и «выкл» заменяется статичной сменой фокуса.
- **D-15:** Карточки-формы в редакторе («Информация», «Справочник», «Сводка») получают **фиксированную ширину и раскладываются в колонки**, как плитки «Сводки» из quick 261102-07k. Ряды «Рекомендаций» и «Доступа» остаются в одну колонку: этого требует drag-сортировка.
- **D-16:** На телефоне окна **всегда на весь экран** над панелью задач, без перетаскивания и изменения размера. Переключение между окнами идёт через панель задач.
- **D-17:** Замеры скорости (STAB-MEDIA-06): Claude готовит **короткую инструкцию** для владельца (Chrome Performance на PC: открыть окно, тащить окно, сменить обои; аналог для phone). Владелец снимает trace **до** изменений и **после**. Budget: нет заметных подвисаний (кадры < 50 мс на типовых действиях) и не хуже до-замера. Без owner traces STAB-MEDIA-06 остаётся BLOCKED, а не pass.

### Claude's Discretion
- Конкретные длительности, easing и количество кадров в цикле ярлыков в пределах D-01..D-04. Утверждаются через STAB-MOTION-08 до реализации.
- Способ интерполяции траектории паука и затухания волн в пределах D-06..D-09.
- Порядок планов и границы increments.

### Folded Todos
- `.planning/todos/pending/spider-body-visible-and-toggle.md`: видимое тело паука (D-07) и паутина на месте при выключенном пауке (D-09). Переключатель уже существует.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Требования и границы
- `.planning/ROADMAP.md` § Phase 18: цель, 7 Success Criteria, acceptance gate (DPR 1/1.25, motion quality, long-session performance)
- `.planning/REQUIREMENTS.md`: STAB-DESK-02..06, STAB-MOTION-01..08, STAB-MEDIA-06
- `.planning/PROJECT.md`: художественная основа PORTIA OS не меняется

### Визуальный контракт Phase 15
- `.planning/phases/PORTIA-15-baseline/evidence/15-VISUAL-APPROVAL.md`: 33 APPROVED и 18 REJECTED (9 motion: shortcut ×5, spider ×3, web-wave; 9 window-search и desktop-clean-rest), подписан
- `.planning/phases/PORTIA-15-baseline/evidence/15-FRAME-TEST-MAP.md`: подписанная карта кадров. 6 строк BLOCKED с recoveryPhase 18
- `.planning/phases/PORTIA-15-baseline/evidence/15-GAP-RECONCILIATION.md`: что из G3/G4 закреплено за Phase 18
- Подписанные PNG и evidence не изменять. Не запускать `scripts/phase15-visual-manifest.mjs --verify`, допустим только `--verify-promotion`

### Прошлые решения
- `.planning/phases/PORTIA-17-obratimaya-dekompozitsiya-rabochego-stola-i-redaktora/17-CONTEXT.md`: D-05 (кивок окна), D-09 и Deferred «Phase 18 — паук, фон, окна» (замечания владельца 2026-11-01)
- `.planning/quick/261102-07k-fix-window-resize-and-editor-scroll-layo/261102-07k-SUMMARY.md`: плитки окон держат размер, редактор листается целиком. Утверждено владельцем

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/accent-boot.ts`: `desktopSettingsStorageKey` (`portia-desktop-settings-v1`), `motionModes`, `spiderModes`, `bootSeenStorageKey` (`portia-boot-seen-v1`). Здесь расширяется режим «уменьшено» и живёт логика «один раз за вкладку».
- `lib/window-geometry.ts` (+ test): границы, inset, resize окон (STAB-DESK-02).
- `components/portia-desktop-window.tsx`, `components/portia-desktop-shortcuts.tsx`, `components/portia-icons.tsx`: окна, ярлыки, artwork.
- `components/portia-wallpaper.tsx`, `components/portia-wallpaper-spider.tsx`: фон, паутина, паук (вынесены в Phase 17).

### Established Patterns
- Настройки рабочего стола хранятся независимо в одном storage-объекте. Повреждённое поле возвращается к default поштучно (STAB-DESK-05).
- Декомпозиция Phase 17 сохранила app ids, CSS hooks и storage keys (STAB-DESK-07). Их не переименовывать.
- `app/portia.css` содержит `prefers-reduced-motion` блоки, которые пересматриваются по D-10.

### Integration Points
- Визуальные тесты Playwright (`npm run test:e2e:visual`) и подписанный manifest Phase 15. Новые motion-кадры идут как кандидаты на owner approval.
- `openApp` в `components/portia-desktop.tsx`: точка для «кивка» (D-14).

</code_context>

<specifics>
## Specific Ideas

- Замечания владельца: паук «дёрганый и резкий», «слишком выделяется — отвлекает», «поворот резкий»; «след действует только с одной стороны»; «при выключении паука фон смещается».
- Плитки и карточки «должны сохранять по-прежнему свой же размер, но никак не увеличиваться» (из quick 261102-07k). Этот принцип распространяется на формы редактора (D-15).

</specifics>

<deferred>
## Deferred Ideas

- **SVG-картинки пустых состояний** («Сводка», «Справочник» и др., сейчас колба и микроскоп) → Phase 19 (STAB-DESK-08). Решение владельца 2026-11-02.
- **Пересмотр D-10 (игнор `prefers-reduced-motion`)** с точки зрения accessibility → Phase 20.
- **9 строк G3 с recoveryPhase 16** (editor-*, owner-editor-access, promotion-reviewer-editor) и **8 data-lanes**: фаза-владелец не назначена (решение по Phase 15). Не входят в Phase 18.

### Reviewed Todos (not folded)
- `.planning/todos/pending/unified-apps-system-discuss.md` («Единая система приложений»): новая оконная архитектура, обсуждается отдельно. В Phase 18 не входит.

</deferred>

---

*Phase: 18-rabochiy-stol-okna-i-zhivye-animatsii*
*Context gathered: 2026-11-02*
