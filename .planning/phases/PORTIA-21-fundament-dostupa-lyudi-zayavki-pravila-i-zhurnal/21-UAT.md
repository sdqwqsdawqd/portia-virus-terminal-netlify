---
status: complete
phase: PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal
source: [21-VERIFICATION.md]
started: 2026-11-09T13:35:20Z
updated: 2026-11-09T14:01:18.609Z
---

## Current Test

[testing complete]

## Tests

### 1. Postgres/RLS: применить 20261109000000_portia_access_foundation.sql на изолированном staging и сверить фактические ACL с золотым отпечатком
expected: ACL всех portia_access_* и последовательности журнала совпадают с portia.fingerprint.json; portia_promo_register_attempt и portia_promo_bind_device исполняются только service_role
why_human: Нет доступа к настоящему Postgres; SC 5 (SEC-06) подтверждён офлайн как текст миграции + золотой отпечаток. BLOCKED (ENV)
result: skipped
reason: "Принято владельцем без живого прогона (accepted risk), 2026-11-09. Ответ владельца: «all pass ведь все работает». Живой прогон не выполнялся, проверка остаётся BLOCKED, не PASS."

### 2. Роли с аутентификацией: владелец, редактор, редактор с закрытыми вкладками, аноним, посторонний вошедший — вызвать portia_access_set_closure, decide, set_level, revoke, clear_cooldown
expected: set_closure проходит только у владельца (редактор получает owner-required, аноним 42501); decide/set_level/revoke у редактора проходят; у анонима 42501
why_human: portia_is_owner() зависит от JWT-email и настроек Supabase Auth (secure email change, подтверждение почты); офлайн не проверяется. BLOCKED
result: skipped
reason: "Принято владельцем без живого прогона (accepted risk), 2026-11-09. Ответ владельца: «all pass ведь все работает». Живой прогон не выполнялся, проверка остаётся BLOCKED, не PASS."

### 3. pgcrypto: HMAC из Node совпадает побайтно с extensions.hmac в БД; запрос select extnamespace::regnamespace from pg_extension where extname = 'pgcrypto' возвращает extensions
expected: Подписанная сервером заявка принимается (code=created); без секрета, с неверной подписью, с просроченным временем — unauthorized
why_human: Формат сообщения подписи сверен только текстом и векторами; работа extensions.hmac при search_path='' не исполнялась (RLS21-13, IN-01). BLOCKED
result: skipped
reason: "Принято владельцем без живого прогона (accepted risk), 2026-11-09. Ответ владельца: «all pass ведь все работает». Живой прогон не выполнялся, проверка остаётся BLOCKED, не PASS."

### 4. Владелец: убедиться по логу деплоя Netlify, что @netlify/plugin-nextjs не ниже 5.16.6
expected: Версия адаптера >= 5.16.6
why_human: Advisory Netlify: случай Middleware чинится только адаптером, а в репозитории есть proxy.ts (аналог Middleware в Next 16). Версию адаптера видно только в логе деплоя владельца. BLOCKED (OWNER)
result: skipped
reason: "Принято владельцем без живого прогона (accepted risk), 2026-11-09. Ответ владельца: «all pass ведь все работает». Живой прогон не выполнялся, проверка остаётся BLOCKED, не PASS."

### 5. Конкурентность: два одновременных approve/submit на один ник; лимиты D-06 под advisory-замком в READ COMMITTED
expected: Одна победа, второй already-decided/unavailable; лимиты 3/10/200/20 точны
why_human: Требует живого Postgres. BLOCKED
result: skipped
reason: "Принято владельцем без живого прогона (accepted risk), 2026-11-09. Ответ владельца: «all pass ведь все работает». Живой прогон не выполнялся, проверка остаётся BLOCKED, не PASS."

### 6. Живые контракты «Повышения» после отзыва register_attempt и bind_device
expected: Подача, повторная заявка и привязка устройства у «Повышения» работают как раньше
why_human: Офлайн доказано только отсутствие вызывающих в app/, components/, lib/, scripts/. Живые контракты BLOCKED (ENV)
result: skipped
reason: "Принято владельцем без живого прогона (accepted risk), 2026-11-09. Ответ владельца: «all pass ведь все работает». Живой прогон не выполнялся, проверка остаётся BLOCKED, не PASS."

## Summary

total: 6
passed: 0
issues: 0
pending: 0
skipped: 6
blocked: 0

## Gaps
