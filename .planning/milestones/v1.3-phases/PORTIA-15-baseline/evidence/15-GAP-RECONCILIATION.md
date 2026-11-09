# Phase 15: сверка пробелов G1-G5 после Phase 16 (план 15-20)

**Дата:** 2026-11-01
**Базовый коммит:** `cea3644`
**Исходные записи:** `../15-VERIFICATION.md` (status `gaps_found`, записан до завершения Phase 16); `../../PORTIA-16-kanonicheskiy-supabase-staging-i-sql-istina/16-VERIFICATION.md` (status `passed`).

Правило: BLOCKED и REJECTED не засчитываются как pass. Этот файл не меняет статусы требований STAB-BASE и статус Phase 15: их определяет повторная верификация.

## Сводка G1-G5

| Gap | Описание | Прежний статус (15-VERIFICATION) | Текущий статус | Доказательство | Коммит | Владелец открытой части |
|---|---|---|---|---|---|---|
| G1 | Disposable authenticated roles и изолированный Supabase | ОТКРЫТ | CLOSED | `16-LIVE-RUN.md`, разделы «Привилегированные lanes и API (G1)» (4 роли × 5 проектов PASS, API-матрица 7 маршрутов × 5 ролей, оба revoke без повторного входа) и «Статус гейтов»; `evidence/receipt-playwright.json` (status PASS, residual 0 по authUsers, content, editors, promo, storage); `16-VERIFICATION.md`, строка SC2 | `cac51e1`, `504cefa`, `4f3dd87` | — (закрыто) |
| G2 | Read backing для 15 data-dependent lanes | ОТКРЫТ | PARTIAL | `16-LIVE-RUN.md`, раздел «Классификация 15 data-lanes (G2, D6)» и строка «7 пиксельных application-сравнений и search-restored (DATA-SEED)» в «Остаются BLOCKED / вне фазы». 7 lanes PASS, 8 BLOCKED: 7 пиксельных application-сравнений по D6 и Firefox `search-restored` по DATA-SEED. Разбивка в разделе ниже | `504cefa`, `4f3dd87` | Phases 18-19 |
| G3 | 33 BLOCKED visual-строки | ОТКРЫТ | OPEN | Подписанный `15-FRAME-TEST-MAP.md`: 33 BLOCKED, без изменений. Phase 16 визуальный захват этих строк не выполняла (ни в `16-LIVE-RUN.md`, ни в `16-VERIFICATION.md` его нет). Разбивка по recoveryPhase ниже | — (подписанные байты не менялись, проверяется `--verify-promotion`) | Phases 18/19/20/22; 9 строк с recoveryPhase 16 ждут переназначения владельцем |
| G4 | 18 REJECTED-строк в ledger визуального одобрения | ОТКРЫТ | OPEN | `15-VISUAL-APPROVAL.md`: 18 REJECTED-строк = 9 motion (motion-shortcut ×5, motion-spider ×3, motion-web-wave ×1) и 9 прочих (window-search ×8 по проектам, desktop-clean-rest ×1) | — | Phase 18 |
| G5 | Физический PC (DPR 1.25) и phone UAT | ОТКРЫТ | OPEN | В каталоге фазы нет UAT-артефакта; в `16-LIVE-RUN.md`, «Остаются BLOCKED / вне фазы», физические устройства = BLOCKED | — | Phase 22 |

## G2: 15 data-lanes

| Id | Lane | Строк | Статус сейчас | Класс | Доказательство |
|---|---|---|---|---|---|
| L1 | visitor settings persist across reload | 5 | PASS | не-пиксельная lane | `16-LIVE-RUN.md`, «Классификация 15 data-lanes (G2, D6)»: 5 проектов PASS на изолированном backend |
| L2 | WebKit-phone shell diagnostics | 1 | PASS | не-пиксельная lane | то же: диагностика чистая, сетевая ошибка Phase 15 ушла с read backing |
| L3 | chromium-desktop vivian-activity | 1 | PASS | совпадение с утверждённым PNG | то же: совпал с утверждённым PNG |
| L4 | Firefox search-restored | 1 | BLOCKED | DATA-SEED | то же: FAIL, 783 px отличий против 7061 в Phase 15; изолированный backend не воспроизводит утверждённый контент; это не регрессия и не pass |
| L5 | пиксельные application-сравнения | 7 | BLOCKED | D6 | то же: D6 держит их BLOCKED независимо от исхода; наблюдение «6 из 10 application-сравнений chromium-desktop совпали» информационное, на статус не влияет; поимённого списка семи в Phase 15 нет, поэтому весь класс учтён как BLOCKED |

Итого: PASS 7, BLOCKED 8 (всего 15).

## G3: 33 BLOCKED visual-строки по recoveryPhase

Счётчики посчитаны кодом по JSONL подписанного `15-FRAME-TEST-MAP.md`.

| Id | Строк | reasonCode | Статус | Примечание |
|---|---|---|---|---|
| P16 | 9 | ISOLATED_AUTH_REQUIRED | BLOCKED | `editor-conflict-error`, `editor-dirty-saving-saved`, `editor-long-list-dialog`, `editor-phone-keyboard`, `editor-role-clean`, `editor-role-closed`, `editor-wysiwyg`, `owner-editor-access`, `promotion-reviewer-editor`. Phase 16 завершена, но визуальных кандидатов для этих строк не захватывала. Предпосылка (изолированная цель, server-derived session proof) теперь есть. Подписанный map по-прежнему указывает recoveryPhase 16 и не редактируется. Новую фазу-владельца должен выбрать Qloxz: это открытый вопрос владельцу, здесь фаза не назначается |
| P18 | 6 | MOTION_CAPTURE_BOUNDARY_REQUIRED (2), PHONE_WINDOW_CONTRACT (4) | BLOCKED | `motion-boot`, `motion-wallpapers`; `window-search-maximized` и `window-search-minimized` (по два проекта) |
| P19 | 12 | ISOLATED_PROMOTION_DATA_REQUIRED | BLOCKED | `motion-window-lock` и 11 состояний Promotion (active-request, assigned, cooldown, deadline, eligible, phone, qualification-lock, question-bank, result, reviewer-queue, safe-error) |
| P20 | 5 | PUBLIC_STATE_FIXTURE_REQUIRED | BLOCKED | `applications-system-*`: empty, fatal error, loading, permission denied, stale/degraded |
| P22 | 1 | PIXEL_AUTHORITY_NOT_SIGNED | BLOCKED | `desktop-firefox`: пиксельный авторитет не подписан |

Итого: 9 + 6 + 12 + 5 + 1 = 33.

## Влияние на требования

Этот план ничего не меняет в `REQUIREMENTS.md`.

- STAB-BASE-01 и STAB-BASE-05 остаются Complete.
- STAB-BASE-02: привилегированная часть доказана Phase 16 (G1), но требование остаётся Pending, пока 8 data-lanes из L4-L5 BLOCKED.
- STAB-BASE-03 и STAB-BASE-04 остаются Pending (G3, G4).
- STAB-BASE-06 остаётся Pending (G5 и визуальные пробелы).

Статус Phase 15 определяет повторная верификация.

## Границы

В этот файл перенесены только пути, названия разделов, хэши коммитов, статусы и счётчики. Идентификаторы цели Phase 16, run id, учётные записи, cookie и ключи не копировались.
