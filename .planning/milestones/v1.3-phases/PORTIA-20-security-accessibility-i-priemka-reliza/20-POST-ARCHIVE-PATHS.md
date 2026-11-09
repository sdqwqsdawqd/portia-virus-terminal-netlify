# 20-POST-ARCHIVE-PATHS: изменение путей после FRC

Дата: 2026-11-09. Источник: quick 261109-brj.

## Что сделано

- Шесть каталогов фаз PORTIA-15 … PORTIA-20 перенесены из `.planning/phases/` в `.planning/milestones/v1.3-phases/` (раскладка архива GSD). Файлы перенесены как есть, без правок содержимого.
- Скрипты и тесты теперь читают заархивированные копии `.planning/milestones/v1.3-REQUIREMENTS.md`, `.planning/milestones/v1.3-ROADMAP.md` и файлы фаз из архива.
- В `POST_FRC_PATHS` (`scripts/phase20-release-gate.mjs`) добавлено 11 файлов, в которых изменены только константы путей: `scripts/phase15-visual-manifest.mjs`, `scripts/phase16-staging.mjs`, `scripts/phase19-acceptance.mjs`, `scripts/phase19-matrix-data.mjs`, `scripts/phase20-audit-check.mjs`, `lib/editor-image-framing.test.ts`, `lib/phase15-visual-manifest.test.ts`, `lib/phase20-hints-inventory.test.ts`, `lib/phase20-requirements-ledger.test.ts`, `lib/security-matrix.test.ts`, `tests/e2e/visual-candidates/support.ts`. Кода продукта и правок свидетельств в них нет.

## Что осталось по старому пути

Подписанные идентичности хранят путь до архивации и не переписываются; при чтении они сопоставляются с архивом:

- `ownerVerdict.source` в `tests/e2e/visual/phase20-baselines.json` (реестр, решение владельца D-68): скрипт сравнивает значение дословно, а сам файл вердикта читает из архива.
- Источник строки SEC20-11 в `20-SECURITY-MATRIX.md` (путь к `16-PRODUCTION-POSTFLIGHT.md` под PORTIA-16): тест матрицы переводит ведущий `.planning/phases/` в архивный путь только при проверке существования файла.

## Связь с другими записями

- Фраза «После FRC менялись только …» в `20-RECONCILIATION.md` остаётся записью плана 20-15. Эта заметка продолжает её и ничего в ней не правит.
- `git show <plan_base>` продолжает читать `.planning/REQUIREMENTS.md` из истории: на коммите plan_base файл лежал по старому пути.
- `--run` на коммите, сделанном до архивации, читает прежнее расположение фазы через `phaseDirIn`. Режимы `--verify-*` читают дерево HEAD и используют архивный путь.
