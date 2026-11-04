# Deferred items (Phase 20)

Найдено при выполнении 20-08. Не вызвано изменениями CSP, в область плана не входит.

- `media-states.spec.ts` "[STAB-MEDIA-03] a portrait that never answers gives up after 15s" на `webkit-phone` падает в полном прогоне файла (получает `failed` вместо `loading`), в одиночном запуске проходит. Падение воспроизводится и с временно отключённым Report-Only заголовком, то есть существовало до 20-08.
  → 20-25: PW-01, класс fixed (часы шли в реальном времени, запас 1 с; тест паркует часы и доказывает перехват запроса).
- `app-states.spec.ts:227` (chromium-desktop): диагностики `requestfailed ERR_FAILED` и `Failed to load resource` по изображению.
  → 20-25: PW-02, класс expected-fault (события прерванного собственного API приходили после однократного фильтра; правила `expectFault` применяются в момент проверки). Идентичность базовых событий не сохранена, доказательство косвенное, не воспроизведено в шести прогонах после правки.
- `app-states.spec.ts:204` (firefox-desktop): консольная ошибка `Image corrupt or truncated`.
  → 20-25: PW-03, класс expected-fault (тест сам делает `page.reload()`; Firefox зеркалит отменённое изображение в консоль вместе с двумя NS_BINDING_ABORTED; правило только внешний хост и только этот тест).
- `media-offscreen.spec.ts:54` (firefox-desktop): `requestfailed NS_BINDING_ABORTED` по удержанному хосту фрейма.
  → 20-25: PW-04, класс expected-fault (подресурсы стороннего фрейма отменяются при его перемонтировании). Тот же тест падал по таймауту 30 с на четырёх проектах: PW-05, класс fixed (`runFor` тратит реальное время, `test.slow()`).
  Три последних: ни одной записи `csp`; это шум диагностик от намеренно сломанных внешних запросов в чужих спеках.

Найдено при выполнении 20-25 (не было в списке выше, все закрыты там же):

- `media-offscreen.spec.ts` «[CR-01] a portrait that has not answered while «Сотрудники» was minimized…» (webkit-phone), таймаут 30 с.
  → 20-25: PW-06, класс fixed.
- `media-states.spec.ts` «[STAB-MEDIA-03] a portrait that never answers…» (firefox-desktop): один раз `page.goto` не дождался `load` за 30 с, не воспроизводится.
  → 20-25: PW-07, класс waiver, вердикт «ОЖИДАЕТ ВЛАДЕЛЬЦА» (релизный гейт FAIL до решения).
- `app-states.spec.ts` «[STAB-APP-02] Сотрудники: a reload that cannot reach the roster…» (chromium-desktop, chromium-dpr125): ожидание 5 с короче чтения живой таблицы; таймауты 30 с в populated и STAB-APP-03 для «Сотрудники».
  → 20-25: PW-08 и PW-09, класс fixed.

Найдено при выполнении 20-30 (smoke в clean checkout коммита cf138fc, вне объёма плана, не исправлено):

- `lib/phase16-guard-boundary.test.ts` импортирует `.claude/hooks/guard.mjs`, а каталог `.claude/` исключён локально через `.git/info/exclude` и не отслеживается git. В clean checkout `npm.cmd test` даёт 1 fail из 1423 (1418 pass, 4 skipped), а `npm.cmd exec tsc -- --noEmit` завершается кодом 2 (`TS2307: Cannot find module '../.claude/hooks/guard.mjs'`). В основной копии оба гейта зелёные только потому, что файл лежит рядом.
  → Блокирует PASS гейтов `unit` и `typecheck` на итоговом commit в 20-13 Task 2. Варианты решения (выбор за владельцем/планировщиком, не агента-исполнителя 20-30): отслеживать `.claude/hooks/guard.mjs`, либо сделать тест и импорт устойчивыми к отсутствию файла (skip как BLOCKED (ENV) и без статического импорта в tsc), либо исключить тест из clean-прогона с записью причины. Полный lint в clean checkout при этом проходит: код 0, 0 errors, 14 warnings.

Найдено при выполнении 20-29 (вне объёма плана, не исправлено):

- `npm.cmd test` на HEAD после db6deb1 даёт 4 fail из 1452: `lib/phase20-release-gate.test.ts` тесты «readWaivers reads the real registry: PW-07 accepted by the owner, PW-10 still awaiting», «classifyPlaywright + waivers: a failure under a waiver without the owner's verdict is FAIL», «aggregate: the registry itself is judged when Playwright gates ran» и «runGate Playwright: the e2e gate with a waiver registry marks only an owner-accepted failure as waived». Причина: db6deb1 (запись владельца о принятии PW-10 в 20-PLAYWRIGHT-WAIVERS.md) сделан после 20-30, а тесты 20-30 ждут PW-10 без вердикта в реальном реестре. 20-29 этих файлов не менял. Нужно привязать фикстуры к копии реестра, а не к живому файлу (план 20-30 или 20-13).
