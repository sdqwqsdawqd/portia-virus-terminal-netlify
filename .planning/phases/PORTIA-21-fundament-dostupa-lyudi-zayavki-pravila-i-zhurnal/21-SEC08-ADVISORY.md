# 21-SEC08: Netlify advisory 2026-11-03 и пакеты next / eslint-config-next 16.4.5

## Источник

- URL: https://www.netlify.com/changelog/2026-11-03-nextjs-security-vulnerabilities/
- Дата чтения: 2026-11-09 (HTTP 200, без редиректа, страница получена напрямую через curl и разобрана до текста).
- Статус: ПРОЧИТАНА целиком (не пересказ STACK.md). Заголовок: «Security Update: Multiple vulnerabilities in Next.js (November 2026)».
- Исправленные версии по странице: 16.4.5 (ветка 16.x) и 15.5.29 (ветка 15.x). Версия 16.4.5 из требования SEC-08 подтверждена.

## Исправления в 16.4.5

Семь уязвимостей, все severity Medium. Столбец «Netlify» - вывод самой страницы Netlify.

| GHSA | CVE | Суть | Netlify |
|------|-----|------|---------|
| GHSA-vc7v-qv4w-wrv8 | CVE-2026-119351 | Утечка кэша между значениями root params во вложенных `use cache` | затронут при условиях (16.2+, Cache Components) |
| GHSA-7qx7-33qx-rqx2 | CVE-2026-119347 | Обход запрета SVG в оптимизаторе изображений | не затронут (Netlify Image CDN) |
| GHSA-vvgp-ww4w-46vf | CVE-2026-119350 | Отравление кэша общих fallback-оболочек (shared shells) через placeholder route params; один запрос может дать закэшированный 404 на валидных страницах | затронут при условиях (16.4+, Cache Components) |
| GHSA-mfr8-8qww-v76h | CVE-2026-119790 | Раскрытие между root params при вызове `use cache` через `unstable_cache()` | не затронут |
| GHSA-f3mh-rxg3-f5g2 | CVE-2026-119346 | Раскрытие HttpOnly cookie через внутренний заголовок ответа в Edge runtime; случай Middleware чинится только адаптером | затронут (Edge handlers, cookies в Middleware) |
| GHSA-rhh4-g77r-r9qj | CVE-2026-119349 | Межпользовательское раскрытие/отравление кэша в `use cache` с бинарными аргументами | затронут при условиях |
| GHSA-pc58-hwjq-p385 | CVE-2026-119348 | Инъекция ответа между клиентами в self-hosted | не затронут (Netlify сам формирует ответы) |

Примечание для Portia: затронутость конкретными условиями (Cache Components, `use cache`, Edge runtime) для этого репозитория здесь не оценивалась; обновление требуется по рекомендации Netlify независимо от оценки.

## Адаптер Netlify

- Минимальная версия: `@netlify/plugin-nextjs` 5.16.6. По странице адаптер ставится автоматически, редеплой подтягивает его; вручную обновлять нужно только при закреплённой версии. Одного апгрейда Next.js недостаточно для случая Middleware.
- Netlify также напоминает: новый деплой очищает кэш предыдущих деплоев в том же контексте деплоя; branch deploys и Deploy Previews чистятся отдельно.
- Подтвердить версию адаптера можно только в логе деплоя владельца: BLOCKED (OWNER) локально, не PASS.

## Реестр npm

Источник: `npm view` (npm 11.19.0, машинный CLI), только чтение, 2026-11-09.

| Пакет | Версия | Время публикации | Хост tarball |
|-------|--------|------------------|--------------|
| next | 16.4.5 | 2026-11-03T18:01:54Z (предыдущая 16.4.2: 2026-10-15) | registry.npmjs.org |
| eslint-config-next | 16.4.5 | 2026-11-03T17:52:34Z (предыдущая 16.4.2: 2026-10-15) | registry.npmjs.org |

- next@16.4.5 integrity: `sha512-rmdfsWosjTUO+6R0S3KokoIk6Kj0sWDRTe86tZHdqaWH/oXq/udX3/4xb+YQi7aWbyEFoglDU54kaifLCdXbBw==`
- next@16.4.5 tarball: https://registry.npmjs.org/next/-/next-16.4.5.tgz
- next maintainers: vercel-release-bot, matt.straka, matheuss, zeit-bot
- eslint-config-next@16.4.5 integrity: `sha512-mvh39zYLoNjpT5tVmf8xZu7i5lEOb5jN5cW6qD9OpeCp4GEEOeYta0Z2XyKiD0pYdlvm5/Td6Bi890maPRlIjg==`
- eslint-config-next@16.4.5 tarball: https://registry.npmjs.org/eslint-config-next/-/eslint-config-next-16.4.5.tgz
- eslint-config-next maintainers: timneutkens, timer, vercel-release-bot

Обе версии опубликованы 2026-11-03, то есть в день advisory; это совпадает с датой, названной Netlify.

## Легитимность пакетов

Таблицы аудита в RESEARCH.md фазы нет, поэтому оба пакета считаются [ASSUMED] (не проверены независимо), хотя имя, издатель (Vercel), хост tarball (registry.npmjs.org) и дата выглядят ожидаемо. До установки нужно явное подтверждение владельца на шаге Task 2 (blocking-human): npmjs.com/package/next/v/16.4.5 и npmjs.com/package/eslint-config-next/v/16.4.5. Установка не выполнялась.
