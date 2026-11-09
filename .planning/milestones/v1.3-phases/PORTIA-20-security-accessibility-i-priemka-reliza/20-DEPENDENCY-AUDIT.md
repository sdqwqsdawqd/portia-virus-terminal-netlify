# 20 — Dependency audit и реестр переносимых рисков

Commit: 92b8405af586714f94fe3d4045b7a09abbb216f7

Данные: `20-DEPENDENCY-AUDIT.json` (нормализованный результат обеих команд на этом commit). Проверка: `node scripts/phase20-audit-check.mjs --verify`. Отчёт признаётся устаревшим, если commit не предок HEAD или изменились `package.json` / `package-lock.json` (сверка по sha256), если команды не те, если у dev-находки нет единственного disposition или в production есть находка.

Повторный снимок: `node scripts/phase20-audit-check.mjs --capture` (отказывается работать при незакоммиченных `package.json` / `package-lock.json` и при смене HEAD во время аудита).

## Команды и результаты

| Команда | Exit code | Находок | Итог |
|---|---|---|---|
| `npm.cmd audit --omit=dev --json` | 0 | 0 | Production чист (STAB-SEC-05) |
| `npm.cmd audit --json` | 1 | 8 (moderate: 8, high: 0, critical: 0) | Только dev-зависимости, disposition ниже |

Node v24.21.0, npm 11.19.0 (повторный снимок 2026-11-09 после SEC-08, Phase 21-02; npm из временного Node 22.13.1 не запускался — нет `node-gyp`). Обращения только к реестру npm; секреты и `.env*` не читались.

## Production findings

Нет. Production dependency audit чист: 0 находок любой severity.

## Dev disposition

Disposition: `accepted` (dev-only, D-09, в релизный отчёт без отдельного waiver), `fixed`, `reassessed` (только с доказательной записью D-12), `blocker` (high/critical без решения блокирует релиз). Ярлык severity взят из npm без понижения. Все 8 находок — следствия одного advisory `GHSA-g3hv-75wg-m249` (minimatch, `>=7.0.0 <11.0.1`) в цепочке eslint-config-next > typescript-eslint: 7 пакетов затронуты транзитивно (`via:<пакет>`), 1 строка относится к самому advisory. После перехода на eslint-config-next 16.4.5 (SEC-08) восемь прежних строк (eslint, @eslint/*, @next/eslint-plugin-next, eslint-plugin-import/jsx-a11y/react) из отчёта npm ушли.

| ID | Package | Severity | Disposition | Rationale | Owner |
|---|---|---|---|---|---|
| via:@typescript-eslint/eslint-plugin | @typescript-eslint/eslint-plugin | moderate | accepted | Следствие GHSA-g3hv-75wg-m249 через цепочку eslint-config-next > typescript-eslint > @typescript-eslint/eslint-plugin; своего advisory нет; dev-only, в сборку не попадает. Disposition как у корня. | Qloxz (владелец релиза) |
| via:@typescript-eslint/parser | @typescript-eslint/parser | moderate | accepted | Следствие GHSA-g3hv-75wg-m249 через цепочку eslint-config-next > typescript-eslint > @typescript-eslint/eslint-plugin > @typescript-eslint/parser; своего advisory нет; dev-only, в сборку не попадает. Disposition как у корня. | Qloxz (владелец релиза) |
| via:@typescript-eslint/type-utils | @typescript-eslint/type-utils | moderate | accepted | Следствие GHSA-g3hv-75wg-m249 через цепочку eslint-config-next > typescript-eslint > @typescript-eslint/eslint-plugin > @typescript-eslint/type-utils; своего advisory нет; dev-only, в сборку не попадает. Disposition как у корня. | Qloxz (владелец релиза) |
| via:@typescript-eslint/typescript-estree | @typescript-eslint/typescript-estree | moderate | accepted | Следствие GHSA-g3hv-75wg-m249 через цепочку eslint-config-next > typescript-eslint > @typescript-eslint/typescript-estree; своего advisory нет; dev-only, в сборку не попадает. Disposition как у корня. | Qloxz (владелец релиза) |
| via:@typescript-eslint/utils | @typescript-eslint/utils | moderate | accepted | Следствие GHSA-g3hv-75wg-m249 через цепочку eslint-config-next > typescript-eslint > @typescript-eslint/utils; своего advisory нет; dev-only, в сборку не попадает. Disposition как у корня. | Qloxz (владелец релиза) |
| via:eslint-config-next | eslint-config-next | moderate | accepted | Следствие GHSA-g3hv-75wg-m249 (прямая dev-зависимость eslint-config-next тянет затронутые пакеты); своего advisory нет; dev-only, в сборку не попадает. Disposition как у корня. | Qloxz (владелец релиза) |
| GHSA-g3hv-75wg-m249 | minimatch | moderate | accepted | ReDoS (globparts amplification, CWE-405) в minimatch >=7.0.0 <11.0.1 внутри dev-цепочки eslint-config-next > typescript-eslint > @typescript-eslint/typescript-estree; в production audit нет, в сборку не попадает, обрабатывает только шаблоны из репозитория. npm предлагает eslint-config-next@15.5.29 (semver-major понижение), не применено. Пересмотреть при обновлении ESLint. | Qloxz (владелец релиза) |
| via:typescript-eslint | typescript-eslint | moderate | accepted | Следствие GHSA-g3hv-75wg-m249 через цепочку eslint-config-next > typescript-eslint; своего advisory нет; dev-only, в сборку не попадает. Disposition как у корня. | Qloxz (владелец релиза) |

## Lockfile ledger

- `package.json` и `package-lock.json` в плане 20-10 не менялись; `npm audit fix` не запускался, пакеты не устанавливались. Sha256 обоих файлов записаны в `20-DEPENDENCY-AUDIT.json` (`lockfileSha256`, `packageJsonSha256`), и `--verify` сравнивает их с рабочим деревом.
- Phase 21-02 (SEC-08, 2026-11-09): `next` и `eslint-config-next` переведены на 16.4.5 отдельным коммитом 255ec54; поэтому снимок сделан заново (`--capture` на 92b8405). Production по-прежнему чист.
- Единственное предложение `npm audit` на снимке 59f90d2 — мажорные понижения `eslint@4.0.0` и `eslint-config-next@0.2.4`. На снимке 92b8405 — `eslint-config-next@15.5.29`. Это не исправление, а откат версий инструмента на годы назад; не применено.
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
| 8 dev-находок moderate | accepted dev-only | Production audit чист; dev-цепочка ESLint, безопасного обновления нет. | SEC20-13 |
| HSTS и `upgrade-insecure-requests` на опубликованном HTTPS | LIMITATION (D-14) | Не проверялось; HTTP/LAN этого не доказывает. | SEC20-14 |
| Оракул одобрения email редактора | accepted (Phase 16) | Анонимная RPC подтверждает, одобрен ли email. | SEC20-01 |
