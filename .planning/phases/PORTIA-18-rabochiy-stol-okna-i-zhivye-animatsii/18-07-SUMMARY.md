---
phase: 18-rabochiy-stol-okna-i-zhivye-animatsii
plan: 07
subsystem: visual-candidates-owner-review
tags: [visual-candidates, owner-review, drift-register, perf-traces, blocked]
requires: [18-01, 18-02, 18-03, 18-04, 18-05, 18-06]
provides:
  - "Набор кандидатов phase18-b9403654a03f (в .runs/, вне git): 9 замен отклонённых motion-кадров, 6 строк recoveryPhase 18, регрессия утверждённых кадров"
  - "18-VISUAL-REVIEW.md: реестр кандидатов, EXPECTED DRIFT, реестр data drift (группы D, F), раздел 5 с вердиктом владельца по (б)"
  - "18-PERF-TRACES.md: инструкция и таблица замеров, все результаты BLOCKED (OWNER-TRACE)"
affects: [phase-verification]
tech-stack:
  added: []
  patterns: ["кандидаты снимаются отдельным набором, подписанные PNG и evidence Phase 15 не меняются"]
key-files:
  created: []
  modified:
    - tests/e2e/visual-candidates/motion.spec.ts
    - tests/e2e/visual-candidates/desktop.spec.ts
    - .planning/phases/PORTIA-18-rabochiy-stol-okna-i-zhivye-animatsii/18-VISUAL-REVIEW.md
    - .planning/phases/PORTIA-18-rabochiy-stol-okna-i-zhivye-animatsii/18-PERF-TRACES.md
key-decisions:
  - "Вердикт владельца «verified» по (б) принят как физический просмотр на PC и phone для текущего HEAD; он не заменяет вердикты по кадрам (а) и замеры (в)"
  - "Владелец отказался от пересъёмки устаревших кадров («Не надо снимать, я сам оценю»): пересъёмка не выполнялась, строки остаются PENDING"
  - "Ни одно требование не закрыто этим планом: STAB-MOTION-08 и STAB-MEDIA-06 остаются Pending"
requirements-completed: []
requirements-pending: [STAB-MOTION-08, STAB-MEDIA-06]
duration: not measured
completed: 2026-11-02
status: complete
actuals:
  tokens: 9300
  tasks: 3
  commits: 9
plan_head_before: b9403654a03f7536543408c7ca9bd0d50f6fe1cd
plan_head_after: e207fd03c89c676c6a75b9dd52b988a6b8f29858
---

# Phase 18 Plan 07: Кандидаты, вердикты владельца и замеры Summary

План собрал набор кандидатов вместо 9 отклонённых motion-кадров и 6 строк recoveryPhase 18, зафиксировал регрессию утверждённых кадров и реестр EXPECTED DRIFT; владелец принял физический просмотр (б), а вердикты по кадрам, перенос в эталон и замеры скорости отложил: они остаются PENDING / BLOCKED.

## Задачи

| Задача | Коммит | Результат |
|--------|--------|-----------|
| 1 (tracer) | 61ded4c | Ярлыки: 5 кандидатов `motion-shortcut-*`, bbox одинаков во всех состояниях, end == rest побайтно внутри прогона |
| 2 | 5140176 | Паук, волны, заставка, обои, строки phone-окна (D-16), регрессия утверждённых кадров, реестр дрейфа |
| 3 (checkpoint, owner) | e207fd0 | Частичный вердикт владельца записан: (б) принято, (а) и (в) отложены |

`commits: 9` в frontmatter измерено как `git rev-list --count b940365..HEAD` (ledger `.git/gsd-plan-head-before-18-07`). Это не только коммиты плана: сюда входят 6 коммитов quick 261102-d7r (1e4bf53, 398ae0b, 7c79b89, 523c395, 6222cf8, ce66704), сделанных между checkpoint и продолжением. Коммитов самого плана до этого SUMMARY три: 61ded4c, 5140176, e207fd0.

## Вердикт владельца (2026-11-02)

- **(б) Физический просмотр на устройствах: ПРИНЯТО.** Цитата: «verified». Уточнение: выбрано «Вся проверка (б)» (ярлыки, паук, три режима, заставка, кивок, drag/resize у краёв, окно на phone, включая «на phone окно во весь экран, ни Вивьян, ни клавиатура не закрывают ввод»). Дано после quick 261102-d7r, относится к текущему HEAD.
- **(а) Вердикты по кадрам, группы D/F, перенос в эталон: отложено («позже»).** Все строки 18-VISUAL-REVIEW.md остаются `PENDING`, группы D и F остаются открытыми вопросами владельцу.
- **(в) Замеры скорости: отложено.** 18-PERF-TRACES.md: все результаты BLOCKED (OWNER-TRACE).

Дальше этих трёх пунктов ничего не выведено.

## Кандидаты устарели после quick 261102-d7r

После checkpoint quick 261102-d7r изменил поведение: паутина без покачивания, у паука убрана обводка (владелец снял пункт 3 утверждения), паук без рывка на старте и остановке и входит в новый маршрут по дуге, ярлыки доигрывают в покой и линии рисуются целиком, «База вирусов» около 0.86, окно плавно появляется. Кадры spider / web / shortcut / window в наборе `phase18-b9403654a03f` сняты до этого и больше не соответствуют коду (STALE). Владелец сказал не пересъёмывать, пересъёмка не выполнялась. Записано в 18-VISUAL-REVIEW.md (разделы 3 и 5). Любой вердикт по этим кадрам потребует новой съёмки.

## Результаты проверок (на HEAD e207fd0)

Node 22.13.1 (reference).

| Проверка | Результат |
|----------|-----------|
| `npm test` | 889 тестов: 886 pass, 0 fail, 3 skipped |
| `npm exec tsc -- --noEmit` | exit 0 |
| `lib/phase15-visual-manifest.test.ts` | 37 pass, 0 fail |
| `node scripts/phase15-visual-manifest.mjs --verify-promotion` | exit 0: 33 одобренных snapshot-байта совпали, 18 не одобренных строк исключены |
| `git diff --name-only b940365..HEAD -- tests/e2e/visual .planning/phases/PORTIA-15-baseline` | пусто (подписанные PNG и evidence Phase 15 не менялись) |
| `git ls-files` по trace-файлам | trace-файлов нет (только сам документ 18-PERF-TRACES.md) |

`--verify` (перезаписывает evidence) не запускался. `npm run lint` и `npm run build` в этом продолжении не запускались. Playwright e2e и пересъёмка не запускались.

## Что остаётся BLOCKED / PENDING

- Вердикты владельца по всем строкам 18-VISUAL-REVIEW.md (9 замен, 6 строк recoveryPhase 18, строки регрессии): PENDING. Для spider / web / shortcut / window ещё и STALE.
- Группа D (data drift: контент в кадрах отличается от эталона) и группа F (webkit-phone, причина не изолирована): открытые вопросы владельцу.
- Перенос одобренных кадров в эталон (`tests/e2e/visual/__screenshots__`): не выполнялся, не одобрен; потребует нового ledger и изменения `--verify-promotion` вне фазы.
- Замеры скорости PC-1..PC-4, Phone-1, Phone-3, Phone-taskbar: BLOCKED (OWNER-TRACE). Ручное «verified» их не заменяет.
- Редактор (колонки 340px, drag-сортировка по двум осям) в аутентифицированной роли и на реальном источнике данных, Postgres/RLS, staging/production: BLOCKED, не пройдено. В (б) ничего об этом не сказано.

## Решения по требованиям

Требования плана (frontmatter): STAB-MOTION-08, STAB-MEDIA-06.

| Требование | Решение | Причина |
|------------|---------|---------|
| STAB-MOTION-08 | Pending | Требует visual regression и owner review кадров; вердикты по кадрам отложены, часть кадров устарела, перенос в эталон не сделан. Физический просмотр (б) этого не заменяет |
| STAB-MEDIA-06 | Pending | Нет ни одного owner trace (BASE/HEAD); «после не хуже до» не доказано |

Остальные Pending-требования фазы (STAB-DESK-02, -03, -04, -06; STAB-MOTION-02 .. -07) в `requirements` плана 18-07 не входят, и этот план их не закрывал и не менял в REQUIREMENTS.md. (б) подтверждает вручную их пользовательскую часть, включая клавиатуру на телефоне владельца для STAB-DESK-04, но решение о закрытии принимает верификация фазы по сводкам планов 18-01..18-06: часть этих требований (например поведение редактора в STAB-DESK-02) упирается в аутентифицированную роль и источник данных, которых у Claude нет. Закрытие «по (б)» без этой проверки здесь не делалось.

## Отклонения от плана

Не по Rules 1-3. Единственное отличие: Task 3 (checkpoint) закрыт частично, по решению владельца (см. выше), поэтому критерии плана «вердикты владельца по кадрам» и «замеры» не выполнены и честно записаны как PENDING / BLOCKED, а не как pass.

## Known Stubs

Нет. Новых заглушек в коде плана нет.

## Threat Flags

Нет новой сетевой, auth или файловой поверхности. Trace-файлы в репозиторий не кладутся (они могут содержать адреса и данные сессии).

## Self-Check: PASSED

- Коммиты 61ded4c, 5140176, e207fd0 присутствуют в истории HEAD.
- 18-VISUAL-REVIEW.md и 18-PERF-TRACES.md существуют и содержат запись о вердикте от 2026-11-02.
