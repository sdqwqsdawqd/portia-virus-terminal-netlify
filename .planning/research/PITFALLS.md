# Domain Pitfalls: стабилизация PORTIA OS v1.3

**Domain:** стабилизация существующего Next.js 16 + React 19 + Supabase + Netlify-приложения без смены визуальной идентичности
**Researched:** 2026-10-29
**Overall confidence:** HIGH для репозиторных рисков; MEDIUM для рекомендуемого разбиения будущих фаз

## Исходная позиция

PORTIA OS не нужно проектировать заново. Рабочий стол, окна, приложения, редактор, роли, ревизии, Supabase/RLS-функции, CDN-кэш, мобильная компоновка и большая часть «Повышения» уже реализованы. В v1.3 требуется сохранить эти подтверждённые возможности и закрыть разрыв между «код существует» и «поведение доказано в реальном браузере, на изолированной базе и принято владельцем».

Главная ловушка — считать зелёные статические проверки равными готовности релиза. На 2026-10-29 `npm test` даёт 583 успешных теста из 584, TypeScript, build, lint и production dependency audit проходят, однако единственный live-тест пропущен, отдельный Supabase staging не прогнан, SQL после последних изменений не подтверждён как развёрнутый, Playwright-suite и утверждённые visual baselines отсутствуют, а итоговая PC/phone UAT владельца не завершена. Поэтому отметки `[x]` в архивных требованиях v1.2 означают реализованное/сопоставленное поведение, но не заменяют недостающие доказательства Phase 14.

## Границы исследования

### Сохранять как уже реализованное

- Текущий художественный образ PORTIA OS: тёмно-бирюзовая система, акценты, кириллические шрифты, PNG-паук, паутина, Вивьян, существующие окна и приложения.
- Уже принятые продуктовые решения: «РЕВИЗИЯ N», отсутствие desktop-виджета «Сводка», ровно 34 места сотрудников, ручное решение проверяющего, внешняя передача доказательств, ограниченная история результатов.
- Реализованные серверные свойства «Повышения»: отдельные потоки заданий и квалификаций, серверные сроки, атомарные RPC/claim/CAS-механизмы, закрытые ответы, trusted-вкладка `promo`, HttpOnly browser token и rate limiting. Их не переписывать до live-проверки; сначала доказать фактический deployed contract.
- Принятые ограничения: browser/device binding — защита от злоупотреблений, а не аппаратная аттестация; cross-origin iframe не передаёт Ctrl+wheel родителю; отдельные ранее принятые риски доступа остаются вне v1.3, пока требования явно не изменены.

### Не расширять v1.3 без нового решения владельца

- Не добавлять общую новую «систему приложений» как продуктовый редизайн. Допустим только внутренний app registry/контракт, необходимый для декомпозиции и тестирования без изменения UX.
- Не возвращать запрещённые или отклонённые идеи: desktop-«Сводку», SVG-паука, общую расстановку ярлыков, Netlify Blobs, автоматический проходной процент, показ конкретных ошибок теста, загрузку доказательств на сайт.
- Не превращать CSP, dependency cleanup или архитектурную декомпозицию в скрытый framework migration, дизайн-редизайн или массовое обновление пакетов.
- Не считать UA, Client Hints, cookie или fingerprint доказательством физического устройства или личности.

## Критические pitfalls

### 1. Стабилизационная фаза снова превращается во «всё сразу»

**Что идёт не так:** в одну фазу попадают Promotion, окна, ярлыки, spider motion, помощник, поиск, загрузки, CSP, SQL и зависимости. Изменения влияют друг на друга, а владелец не может принять результат одним понятным checkpoint.

**Почему это реально здесь:** Phase 14 начиналась как «Повышение», но накопила desktop motion, shortcuts, assistant colour, global search, upload caching, CSP и SQL hardening. Последние 20 коммитов многократно меняли одни и те же CSS/desktop/wallpaper/spider-файлы.

**Последствия:** повторный patch loop, размытая причинность регрессий, слишком широкая UAT, GSD summaries отстают от кода, «почти готово» не закрывается.

**Ранние признаки:**

- план одновременно затрагивает базу, глобальный CSS, motion и бизнес-процесс;
- исправление в одной области добавляется в текущую фазу только потому, что «мы уже рядом»;
- acceptance checklist растёт после начала реализации;
- один owner-review должен оценить десятки несвязанных сценариев.

**Предотвращение:** после Phase 14 разделить recovery/baseline, design contract, staging/SQL, architecture seams, desktop motion, Promotion proof, app/editor/media stabilization и release verification. Каждая фаза должна иметь собственный запрет на соседние категории изменений и отдельный доказательный пакет.

### 2. Архив v1.2 или подтверждённая история перезаписывается как будто это текущий план

**Что идёт не так:** `v1.2-INCOMPLETE-*` и `v1.2-incomplete-phases/` редактируются для отражения v1.3, либо старые research/summary-артефакты заменяются новыми без архивной границы. Теряется честная запись о том, что было реализовано, но не доказано.

**Последствия:** невозможно отличить прежние обещания от новых требований; статусы 49/49 выглядят как финальная приёмка; roadmap может повторно объявить незакрытые гарантии закрытыми.

**Ранние признаки:**

- diff меняет файлы с `INCOMPLETE` или каталог `v1.2-incomplete-*` во время v1.3;
- старый requirement ID переопределяется вместо нового carried-forward requirement;
- новый summary ссылается на прошлую UAT как на пройденную, хотя ledger имел 0 полностью принятых сценариев.

**Предотвращение:** архивы сделать read-only по процессу; v1.3 получает новые IDs и явные ссылки `carried from Phase 14`. Разрешить только исправление фактической архивной опечатки отдельным owner-approved планом. Перед каждой фазой проверять, что write-set не содержит `.planning/milestones/v1.2-*` и архивных phase directories.

### 3. Зелёные unit/build/lint проверки создают ложную уверенность

**Что идёт не так:** deterministic tests подтверждают функции и статические контракты, но не доказывают браузерную интеграцию, race conditions, реальные RLS/grants, применённый SQL, DPR 1.25 drag, touch navigation или owner-accepted aesthetics.

**Доказательство:** 583/584 тестов проходят, но live test пропущен; forensic report прямо фиксирует отсутствие isolated mutating Supabase run, authenticated reviewer proof и owner PC/phone UAT. Playwright пока является доступным инструментом/навыком, а не committed project suite.

**Ранние признаки:**

- фаза закрывается списком `npm test`, `tsc`, `build`, `lint` без trace/screenshots/live ledger;
- skipped live test не считается блокером;
- мок Supabase используется как доказательство RLS или concurrency;
- «console clean» проверено только на одной публичной странице.

**Предотвращение:** установить evidence matrix по слоям: deterministic → API contract → live staging → Playwright role/device flows → visual/a11y/console → owner UAT. Каждый requirement указывает минимально допустимый слой доказательства; server concurrency и RLS не могут закрываться mock-тестом, motion quality — unit-тестом, mobile UX — desktop viewport-only тестом.

### 4. Visual regression фиксирует неутверждённый дефект как истину

**Что идёт не так:** первые автоматически снятые screenshots принимаются как baseline без владельца. После этого visual tests защищают случайный spider pose, чрезмерную яркость Вивьян, дефект handoff ярлыка или неверную геометрию окна.

**Почему это реально здесь:** ранние версии motion неоднократно отклонялись владельцем; последние исправления front legs, random spider start, assistant brightness и shortcut completion ещё не образуют утверждённый design/motion contract.

**Ранние признаки:**

- baseline-коммит создан до Figma/owner sign-off;
- обновление snapshots делается массовым флагом после каждого CSS diff;
- нет таблицы state/viewport/accent/motion-mode;
- анимированные screenshots отличаются между запусками или маскируют главный объект.

**Предотвращение:** сначала Figma UI/motion contract и owner approval, затем deterministic capture states. Для motion использовать утверждённые key states/geometry и отдельные поведенческие проверки, а не случайный кадр. Snapshot update должен быть самостоятельным reviewable change с причиной для каждого файла; непроверенные snapshots маркировать `candidate`, не release baseline.

### 5. Browser suite становится flaky и перестаёт быть release gate

**Что идёт не так:** тесты зависят от реальной анимации, 10-секундного polling, Google Sheet/Roblox/network, случайного spider start, текущих данных базы, shared user state и arbitrary sleeps. Ретраи скрывают дефект вместо диагностики.

**Ранние признаки:**

- `waitForTimeout` используется вместо наблюдаемого состояния;
- один и тот же тест проходит только со второго/третьего retry;
- тесты меняют одну общую учётную запись/запрос параллельно;
- snapshot снимается во время перехода или после непредсказуемого network idle;
- локальный Chromium зелёный, phone/touch или другой browser project красный.

**Предотвращение:** фиксированные clock/random seed/data fixtures; animation-off или explicit test clock для функциональных тестов; отдельный motion project с управляемой временной шкалой; уникальный namespace на worker; API-created staging fixtures; ожидание DOM/RPC-состояний; trace/video/console/network artifacts на первом падении; retries не меняют итоговый статус гейта. Внешние Google/Roblox вызовы тестировать contract fixtures отдельно от малого числа явно помеченных live smoke checks.

### 6. Mutating fixtures попадают в production Supabase

**Что идёт не так:** live RLS/concurrency проверка запускается против production URL/service role и создаёт/забирает/закрывает реальные запросы, удаляет payload, расходует rate limits или меняет browser binding пользователя.

**Последствия:** повреждение рабочих очередей и истории, утечка банков вопросов, ложные уведомления, необратимая cleanup-транзакция.

**Ранние признаки:**

- staging и production используют одинаковый project ref;
- service-role secret доступен обычному Playwright web process;
- fixture nickname совпадает с реальным участником из `Portia!A61:E85`;
- teardown — best effort, а не проверяемая часть run;
- нет environment guard, уникального test prefix и deny-check production host.

**Предотвращение:** отдельный Supabase staging project с отдельными keys, storage и auth users; fail-closed guard по exact project ref; fixtures только с уникальным run ID и synthetic authoritative-sheet fixture; service role используется только setup/teardown process, никогда browser context; teardown проверяет отсутствие остатков, но не заменяет TTL cleanup. Production допускает только read-only smoke после отдельного разрешения владельца.

### 7. Репозиторный SQL, staging SQL и production SQL расходятся

**Что идёт не так:** код ожидает новые RPC/signatures/grants/search paths, но владелец применил более ранний setup-файл. Или ручной SQL в dashboard не отражён канонической миграцией.

**Доказательство:** commit `cc48ec8` изменил `portia_setup.sql` и `phase12_apply.sql` после более раннего owner run; owner-run Phase 14 file не содержит эти helper redefinitions. Аудит отдельно предупреждает, что усиления начнут действовать только после применения актуального SQL.

**Ранние признаки:**

- API fallback обходит отсутствующую RPC;
- function inventory/signature на staging не совпадает с manifest;
- setup и incremental migration определяют одну функцию по-разному;
- SQL считается «готовым», потому что файл изменён в Git;
- owner rollout не имеет checksum/version evidence.

**Предотвращение:** выбрать один канонический migration chain; генерировать/хранить schema contract manifest (functions, arguments, security definer, search_path, grants, RLS policies); применять сначала к пустому staging, затем к staging upgrade path; сравнивать live inventory с manifest. Production rollout — отдельный owner gate с preflight, backup/rollback note, exact migration checksum и post-deploy probes.

### 8. Декомпозиция giant components незаметно становится переписыванием поведения

**Что идёт не так:** `portia-desktop.tsx` (2,317 строк) и `portia-editor.tsx` (3,033 строки) делят по визуальным блокам, одновременно меняя state ownership, effects, z-index, pointer handling, persistence, role checks и responsive CSS.

**Последствия:** окна теряют размеры/фокус, unsaved edits стираются при переключении, mobile panel ломается, boot/motion запускаются повторно, права trusted-вкладок просачиваются в client-only logic.

**Ранние признаки:**

- refactor plan обещает «заодно упростить UX»;
- большой diff одновременно перемещает JSX, меняет CSS и бизнес-условия;
- extracted component получает копии state/effects вместо явного interface;
- старые selectors/test IDs исчезают до parity suite;
- «ничего не изменилось» подтверждается только build/test.

**Предотвращение:** до refactor создать characterization suite и component-boundary map; выделять сначала pure helpers/types, затем один домен за план; сохранять DOM semantics, CSS classes, app IDs, persisted keys и API shape. Для каждого extraction — before/after Playwright parity на desktop+phone и visual diff по утверждённому baseline. Новые UI-примитивы вводить через один pilot consumer, не массовой заменой.

### 9. Motion механически «правильный», но визуально плохой или дорогой

**Что идёт не так:** тесты подтверждают наличие transform/keyframes, но движение остаётся топорным, ярким, мерцающим, физически неверным или нагружает main thread. В противоположную сторону, агрессивная оптимизация убирает характер PORTIA OS.

**Репозиторный контекст:** gel wallpaper уже пришлось переносить на отдельный transform/composite layer из-за перерисовки SVG; spider gait и assistant brightness неоднократно исправлялись по owner feedback. Настройка `html[data-motion]` имеет системный/вкл/выкл режимы и должна сохраняться.

**Ранние признаки:**

- FPS/profile не снимается на длинной desktop-сессии;
- паук телепортируется или стартует одинаково/неестественно;
- точки паутины остаются при скрытом пауке;
- `prefers-reduced-motion` или `data-motion="off"` всё ещё оставляет движение;
- visual test проходит при frozen frame, но owner отклоняет динамику;
- анимация меняет layout/top-left вместо transform/opacity без необходимости.

**Предотвращение:** Figma motion contract должен фиксировать траектории, длительности, easing, opacity/brightness, handoff states и off/reduced behavior. Проверять на реальном ПК, DPR 1.25, нескольких размерах окон и после длительной работы. Использовать compositor-friendly свойства, ограничивать одновременно активные эффекты, профилировать long tasks/paint/layout; качество движения принимает владелец, performance принимает измеримый budget.

### 10. Device binding и desktop anti-cheat описываются сильнее, чем обеспечивают браузеры

**Что идёт не так:** HttpOnly token + device signal + rate limit называют «привязкой к устройству» или защитой от обхода. На деле cookie можно очистить, профиль клонировать, а целевой атакующий может менять client signals.

**Ранние признаки:** требования используют слова «невозможно обойти», «физическое устройство», «гарантирует один компьютер»;
QA не проверяет cookie reset/profile clone/VPN как residual-risk scenarios;
public copy обещает безопасность, которой сервер не может доказать.

**Предотвращение:** формулировать контракт как abuse resistance/browser-session binding. Сервер остаётся authoritative для lease, deadlines, CAS, attempts и rate limits; device signal — только один вход риска. Документировать recovery/false-positive path и не превращать fingerprint в идентификатор личности.

### 11. UA spoofing ломает границу desktop/mobile квалификации

**Что идёт не так:** initial mode определяется `sec-ch-ua-mobile`/User-Agent, затем сервер его замораживает. Пользователь может начать попытку с подменённым mobile UA и избежать desktop focus/visibility rule либо получить неверный UX на гибридном устройстве.

**Последствия:** QUAL-08/QUAL-09 выглядят как security boundary, хотя это policy based on spoofable input.

**Ранние признаки:** mobile mode выдаёт дополнительные права или ослабляет серверную целостность; Playwright проверяет только штатные device descriptors; требования называют классификацию достоверной.

**Предотвращение:** не использовать UA mode для доступа к ответам, банкам, reviewer API или серверным срокам. Считать focus-loss rule сдерживающей UX-политикой, не защитой от мотивированного обхода. Добавить spoof matrix (desktop viewport + mobile UA, mobile viewport + desktop UA, touch laptop); сервер должен сохранять целостность во всех комбинациях, а документация — явно фиксировать residual risk.

### 12. CSP tightening ломает boot theme, Next runtime или внешние медиа

**Что идёт не так:** `unsafe-inline` удаляют одним шагом, не инвентаризировав theme boot, Next scripts/styles и внешние изображения. Или nonce добавлен в один слой, но не проходит через SSR/cache/CDN.

**Ранние признаки:** flash of wrong theme, hydration errors, CSP console violations, пропавшие внешние изображения, policy различается local/Netlify, report-only показывает новые blocked origins после каждой навигации.

**Предотвращение:** CSP — отдельная миграция: inventory → report-only telemetry → nonce/hash propagation for boot script → media proxy/allowlist decision → enforce. Проверить public, owner/editor auth, embedded documents, uploads, every app/media state и Netlify headers. Не смешивать с giant-component refactor или dependency sweep. Broad `https:` media нельзя просто удалить до решения для уже существующих content URLs.

### 13. Mobile регрессии скрыты desktop-first baseline

**Что идёт не так:** desktop windows, hover, pointer drag и symmetric geometry проходят, а на телефоне ломаются modal/fullscreen layout, touch targets, keyboard/viewport, scroll locking, editor panel и qualification navigation.

**Репозиторный контекст:** аудит говорит, что текущая mobile layout рабочая; значит v1.3 должна сохранить её. В редакторе уже есть повторяющиеся `(max-width: 900px)` правила и принятый риск их переделки.

**Ранние признаки:** mobile проверяется только viewport resize в desktop browser; нет touch/soft-keyboard сценариев; изменения global CSS или window primitives не имеют phone diff; fixed element перекрывает действие; появляется horizontal overflow.

**Предотвращение:** mobile — отдельная acceptance lane, а не побочный viewport. Минимум: narrow touch project, portrait screenshots, keyboard/open-input checks, scroll/overflow assertions, app/editor navigation, Promotion participant flow. Повторяющиеся media queries не «чистить» без baseline и конкретной regression requirement.

### 14. Пользовательские dirty files поглощаются чужой задачей

**Что идёт не так:** modified `package.json`, `package-lock.json`, planning lock/HANDOFF и untracked quick/UI artifacts принимаются за часть новой фазы, форматируются, удаляются или коммитятся вместе с ней.

**Доказательство:** forensic report фиксирует неуправляемые изменения package/planning files; `motion` добавлен, хотя product code его ещё не использует. Аудит рекомендует dependency/lockfile update отдельной задачей.

**Ранние признаки:** phase plan не содержит preflight inventory; lockfile меняется после unrelated install; cleanup удаляет untracked artifacts; summary не указывает provenance существующих изменений.

**Предотвращение:** в recovery phase составить ownership ledger: preserve/adopt/archive/ignore, без reset/checkout/delete. Каждый план задаёт allowed write-set; pre/post diff проверяет, что пользовательские файлы не изменены. Dependency task начинается только после явного решения по текущим package edits и использует отдельный review.

### 15. GSD-артефакты снова расходятся с кодом и доказательствами

**Что идёт не так:** implementation commits существуют, но summaries/verification/state не закрыты; требования показывают complete, хотя proof blocked. Автоматический validator дополнительно даёт ложный missing-directory warning из-за project-code-prefixed phase path.

**Доказательство:** отсутствуют `14-14-SUMMARY.md` и `14-19-SUMMARY.md`, verification остаётся `preflight_blocked`, UAT ledger не принят, при этом v1.2 requirements показывают 49/49 complete.

**Ранние признаки:** plan отмечен выполненным без summary; summary ссылается на будущую UAT; `STATE.md`, ROADMAP и verification дают разные counts; false-positive validator warning либо игнорируется весь, либо ошибочно трактуется как потеря данных.

**Предотвращение:** gate closure должен атомарно обновлять requirement traceability, plan summary, phase verification, UAT ledger и state. Статусы разделить на `implemented`, `automated-proof`, `live-proof`, `owner-accepted`. Validator anomaly зафиксировать как known tooling exception с ручной проверкой exact path; не отключать остальные consistency checks. Ни одна фаза не считается закрытой при missing summary или unresolved high-severity evidence item.

## Умеренные pitfalls

### 16. Promotion переписывают вместо доказательства deployed workflow

**Что идёт не так:** из-за blocked Phase 14 команда снова меняет API/UI, хотя основная проблема — отсутствующие staging fixtures, reviewer auth и owner UAT.

**Предотвращение:** первая Promotion-фаза v1.3 должна быть proof/remediation-only: inventory deployed RPC, run concurrency/RLS matrix, execute participant/reviewer flows, исправлять только воспроизведённые несоответствия. Сохранить разделение qualification → отдельный task request и ручное решение reviewer.

### 17. Media performance оптимизируют ценой корректности или CSP

**Что идёт не так:** eager preload всех коллекций возвращает memory/network pressure; proxy/allowlist ломает legacy external images; dynamic `<img>` механически заменяется без сохранения aspect/fallback/cache semantics.

**Предотвращение:** измерять representative archive/reference/promotion media sets; оставить preload только активному изображению, background collections — lazy; тестировать signature validation, fallback, cache headers и CSP вместе. Намеренные lint warnings не исправлять без доказанной пользы.

### 18. Security scan или dependency cleanup принимается за автоматическое исправление

**Что идёт не так:** недоступный Deep Security Scan повторяют без изменения permission profile или заменяют массовым `audit fix --force`; dev findings смешиваются с clean production audit.

**Предотвращение:** scan readiness — отдельный gate; если среда не позволяет запуск, это честный blocker, а не повод заявить clean. Dev dependency findings triage отдельно, pin exact versions, review lockfile diff, rerun production/browser suite. Не обновлять Next/React/toolchain внутри CSP или UI-фазы.

### 19. Shared primitives выравнивают приложения, стирая нужные различия

**Что идёт не так:** единые empty/loading/error/list primitives вводятся массово и ломают специфические роли, limits, WYSIWYG area fonts или Promotion privacy.

**Предотвращение:** сначала контракт состояний и один pilot app; app-specific authorization/data policy остаётся вне visual primitive. Shared component не должен принимать raw privileged payload и не должен определять role access.

## Незначительные, но накопительные pitfalls

### 20. Нестабильные screenshots из-за шрифтов, locale, timezone и scrollbar

**Что идёт не так:** кириллические шрифты не успевают загрузиться, даты/время отличаются, scrollbar меняет ширину.

**Предотвращение:** ждать `document.fonts.ready`, фиксировать locale/timezone/clock, одинаковые browser binaries/DPR, стабилизировать scrollbar и data seed.

### 21. Console gate шумит и его начинают игнорировать

**Что идёт не так:** ожидаемые third-party/network warnings смешиваются с hydration/CSP/runtime errors.

**Предотвращение:** короткий versioned allowlist с owner/reason/expiry; любой новый console error, pageerror, failed critical request или CSP violation блокирует gate.

### 22. Accepted limitations случайно превращаются в regression tickets

**Что идёт не так:** cross-origin Ctrl+wheel, профильные публичные поля или принятый server-only content restriction повторно открываются без нового решения, отнимая scope у стабилизации.

**Предотвращение:** requirements должны ссылаться на Known Limitations/accepted risks. Изменение риска требует отдельного owner decision и threat/design research, а не попутного fix.

## Зависимости между рисками

```text
Dirty-file reconciliation + immutable archives
  → trustworthy v1.3 requirements/GSD ledger
  → deterministic browser baseline
  → owner-approved Figma visual/motion contract
  → safe architecture decomposition and desktop motion work

Isolated Supabase staging
  → canonical SQL migration proof
  → live RLS/RPC/concurrency evidence
  → Promotion remediation
  → owner PC/phone UAT

CSP inventory + media URL policy
  → report-only migration
  → enforceable CSP
  → final release gate
```

Нельзя менять порядок так, чтобы refactor или motion происходили до baseline/contract, Production SQL — до staging proof, а release UAT — до Promotion live remediation. Playwright infrastructure зависит от безопасных staging fixtures; visual regression зависит от owner-approved baselines; final security verification зависит от завершённого CSP и точного deployed SQL.

## Предупреждения и prevention gates по рекомендуемым фазам

Номера ниже — рекомендуемое продолжение после Phase 14; SUMMARY/roadmap может укрупнить названия, но не должен смешивать независимые gates.

| Фаза | Основной риск | Предупреждающие признаки | Обязательный prevention/exit gate |
|---|---|---|---|
| **15. Recovery и доказательный baseline** | Архивы/dirty files перезаписаны; статические тесты приняты за E2E; GSD drift | write-set включает v1.2 archives; package lock меняется; missing summaries игнорируются | Ownership ledger; immutable archive rule; новые v1.3 IDs; committed Playwright skeleton; evidence matrix; current behavior captured without product redesign |
| **16. Figma UI/motion contract** | Неутверждённые screenshots становятся baseline; scope превращается в redesign | mass snapshot approval; нет state matrix; owner review только по статичным кадрам | Owner-approved desktop/phone states, accents, window geometry, spider/web/Vivian motion and off/reduced modes; only then promoted visual baselines |
| **17. Supabase staging и canonical SQL** | Production fixtures; SQL drift; overclaim device binding/UA | production ref доступен test runner; RPC inventory differs; UA mode treated as auth | Isolated project; fail-closed environment guard; role/RLS/grant/function manifest; fresh+upgrade migration runs; concurrency/CAS/lease tests; residual-risk wording approved |
| **18. Architecture decomposition** | Giant component rewrite and mobile regressions | behavior/CSS changes mixed with extraction; selectors/persisted keys change | Characterization parity first; one domain per plan; same DOM/API/storage contracts; desktop+phone visual/behavior parity; no redesign |
| **19. Desktop reliability и motion** | Механически passing, но visually rejected/janky animation | random frames; long tasks; off mode still moves; repeat owner patch loop | Contract-based motion checks, controlled timeline, DPR 1.25 physical-PC review, performance budget, reduced/off proof, owner sign-off |
| **20. Promotion live proof** | Повторная реализация вместо проверки; unsafe fixtures; UA/device claims | mocks cited as RLS proof; shared accounts; skipped reviewer/auth flow | Full anon/auth/editor/owner and direct-API matrix on staging; parallel claim/bind/answer/lease tests; bank CRUD/preview; participant+reviewer Playwright; only reproduced defects remediated |
| **21. Apps/editor/media/mobile stabilization** | Shared primitives erase app semantics; media/CSP conflict; phone regressions | global CSS sweep; all `<img>` replaced; only desktop screenshots | Pilot-first primitives; per-app state/limit/access contracts; WYSIWYG and unsaved-edit proof; media budgets/cache/fallback; physical or faithful phone UAT |
| **22. Security, CSP и release verification** | One-shot CSP breakage; dependency churn; artifact drift; premature release | CSP violations ignored; `audit fix --force`; requirements complete before owner UAT | Report-only→enforce evidence; security diff/deep scan or explicit environment blocker; clean production audit plus dev triage; deployed SQL checksum; full browser/a11y/console/perf suite; owner PC/phone acceptance; all GSD artifacts reconciled |

## Минимальная phase gate matrix

| Изменение | Unit/API | Playwright | Visual | Live staging | Owner UAT | Security/a11y/perf |
|---|---:|---:|---:|---:|---:|---:|
| Planning/recovery only | — | baseline inventory | baseline inventory | — | approve scope/baseline candidates | artifact consistency |
| SQL/RLS/RPC | required | role flows | only affected UI | **required** | rollout approval | grants/RLS/search_path/concurrency |
| Giant-component extraction | required | **required** | **required** | affected flows | parity spot-check | console/a11y, bundle/runtime regression |
| Motion/desktop | helper tests | **required** | **owner-approved baseline** | — | **required on physical PC** | frame/paint/long-task + reduced motion |
| Promotion | required | **required** | desktop+phone | **required** | **required** | privacy, direct API, timers, race conditions |
| CSP/media | required | all app/media/auth states | affected media states | staging headers | smoke approval | **required report-only/enforce evidence** |
| Release | all green | all green, no hidden retry pass | approved diffs only | deployed contract green | PC+phone accepted | security/a11y/perf/console green |

## Roadmap rules derived from the pitfalls

1. **Implemented is not proven.** Carry Phase 14 behavior forward as implementation evidence, not as a blank-slate feature request and not as release acceptance.
2. **Every phase has an exclusion list.** A database phase cannot absorb motion; a refactor phase cannot redesign; a motion phase cannot update dependencies.
3. **Baselines require authority.** Automated screenshots become release baselines only after owner approval against the Figma contract.
4. **Production is not a test fixture.** All mutating proof runs on isolated Supabase staging; production gets owner-controlled rollout and read-only/post-deploy probes.
5. **Browser signals are hints.** UA/device/focus mechanisms may reduce abuse but never authorize data or justify hardware-attestation claims.
6. **Refactor by seam, verify by parity.** No large extraction closes without before/after desktop and phone evidence.
7. **GSD evidence is part of the deliverable.** Missing summaries, stale traceability or blocked verification prevent phase closure even when code exists.

## Evidence sources

- `.planning/PROJECT.md` — validated capabilities, active v1.3 goals, exclusions, accepted limitations, current branches and product decisions. **Confidence: HIGH.**
- `.planning/forensics/report-20261029-192309.md` — dirty files, component sizes, missing live proof/UAT, SQL drift, UA/device residual risk, absent Playwright suite, repeated patch loop and artifact drift. **Confidence: HIGH.**
- `.planning/milestones/v1.2-INCOMPLETE-ROADMAP.md` — Phase 14 scope, success criteria and incomplete plan closure. **Confidence: HIGH.**
- `.planning/milestones/v1.2-INCOMPLETE-REQUIREMENTS.md` — implemented Promotion contract, future requirements and explicit exclusions. Status marks are treated as implementation/traceability evidence, not independent release proof. **Confidence: HIGH with stated qualification.**
- `.planning/audits/2026-10-29-full-site-audit.md` — current automated results, confirmed security/performance strengths and remaining staging/CSP/dependency/SQL/architecture risks. **Confidence: HIGH.**

## What might still be missed

- The exact Playwright project/browser matrix, performance thresholds and Figma deliverable format are not defined in the supplied artifacts; they need phase-specific planning, not invention in this research file.
- No live Supabase schema inventory or staging credentials were available in the evidence, so current deployed RPC/policy parity remains deliberately unclaimed.
- Physical-device behavior beyond the recorded owner feedback remains unproven; emulated mobile coverage must not be reported as final phone acceptance.
- Deep Security Scan has no findings because it never started under the prior permission profile. Absence of findings is not evidence of absence.
