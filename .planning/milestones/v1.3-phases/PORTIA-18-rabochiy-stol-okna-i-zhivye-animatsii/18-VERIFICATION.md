---
phase: PORTIA-18-rabochiy-stol-okna-i-zhivye-animatsii
verified: 2026-11-02T12:00:00Z
status: gaps_found
score: 8/14 must-haves verified
covered_files:
  - ".planning/phases/PORTIA-18-rabochiy-stol-okna-i-zhivye-animatsii/18-01-PLAN.md"
  - ".planning/phases/PORTIA-18-rabochiy-stol-okna-i-zhivye-animatsii/18-01-SUMMARY.md"
  - ".planning/phases/PORTIA-18-rabochiy-stol-okna-i-zhivye-animatsii/18-02-PLAN.md"
  - ".planning/phases/PORTIA-18-rabochiy-stol-okna-i-zhivye-animatsii/18-02-SUMMARY.md"
  - ".planning/phases/PORTIA-18-rabochiy-stol-okna-i-zhivye-animatsii/18-03-PLAN.md"
  - ".planning/phases/PORTIA-18-rabochiy-stol-okna-i-zhivye-animatsii/18-03-SUMMARY.md"
  - ".planning/phases/PORTIA-18-rabochiy-stol-okna-i-zhivye-animatsii/18-04-PLAN.md"
  - ".planning/phases/PORTIA-18-rabochiy-stol-okna-i-zhivye-animatsii/18-04-SUMMARY.md"
  - ".planning/phases/PORTIA-18-rabochiy-stol-okna-i-zhivye-animatsii/18-05-PLAN.md"
  - ".planning/phases/PORTIA-18-rabochiy-stol-okna-i-zhivye-animatsii/18-05-SUMMARY.md"
  - ".planning/phases/PORTIA-18-rabochiy-stol-okna-i-zhivye-animatsii/18-06-PLAN.md"
  - ".planning/phases/PORTIA-18-rabochiy-stol-okna-i-zhivye-animatsii/18-06-SUMMARY.md"
  - ".planning/phases/PORTIA-18-rabochiy-stol-okna-i-zhivye-animatsii/18-07-PLAN.md"
  - ".planning/phases/PORTIA-18-rabochiy-stol-okna-i-zhivye-animatsii/18-07-SUMMARY.md"
  - "app/layout.tsx"
  - "app/portia.css"
  - "components/portia-desktop-shortcuts.tsx"
  - "components/portia-desktop-window.tsx"
  - "components/portia-desktop.tsx"
  - "components/portia-editor-dossier.tsx"
  - "components/portia-editor.tsx"
  - "components/portia-wallpaper-spider.tsx"
  - "lib/accent-boot.ts"
  - "lib/shortcut-layout.ts"
  - "lib/sort-order.ts"
  - "lib/wallpaper-web.ts"
  - "lib/window-geometry.ts"
covered_digest: "v3:sha256:0f5ebad75b322ab3147be794794788a9d15d4c8fce82e8f810c616397762f1d4"
behavior_unverified: 3
overrides_applied: 0
gaps:
  - truth: "STAB-MEDIA-06 / SC5: воспроизводимые owner PC/phone traces до и после; interaction, drag, wallpaper, app-open не хуже baseline и укладываются в budgets"
    status: failed
    reason: "Ни одного замера нет. 18-PERF-TRACES.md: все 7 сценариев (PC-1..4, Phone-1, Phone-3, Phone-taskbar) = BLOCKED (OWNER-TRACE), BASE и HEAD «не снято». Владелец отложил замеры. Ручное «verified» из (б) замеры не заменяет."
    artifacts:
      - path: ".planning/phases/PORTIA-18-rabochiy-stol-okna-i-zhivye-animatsii/18-PERF-TRACES.md"
        issue: "таблица результатов пуста: не снято ни BASE, ни HEAD"
    missing:
      - "Владелец снимает 7 trace на BASE 78c24e1 и HEAD по инструкции из 18-PERF-TRACES.md и присылает три числа на сценарий (самый длинный кадр, кадров >50 мс, длительность взаимодействия)"
      - "Это действие владельца, кодового плана оно не требует; закрывается отдельным шагом или переносом на Phase 22/гейт milestone"
  - truth: "STAB-MOTION-08: после реализации spider/web/Vivian/shortcut/window motion проходят visual regression и owner review"
    status: partial
    reason: "Часть «до реализации утверждено» выполнена (18-MOTION-APPROVAL.md, approve-all). Часть «после реализации»: (б) физический просмотр принят («verified»), но visual regression не пройден: подписанные кадры Phase 15 падают (7 passed, 14 failed), все строки реестра 18-VISUAL-REVIEW.md (разделы 1-3) = PENDING, кадры spider/web/shortcut/window STALE после quick 261102-d7r, пересъёмка отклонена владельцем, группы D (данные) и F (webkit-phone) не решены, перенос в эталон не выполнен."
    artifacts:
      - path: ".planning/phases/PORTIA-18-rabochiy-stol-okna-i-zhivye-animatsii/18-VISUAL-REVIEW.md"
        issue: "все вердикты по кадрам PENDING; кандидаты устарели; регрессия по утверждённым кадрам красная (EXPECTED DRIFT, не принят)"
    missing:
      - "Вердикты владельца по кадрам (а) или явное решение, что физический вердикт (б) заменяет visual regression"
      - "Решение по группам D и F и по переносу в эталон (отдельный шаг вне фазы)"
      - "Пересъёмка кандидатов для spider/web/shortcut/window на текущем HEAD, если нужны покадровые доказательства"
  - truth: "STAB-DESK-06 / SC3: позиция ярлыка после drag сохраняется и остаётся достижимой, не перекрывает критические controls"
    status: partial
    reason: "Подтверждено кодом (WR-01 из 18-REVIEW.md): savedShortcutLayout в components/portia-desktop-shortcuts.tsx:43-50 рисует позицию через жёсткие calc(100% - 118px)/calc(100% - 128px) (размер большой иконки), а JS clampShortcutPosition и проверка препятствий (assistant, format button) считают по реальному размеру 94x86. Нарисованная позиция не равна сохранённой и проверенной; иконка может быть нарисована до ~30px от проверенной точки и пересечь ассистента. Дополнительно WR-02: JS блокирует drag на <=900px, а CSS (app/portia.css:1340-1349) для 521-900px оставляет absolute-раскладку и touch-action:none. Disposition обоих = open, не исправлены."
    artifacts:
      - path: "components/portia-desktop-shortcuts.tsx"
        issue: "CSS-clamp 118/128px расходится с JS-clamp по реальному размеру"
      - path: "app/portia.css"
        issue: "диапазон 521-900px: absolute-иконки с touch-action:none без возможности drag"
    missing:
      - "Использовать реальный размер иконки в CSS-clamp (или снять CSS min() и ре-клампить в JS на resize) + тест на согласованность"
      - "Один контракт для 521-900px: брейкпоинт JS = брейкпоинт CSS"
deferred: []
behavior_unverified_items:
  - truth: "STAB-MOTION-06: Вивьян следует accent без неоновой/серой рассинхронизации, остаётся читаемой"
    test: "На PC и phone поочерёдно выбрать accent teal/ice/amber/red и произвольный цвет, сравнить Вивьян с интерфейсом в idle, activity, offended"
    expected: "Цвет Вивьян совпадает с акцентом без пересвета и серости; ответ понятен при motion off"
    why_human: "Тесты проверяют только значения фильтра (saturate/brightness) и hue-rotate; визуальное сравнение в 18-02 не выполнялось, кадры Вивьян PENDING, в списке (б) Вивьян по цвету не названа"
  - truth: "STAB-MOTION-07: обои не создают заметный jank"
    test: "Сменить обои Паутина/Гель/Паутина на PC и phone при motion on, наблюдать плавность; затем DevTools Performance"
    expected: "Нет заметных пропусков кадров, при off обои статичны, без flash и пустого слоя"
    why_human: "Статичность при off и отсутствие пустого слоя покрыты тестами; jank можно оценить только замером (PC-3, Phone-3 = BLOCKED)"
  - truth: "STAB-DESK-03 (часть): активная квалификация запрещает close/minimize/move/взаимодействие с фоном"
    test: "Войти ролью участника с активной квалификацией, попытаться закрыть, свернуть, переместить окно и нажать фон"
    expected: "Все запрещённые действия блокированы, разрешено только «Повышение»"
    why_human: "В браузере BLOCKED (нужны аутентифицированная роль и источник данных); есть только структурные тесты (qualificationLocked в components/portia-desktop.tsx:749,842,885,932; lib/portia-qualification-ui.test.ts)"
coincidental_reliance_items: []
---

# Phase 18: Рабочий стол, окна и живые анимации. Отчёт верификации

**Цель фазы:** Рабочий стол одинаково надёжен на PC и phone, а его живая motion-система следует утверждённому контракту без потери художественной основы и производительности.
**Проверено:** 2026-11-02
**Статус:** gaps_found
**Повторная верификация:** Нет, первичная.

## Итог

Кодовая часть фазы в основном сделана и подтверждена: три режима «Анимации», заставка один раз за вкладку, геометрия окон, система циклов 12 ярлыков, ход паука и волны, колонки редактора, скрытие Вивьян на phone. Но цель фазы включает «без потери производительности» и утверждение владельцем после реализации, а эти части не подтверждены: замеры скорости отсутствуют целиком (BLOCKED), вердикты по кадрам PENDING, кадры устарели. Есть и подтверждённый кодом дефект раскладки ярлыков (WR-01/WR-02), не исправленный. Статус `passed` не может быть присвоен.

## Достижение цели

### Критерии успеха ROADMAP

| # | Критерий | Статус | Доказательства |
|---|----------|--------|----------------|
| 1 | Окна: drag/resize/minimize/maximize/restore в границах, квалификация блокирует действия | ВЕРНО (часть квалификации в браузере BLOCKED) | `lib/window-geometry.ts` (fitGeometry, resizeGeometry, dragGeometry, inset 8px со всех сторон), `lib/window-geometry.test.ts` зелёные; e2e `[STAB-DESK-02/03/04]` в `tests/e2e/specs/desktop-windows.spec.ts` существуют; по 18-04/18-06 SUMMARY прошли на chromium-desktop, dpr125, chromium-phone, webkit-phone (мной не перезапускались). Блокировка при квалификации: `qualificationLocked` в `portia-desktop.tsx`, браузерного доказательства нет |
| 2 | Accent, wallpaper, icon size/position, motion, spider независимы, переживают reload, повреждённое storage даёт default только своего поля | ВЕРНО | `lib/accent-boot.ts`: head script с try/catch, motion off/reduced/иначе full, spider off/иначе on; ключ `portia-desktop-settings-v1` неизменен; `lib/accent-theme.test.ts` зелёные |
| 3 | Ярлык достижим после drag, открывается мышью/клавиатурой/touch; цикл не сдвигает контейнер, заканчивается кадром покоя | ЧАСТИЧНО | Цикл: тесты `lib/portia-desktop.test.ts` (12 иконок, `--ease-out` в покой, контейнер не сдвигается) зелёные. Drag: WR-01/WR-02 подтверждены в коде (см. gaps) |
| 4 | Boot, паук, волны, обои, Вивьян воспроизводят full/reduced/off без телепортаций, следов, flash | В ОСНОВНОМ ВЕРНО | Заставка и режимы: CSS `html[data-boot="seen"]`, reduced/off скрывают `.boot-screen` (portia.css:837-838), `bootSkipped` в `portia-desktop.tsx:436`. Паук: 40+ тестов `lib/wallpaper-web.test.ts` (старт/стоп без рывка, `turnGate`, волны гаснут за 0.9 с, off без следов). Вивьян по цвету: не подтверждено визуально |
| 5 | Owner PC/phone traces, не хуже baseline, в budgets | НЕ ВЫПОЛНЕНО | 18-PERF-TRACES.md: все BLOCKED (OWNER-TRACE) |
| 6 | Единая система ярлыков, контейнер неподвижен, цикл не обрывается на pointer exit, конечный = статичный кадр | ВЕРНО (принято владельцем в (б)) | Тесты `shortcut motion survives pointer exit...`, `shortcut artwork is not redrawn`, `shared shortcut hover feedback never translates the icon container`; 28 `@keyframes icon-*` в portia.css; (б) «verified» после quick 261102-d7r. Покадровые кандидаты STALE |
| 7 | Паук проходит соседние сектора без обхода spawn-смещением; reflow окон без потери информации | ЧАСТИЧНО | Паук: `planWalk` 2-4 crossing по видимым узлам, не назад (тест), старт случайный рядом с нитью, перенос только на load и show. Reflow редактора (колонки 340px, карточки): аутентифицированная роль нужна, BLOCKED |

### Покрытие требований

Все 14 ID из ROADMAP присутствуют в `requirements:` frontmatter планов 18-01..18-07; осиротевших нет. Статус в REQUIREMENTS.md: `[x]` только STAB-DESK-05 и STAB-MOTION-01, остальные Pending; это согласуется с моими выводами и менять не нужно.

| Требование | Планы | Статус | Доказательства |
|------------|-------|--------|----------------|
| STAB-DESK-02 | 18-04, 18-06 | ВЕРНО (reflow редактора в браузере BLOCKED) | window-geometry + тесты, e2e прошли по SUMMARY, физический вердикт (б) по drag/resize у краёв. IN-01: dragGeometry молча уменьшает высоту ниже app minimum (info) |
| STAB-DESK-03 | 18-04 | ЧАСТИЧНО | min/max/close/taskbar в e2e; блокировка квалификации только структурно (human item) |
| STAB-DESK-04 | 18-04, 18-06 | ВЕРНО | e2e phone (Вивьян скрыта при открытом окне, без overflow) на chromium-phone и webkit-phone по SUMMARY; клавиатура и физический phone приняты владельцем в (б) как ручной вердикт |
| STAB-DESK-05 | 18-01 | ВЕРНО | см. SC2; отмечено в REQUIREMENTS.md |
| STAB-DESK-06 | 18-03 | ЧАСТИЧНО | WR-01/WR-02 в gaps |
| STAB-MOTION-01 | 18-01, 18-02 | ВЕРНО | единый контракт, `prefers-reduced-motion` в app/components/lib (нетестовые) = 0 (проверено grep); отмечено в REQUIREMENTS.md |
| STAB-MOTION-02 | 18-02 | ВЕРНО | заставка один раз за tab session, sessionStorage пишется только после доигранной заставки, off/reduced без заставки |
| STAB-MOTION-03 | 18-05 | ВЕРНО | тесты траектории/старта/релокации, (б) принято владельцем |
| STAB-MOTION-04 | 18-05 | ВЕРНО | передняя пара (L4/R4) ведёт hunting-pose, волны только от постановки лап и гаснут за 0.9 с (тесты); (б) |
| STAB-MOTION-05 | 18-03 | ВЕРНО | см. SC6 |
| STAB-MOTION-06 | 18-02 | ПРИСУТСТВУЕТ, ПОВЕДЕНИЕ НЕ ПОДТВЕРЖДЕНО | human item |
| STAB-MOTION-07 | 18-02 | ПРИСУТСТВУЕТ, ПОВЕДЕНИЕ НЕ ПОДТВЕРЖДЕНО | jank не измерен |
| STAB-MOTION-08 | 18-01, 18-07 | НЕ ВЫПОЛНЕНО (gap) | утверждение до реализации есть; visual regression после реализации не пройден |
| STAB-MEDIA-06 | 18-01, 18-07 | НЕ ВЫПОЛНЕНО (gap) | traces отсутствуют |

Счёт: 8 из 14 требований подтверждены (DESK-02, DESK-04, DESK-05, MOTION-01, 02, 03, 04, 05). Не засчитаны: DESK-03 (квалификация только структурно), DESK-06 (WR-01/WR-02), MOTION-06 и MOTION-07 (присутствуют, поведение не подтверждено, 3 пункта в `behavior_unverified_items`), MOTION-08 и MEDIA-06 (gaps).

### Артефакты и связи

| Артефакт | Проверка | Статус |
|----------|----------|--------|
| `lib/accent-boot.ts`, `app/layout.tsx` (SSR `data-motion="full"`) | head script согласован с эффектом `portia-desktop.tsx`; ревью подтвердило отсутствие инъекций | ВЕРНО |
| `lib/window-geometry.ts` + `components/portia-desktop-window.tsx` | подключены, тесты зелёные | ВЕРНО |
| `lib/shortcut-layout.ts` + `components/portia-desktop-shortcuts.tsx` | подключены; расхождение CSS/JS clamp (WR-01) | ПРОБЛЕМА |
| `lib/wallpaper-web.ts` + `components/portia-wallpaper-spider.tsx` | подключены, 40+ тестов | ВЕРНО (IN-03: учёт паузы паука частичный, info) |
| `lib/sort-order.ts` + `components/portia-editor-dossier.tsx` | подключены; WR-03: hit-test читает rect с FLIP-transform, в браузере не проверено | ПРЕДУПРЕЖДЕНИЕ |
| `18-PERF-TRACES.md` | инструкция есть, результатов нет | ПУСТО (gap) |

### Поведенческие проверки (запущены мной)

| Проверка | Команда | Результат |
|----------|---------|-----------|
| Unit-подмножество (geometry, shortcut-layout, wallpaper-web, sort-order, window-open, accent-theme), Node 22.13.1 | `node --experimental-strip-types --test ...` | 122 tests, 122 pass, 0 fail |
| Типы | `npm exec tsc -- --noEmit` | exit 0, без ошибок |
| Подписанные кадры Phase 15 | `node scripts/phase15-visual-manifest.mjs --verify-promotion` | «Verified 33 exact owner-approved snapshot bytes; 18 non-approved rows excluded.» |
| Полный unit gate (установлено родительским агентом на HEAD) | `npm test` | 889 tests, 886 pass, 0 fail, 3 skipped |
| Playwright e2e | не запускался мной | нет read data source и preflight env; опираюсь на строки 18-04/18-06 SUMMARY, помечено как заявленное, не как мой результат |

### Анти-паттерны

Маркеров TBD/FIXME/XXX в изменённых файлах не искал построчно сверх ревью; в 18-REVIEW.md их нет. Открытые находки code review (disposition = open): WR-01, WR-02 (подтверждены, вынесены в gap по DESK-06), WR-03 (не подтверждено в браузере), WR-04 (отказ от чтения OS `prefers-reduced-motion` является решением владельца D-10 и согласуется с формулировкой STAB-MOTION-01; риск доступности WCAG 2.3.3 стоит записать как принятый), IN-01..IN-03.

### Что BLOCKED / PENDING и не засчитано как pass

- Замеры скорости (PC-1..4, Phone-1, Phone-3, Phone-taskbar): BLOCKED (OWNER-TRACE).
- Вердикты по кадрам (а), группы D и F, перенос в эталон: PENDING; кадры spider/web/shortcut/window STALE.
- Аутентифицированный редактор, роли, квалификация в браузере, Postgres/RLS: BLOCKED.
- Acceptance gate ROADMAP («Geometry на DPR 1/1.25, motion quality и long-session performance открыты до browser evidence и физического PC verdict»): физический verdict (б) принят, long-session performance открыт.

## Человеческая проверка

1. **Вивьян и accent (MOTION-06).** Сравнить цвет Вивьян с интерфейсом на всех accent; ожидается без неона и серости.
2. **Jank обоев (MOTION-07).** Смена обоев на PC и phone; ожидается без заметных пропусков, статично при off.
3. **Квалификация в браузере (DESK-03).** Роль с активной квалификацией; ожидается блокировка close/minimize/move/фона.

## Рекомендуемое закрытие

- Исправить WR-01 и WR-02 (малый кодовый план `--gaps`), добавить тест согласованности JS/CSS.
- Владельцу: снять 7 trace по 18-PERF-TRACES.md; дать вердикты по кадрам или решение, что (б) заменяет visual regression; решить D/F и перенос в эталон.
- Остальные открытые находки review (WR-03, WR-04, IN-01..03) триажировать в 18-REVIEW-DISPOSITION.md.

---

_Проверено: 2026-11-02_
_Верификатор: Claude (gsd-verifier)_
