# 19 — Disposition of code review findings (19-REVIEW.md)

Дата: 2026-11-03. Статусы: `open` — не решено; `phase-20` — перенесено с причиной. Никакая находка не закрыта молча.

| ID | Severity | Файл | Статус | Заметка |
|----|----------|------|--------|---------|
| CR-01 | Critical | components/portia-desktop-media.tsx:48-58 | open | 15 s таймер PortiaImage идёт для незапрошенных lazy/скрытых картинок → обложки свёрнутых разделов «Справочника» навсегда «Изображение недоступно». Регресс 19-10; кандидат в gap-closure фазы 19. |
| WR-01 | Warning | scripts/phase16-staging.mjs:38-53 | open | parseDbUrl игнорирует query (`?host=`/`?hostaddr=`) — guard можно обойти. Безопасность staging/production. |
| WR-02 | Warning | scripts/phase19-acceptance.mjs:256,262,357,359 | open | teardown/shift по окну времени задевают чужие строки на изолированном проекте. |
| WR-03 | Warning | app/api/uploads/route.ts:18-25,35 | open | сбой проверки прав → 403 вместо 503; formData буферизует тело до проверки 4 MB. |
| WR-04 | Warning | components/portia-promotion.tsx:326-333 | open | не-503 ошибка опроса сбрасывает статус и снимает клиентский замок теста посреди попытки. |
| WR-05 | Warning | components/portia-editor.tsx:1808,1834-1835 | open | редактор сотрудников показывает сырое error.message, нет защиты от двойной отправки. |
| WR-06 | Warning | lib/portia-promotion-reviewer.ts:30,112-114 | open | reset-device отвергает кириллические/служебные ники (тихий 400). |
| WR-07 | Warning | tests/e2e/specs/search.spec.ts:88,115-121 | open | тест ё/е проходит на нулевых счётчиках; фиксированный waitForTimeout. |
| IN-01 | Info | components/portia-desktop-dossier.tsx:128-161 | phase-20 | GIF в тексте глотают пунктуацию и обходят media gate. |
| IN-02 | Info | scripts/phase19-acceptance.mjs:235 | phase-20 | `in` по унаследованным ключам. |
| IN-03 | Info | components/portia-editor.tsx:2189 | phase-20 | «ОТОЗВАТЬ» без подтверждения. |
| IN-04 | Info | scripts/phase19-acceptance.mjs:185 | phase-20 | права файла credentials не действуют на Windows. |
| IN-05 | Info | lib/portia-employees.ts:507-511 | phase-20 | fallback на отсутствующие колонки рейтинга — проверить на production. |
