# 20 — Dependency audit и реестр переносимых рисков

Commit: 59f90d2c1b088b1a835400c7491173e4129bf224

Данные: `20-DEPENDENCY-AUDIT.json` (нормализованный результат обеих команд на этом commit). Проверка: `node scripts/phase20-audit-check.mjs --verify`. Отчёт признаётся устаревшим, если commit не предок HEAD или изменились `package.json` / `package-lock.json` (сверка по sha256), если команды не те, если у dev-находки нет единственного disposition или в production есть находка.

Повторный снимок: `node scripts/phase20-audit-check.mjs --capture` (отказывается работать при незакоммиченных `package.json` / `package-lock.json` и при смене HEAD во время аудита).

## Команды и результаты

| Команда | Exit code | Находок | Итог |
|---|---|---|---|
| `npm.cmd audit --omit=dev --json` | 0 | 0 | Production чист (STAB-SEC-05) |
| `npm.cmd audit --json` | 1 | 16 (moderate: 16, high: 0, critical: 0) | Только dev-зависимости, disposition ниже |

Node v22.13.1, npm 10.9.2. Обращения только к реестру npm; секреты и `.env*` не читались.

## Production findings

Нет. Production dependency audit чист: 0 находок любой severity.

## Dev disposition

Disposition: `accepted` (dev-only, D-09, в релизный отчёт без отдельного waiver), `fixed`, `reassessed` (только с доказательной записью D-12), `blocker` (high/critical без решения блокирует релиз). Ярлык severity взят из npm без понижения. Все 16 находок — следствия одного advisory `GHSA-g3hv-75wg-m249` (minimatch, `<11.0.1`) в цепочке ESLint: 15 пакетов затронуты транзитивно (`via:<пакет>`), 1 строка относится к самому advisory.

| ID | Package | Severity | Disposition | Rationale | Owner |
|---|---|---|---|---|---|
| via:@eslint-community/eslint-utils | @eslint-community/eslint-utils | moderate | accepted | Следствие GHSA-g3hv-75wg-m249 через цепочку eslint > @eslint-community/eslint-utils; своего advisory нет; dev-only, в сборку не попадает. Disposition как у корня. | Qloxz (владелец релиза) |
| via:@eslint/config-array | @eslint/config-array | moderate | accepted | Следствие GHSA-g3hv-75wg-m249 через цепочку eslint > @eslint/config-array; своего advisory нет; dev-only, в сборку не попадает. Disposition как у корня. | Qloxz (владелец релиза) |
| via:@eslint/eslintrc | @eslint/eslintrc | moderate | accepted | Следствие GHSA-g3hv-75wg-m249 через цепочку eslint > @eslint/eslintrc; своего advisory нет; dev-only, в сборку не попадает. Disposition как у корня. | Qloxz (владелец релиза) |
| via:@next/eslint-plugin-next | @next/eslint-plugin-next | moderate | accepted | Следствие GHSA-g3hv-75wg-m249 через цепочку eslint-config-next > @next/eslint-plugin-next; своего advisory нет; dev-only, в сборку не попадает. Disposition как у корня. | Qloxz (владелец релиза) |
| via:@typescript-eslint/eslint-plugin | @typescript-eslint/eslint-plugin | moderate | accepted | Следствие GHSA-g3hv-75wg-m249 через цепочку eslint-config-next > typescript-eslint > @typescript-eslint/eslint-plugin; своего advisory нет; dev-only, в сборку не попадает. Disposition как у корня. | Qloxz (владелец релиза) |
| via:@typescript-eslint/parser | @typescript-eslint/parser | moderate | accepted | Следствие GHSA-g3hv-75wg-m249 через цепочку eslint-config-next > typescript-eslint > @typescript-eslint/eslint-plugin > @typescript-eslint/parser; своего advisory нет; dev-only, в сборку не попадает. Disposition как у корня. | Qloxz (владелец релиза) |
| via:@typescript-eslint/type-utils | @typescript-eslint/type-utils | moderate | accepted | Следствие GHSA-g3hv-75wg-m249 через цепочку eslint-config-next > typescript-eslint > @typescript-eslint/eslint-plugin > @typescript-eslint/type-utils; своего advisory нет; dev-only, в сборку не попадает. Disposition как у корня. | Qloxz (владелец релиза) |
| via:@typescript-eslint/typescript-estree | @typescript-eslint/typescript-estree | moderate | accepted | Следствие GHSA-g3hv-75wg-m249 через цепочку eslint-config-next > typescript-eslint > @typescript-eslint/typescript-estree; своего advisory нет; dev-only, в сборку не попадает. Disposition как у корня. | Qloxz (владелец релиза) |
| via:@typescript-eslint/utils | @typescript-eslint/utils | moderate | accepted | Следствие GHSA-g3hv-75wg-m249 через цепочку eslint-config-next > typescript-eslint > @typescript-eslint/utils; своего advisory нет; dev-only, в сборку не попадает. Disposition как у корня. | Qloxz (владелец релиза) |
| via:eslint | eslint | moderate | accepted | Следствие GHSA-g3hv-75wg-m249 (прямая dev-зависимость eslint тянет затронутые пакеты); своего advisory нет; dev-only, в сборку не попадает. Disposition как у корня. | Qloxz (владелец релиза) |
| via:eslint-config-next | eslint-config-next | moderate | accepted | Следствие GHSA-g3hv-75wg-m249 (прямая dev-зависимость eslint-config-next тянет затронутые пакеты); своего advisory нет; dev-only, в сборку не попадает. Disposition как у корня. | Qloxz (владелец релиза) |
| via:eslint-plugin-import | eslint-plugin-import | moderate | accepted | Следствие GHSA-g3hv-75wg-m249 (eslint-plugin-import использует minimatch); своего advisory нет; dev-only, в сборку не попадает. Disposition как у корня. | Qloxz (владелец релиза) |
| via:eslint-plugin-jsx-a11y | eslint-plugin-jsx-a11y | moderate | accepted | Следствие GHSA-g3hv-75wg-m249 через цепочку eslint-config-next > eslint-plugin-jsx-a11y; своего advisory нет; dev-only, в сборку не попадает. Disposition как у корня. | Qloxz (владелец релиза) |
| via:eslint-plugin-react | eslint-plugin-react | moderate | accepted | Следствие GHSA-g3hv-75wg-m249 (eslint-plugin-react использует minimatch); своего advisory нет; dev-only, в сборку не попадает. Disposition как у корня. | Qloxz (владелец релиза) |
| GHSA-g3hv-75wg-m249 | minimatch | moderate | accepted | ReDoS (globparts amplification, CWE-405) в minimatch <11.0.1 внутри dev-цепочки ESLint; в production audit нет, в сборку не попадает, обрабатывает только шаблоны из репозитория. npm предлагает eslint@4.0.0 (semver-major понижение), не применено. Пересмотреть при обновлении ESLint. | Qloxz (владелец релиза) |
| via:typescript-eslint | typescript-eslint | moderate | accepted | Следствие GHSA-g3hv-75wg-m249 через цепочку eslint-config-next > typescript-eslint; своего advisory нет; dev-only, в сборку не попадает. Disposition как у корня. | Qloxz (владелец релиза) |

## Lockfile ledger

- `package.json` и `package-lock.json` в плане 20-10 не менялись; `npm audit fix` не запускался, пакеты не устанавливались. Sha256 обоих файлов записаны в `20-DEPENDENCY-AUDIT.json` (`lockfileSha256`, `packageJsonSha256`), и `--verify` сравнивает их с рабочим деревом.
- Единственное предложение `npm audit` — мажорные понижения `eslint@4.0.0` и `eslint-config-next@0.2.4`. Это не исправление, а откат версий инструмента на годы назад; не применено.
- Если замена зависимости всё же понадобится, это отдельный increment: только lockfile (и `package.json` при необходимости), Package Legitimacy Audit для каждого нового или заменённого пакета (`[ASSUMED]`/`[SUS]` останавливают исполнителя до проверки человеком), повторный `--capture`, никаких функциональных правок в том же commit.

## Реестр переносимых рисков для release notes (D-09, STAB-SEC-06)

Источник формулировок для `20-RELEASE-NOTES.md`. Детали, severity и доказательства — в `20-SECURITY-MATRIX.md`. Здесь ничего не смягчено и не обещано сверх фактов.

| Риск | Статус | Формулировка для релиза | Матрица |
|---|---|---|---|
| Начальный режим теста (ПК/телефон) подделываем | accepted risk (STAB-PROM-08) | Режим определяется по заголовкам запроса и поэтому подделываем; после старта фиксируется сервером. Защита от намеренной подмены не обещается. | SEC20-16 |
| Привязка устройства не является аппаратной аттестацией | accepted risk (STAB-SEC-06) | Привязка — токен в httpOnly-cookie и грубые бакеты IP/UA. Очистка cookie, другой браузер или VPN создают новое устройство; повторная привязка требует сброса владельцем. Аппаратная идентификация не обещается. | SEC20-17 |
| Анонимные RPC без вызывающего: `bind_device`, `register_attempt`; прямой `submit_request` | open, release-ledger | Revoke рекомендован, миграция не применена; применение на production за владельцем. | SEC20-03, SEC20-04 |
| Запись в `portia-media` любым редактором; запись в `portia_content` мимо проверки вкладок | release-ledger, D-11 принят владельцем | Закрытые вкладки защищены сервером сайта, не базой. | SEC20-08, SEC20-09 |
| CSP с `unsafe-inline` и `img-src https:` | release-ledger | Кандидат Report-Only включён, enforcement отложен до PC/phone UAT (D-05). | SEC20-12 |
| 16 dev-находок moderate | accepted dev-only | Production audit чист; dev-цепочка ESLint, безопасного обновления нет. | SEC20-13 |
| HSTS и `upgrade-insecure-requests` на опубликованном HTTPS | LIMITATION (D-14) | Не проверялось; HTTP/LAN этого не доказывает. | SEC20-14 |
| Оракул одобрения email редактора | accepted (Phase 16) | Анонимная RPC подтверждает, одобрен ли email. | SEC20-01 |
