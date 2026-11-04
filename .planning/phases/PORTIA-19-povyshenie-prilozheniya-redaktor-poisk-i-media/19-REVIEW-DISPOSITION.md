# 19 — Disposition of code review findings (19-REVIEW.md)

Дата: 2026-11-04. Статусы: `open` — не решено; `fixed` — исправлено с коммитом и проверкой; `phase-20` — перенесено с причиной. Никакая находка не закрыта молча.

| ID | Severity | Файл | Статус | Заметка |
|----|----------|------|--------|---------|
| CR-01 | Critical | components/portia-desktop-media.tsx:48-58 | fixed | `14e04c6` (19-15); свёрнутые обложки «Справочника» passed на обоих Chromium в «Прогоне C» (`media-offscreen.spec.ts`, populated). |
| WR-01 | Warning | scripts/phase16-staging.mjs:38-53 | fixed | `5e105bb` (19-17); unit-тесты DB URL/query guard. |
| WR-02 | Warning | scripts/phase19-acceptance.mjs:256,262,357,359 | fixed | `362eb6a` (19-17); unit-тесты snapshot и scoped shift/teardown. |
| WR-03 | Warning | app/api/uploads/route.ts:18-25,35 | phase-20 | Вне пути gap-closure: upload и STAB-MEDIA-01 уже доказаны; разграничение 403/503 и ранний size gate — security-ревью Phase 20. |
| WR-04 | Warning | components/portia-promotion.tsx:326-333 | fixed | `b02ef1b` (19-16); unit-тесты сохранения статуса и замка. Видимое поведение — owner UAT 19-21. |
| WR-05 | Warning | components/portia-editor.tsx:1808,1834-1835 | phase-20 | Редактор сотрудников (STAB-APP-07) не входит в разрывы верификации; общий networkSaveError и защита от двойной отправки — Phase 20. |
| WR-06 | Warning | lib/portia-promotion-reviewer.ts:30,112-114 | fixed | `f471ad5` (19-16); unit-тесты нормализации ника. Видимое поведение — owner UAT 19-21. |
| WR-07 | Warning | tests/e2e/specs/search.spec.ts:88,115-121 | fixed | `57a25c8`, `2f01a18` (19-19); ненулевой ё/е результат passed на обоих Chromium в populated, пустой источник даёт BLOCKED (DATA), таймер управляется `page.clock`. |
| IN-01 | Info | components/portia-desktop-dossier.tsx:128-161 | phase-20 | GIF в тексте глотают пунктуацию и обходят media gate. |
| IN-02 | Info | scripts/phase19-acceptance.mjs:235 | phase-20 | `in` по унаследованным ключам. |
| IN-03 | Info | components/portia-editor.tsx:2189 | phase-20 | «ОТОЗВАТЬ» без подтверждения. |
| IN-04 | Info | scripts/phase19-acceptance.mjs:185 | phase-20 | права файла credentials не действуют на Windows. |
| IN-05 | Info | lib/portia-employees.ts:507-511 | phase-20 | fallback на отсутствующие колонки рейтинга — проверить на production. |
