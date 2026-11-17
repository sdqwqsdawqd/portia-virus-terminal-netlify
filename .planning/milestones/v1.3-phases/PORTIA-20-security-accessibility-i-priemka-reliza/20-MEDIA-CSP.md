# 20-MEDIA-CSP: внешние media, report-only кандидат CSP, граница LAN/HTTPS

Plan: 20-08. Requirements: STAB-MEDIA-07, STAB-SEC-03. Решения: D-05, D-06, D-07, D-08, D-14.
Секреты, токены, ref проекта Supabase, id документов и полные URL в этот файл не записываются; только хосты и директивы.

## 1. Что сделано и чего нет

| Пункт | Статус |
|---|---|
| Действующая `Content-Security-Policy` | Не менялась, остаётся enforced (`next.config.ts`). |
| `Content-Security-Policy-Report-Only` | Добавлен кандидат рядом с enforced. Сам ничего не блокирует. |
| `img-src https:` | Сохранён и в enforced, и в кандидате (D-06). Список хостов ниже только инвентарь, не allowlist. |
| Перевод кандидата в enforcement | НЕ выполнен. Требует PC/phone UAT по D-05, которого нет. Статус: BLOCKED. |
| Физический PC/phone по LAN | BLOCKED: в этом плане не проводился (нужен владелец и устройства). |
| Опубликованный HTTPS (HSTS, upgrade) | LIMITATION/BLOCKED, см. раздел 5. |

## 2. Кандидат против enforced

Кандидат сужает только то, что не нужно ни одному одобренному сценарию, и не расширяет enforced ни в одной директиве (проверяется `lib/security-headers.test.ts`).

| Директива | Enforced | Кандидат (Report-Only) | Почему |
|---|---|---|---|
| `img-src` | `'self' data: blob: https:` | то же | D-06 |
| `frame-src` | docs.google.com, sdqwqsdawqd.github.io, www.youtube.com, www.youtube-nocookie.com | то же | одобренные документы и видео |
| `connect-src` | `'self' https: wss:` (+ `ws:` в dev) | `'self'` (+ `ws:` в dev) | браузерный код не ходит на сторонние хосты (запрос к users.roblox.com выполняет сервер) |
| `font-src` | `'self' data:` | `'self'` | шрифты отдаёт сам Next |
| `media-src` | `'self' data: blob: https:` | `'self' https:` | `<audio>`/`<video>` в приложении нет |
| `manifest-src` | (через default-src) | `'self'` | явно |
| `script-src`, `style-src` | `'unsafe-inline'` | то же | ослабление требует nonce/динамического рендера, вне этого плана |
| `upgrade-insecure-requests` | в production | отсутствует | в report-only политике директива не допускается и игнорируется |

Сбор нарушений: без отдельной конечной точки (новая сетевая поверхность не вводилась). Нарушения читаются из события `securitypolicyviolation`, которое фикстура `tests/e2e/fixtures/diagnostics.ts` уже превращает в запись `csp`; любая неожиданная запись валит тест.

## 3. Инвентарь внешних media-хостов (из кода, без секретов)

| Хост | Назначение | Директива | Одобренный сценарий |
|---|---|---|---|
| docs.google.com | окно «Таблица» (iframe) | `frame-src` | да, проверено (фрейм отвечает локально) |
| sdqwqsdawqd.github.io | окно «Устав» (iframe) | `frame-src` | да, проверено (то же) |
| www.youtube.com, www.youtube-nocookie.com | видеоблоки (iframe); youtu.be и m.youtube.com принимаются только как ввод и нормализуются в id | `frame-src` | зависит от данных: BLOCKED (DATA), блоков с видео на цели нет |
| media.giphy.com, i.giphy.com, static*.klipy.com, klipy.com | GIF в досье | `img-src https:` | зависит от данных: BLOCKED (DATA) |
| thumbnails.roblox.com | аватары Roblox | `img-src https:` | зависит от данных сотрудников |
| users.roblox.com | запрос сервера за id пользователя | не браузер, CSP не затрагивает | n/a |
| www.roblox.com | ссылка профиля (переход, не загрузка ресурса) | не CSP | n/a |
| собственный Supabase Storage (публичные загрузки) | фото/обложки (`/api/uploads`) | `img-src https:` | зависит от данных |
| любой иной `https://` хост, принятый `mediaSource` (`lib/media-url.ts`) | пользовательские ссылки на изображения | `img-src https:` | остаётся разрешён по D-06 |

## 4. Наблюдение report-only и disposition нарушений

Окружение: локальная production-сборка `127.0.0.1` по HTTP (`PORTIA_E2E_ALLOW_HTTP=1`), Node 22.13.1, Playwright 1.64.1. Кандидат наблюдается в Chromium и Firefox. WebKit пишет про report-only без `report-to` («the policy will have no effect»), то есть кандидат там ничего не наблюдает.

| Прогон | Что покрыто | Нарушений кандидата |
|---|---|---|
| `media-states.spec.ts` (chromium-desktop, chromium-dpr125, firefox-desktop, chromium-phone) | 404 и «вечно ждёт» портрет, смена записи A-B-A, заглушка при отказе хоста, фреймы «Устав» и «Таблица», оба заголовка | 0 |
| `visitor`, `app-states`, `desktop-windows`, `media-offscreen`, `media-states` (chromium-desktop + firefox-desktop) | рабочий стол, окна, состояния приложений | 0 записей `csp`; 80 тестов пройдено, 3 упали по причинам, не связанным с CSP (раздел 7) |

| # | directive | origin | path | disposition |
|---|---|---|---|---|
| (нет) | | | | Нарушений report-only на одобренных документах, видео-хостах и изображениях не наблюдалось, объяснять нечего. |

Оговорка: сценарии `docs/video/images` зависящие от данных (YouTube-блоки, GIF-хосты, Roblox-аватары на цели) не имели данных на цели, поэтому «0 нарушений» для них НЕ доказано; это BLOCKED (DATA), не PASS. Для документов (`frame-src`) и подменённых внешних изображений (`img-src https:`) нулевой результат получен.

Tightening запрещён до D-05 PC/phone UAT, независимо от нулевого результата выше.

## 5. Граница LAN HTTP и опубликованного HTTPS (D-08, D-14)

- Локальный прогон и физический LAN идут по обычному HTTP. Браузер игнорирует `Strict-Transport-Security` на HTTP; `upgrade-insecure-requests` для локального E2E-сервера отключён намеренно (`PORTIA_E2E_ALLOW_HTTP=1`, и не при Netlify/CONTEXT).
- Тест `lib/security-headers.test.ts` доказывает конфигурацию: `upgrade-insecure-requests` остаётся в production и в любой сборке Netlify, HSTS присутствует с точным значением.
- Доказательства работы HSTS и upgrade на опубликованном сайте: LIMITATION/BLOCKED. D-14 не требует проверки production, допустимого evidence с опубликованного HTTPS нет, поэтому эти ячейки не засчитаны как PASS.

## 6. Заглушка внешнего изображения (D-07) и CR-01

- `PortiaImage` (`components/portia-desktop-media.tsx`) уже при отказе рисует статичную заглушку («Изображение недоступно»), подпись остаётся; в `app/portia.css` у заглушки нет анимации. Компонент изменений не потребовал; поведение зафиксировано тестами: тот же `boundingBox` при loading и failed, нулевое число `getAnimations()`, имя и подпись на месте, нет неожиданных console/CSP событий.
- Phase 19 CR-01 (скрытые lazy media): НЕ закрыт этим планом. 19-15 исправил таймер для свёрнутых «Устав» и портрета (`media-offscreen.spec.ts`), но случай обложек свёрнутого раздела «Справочник» остаётся со статусом unknown до данных 19-19. В `media-states.spec.ts` он записан как явный skip с пометкой `BLOCKED (inherited gap, Phase 19 CR-01)`.

## 7. Вне области этого плана (deferred)

См. `deferred-items.md` в каталоге фазы: нестабильный webkit-phone тест 15 с и три падения других спеков из-за диагностик изображений, не связанных с CSP.
