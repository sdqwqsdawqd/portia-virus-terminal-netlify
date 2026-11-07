---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 54
subsystem: ui
tags: [visual-approval, recapture, gap-closure, owner-verdict, flasks, spider, template-builder, image-framing]

requires:
  - phase: PORTIA-20-security-accessibility-i-priemka-reliza
    provides: "20-48 колбы D-59, 20-49 конструктор шаблона D-60/D-61, 20-50 кнопка «+ ДОБАВИТЬ РАЗДЕЛ» D-62, 20-51..20-53 видимая часть картинки D-63"
provides:
  - "пересъёмка всех кандидатных кадров на H5 a6e2918b2afb0539f468cfa5ac802d349cae0ffb (набор phase20-refresh-a6e2918b2afb) и галерея review.html"
  - "раунд 14 в lib/phase20-visual-approval.test.ts и раздел 14 ledger (13 отклонённых 2026-11-07 кадров с hash и коммитами исправления)"
  - "раздел 15 ledger (10 строк кадра картинок и кнопки «Информации»)"
  - "вердикт владельца 2026-11-08 в ledger (раздел 16): 70 строк «принято», 16 «исправить», ответы раздела 7"
affects: [20-12, следующий цикл gap closure (кадр картинок, карточка шаблона)]

outcome: stopped-for-fixes

actuals:
  tokens: 110000
  tasks: 3
  commits: 4

plan_head_before: 9e68f1ebe6485b75634cc69b1140e255d1f3f2b3
plan_head_after: cd3f0640dc4b5ec9d7843a9696b3502f4cc3bc8c
commits: 4
status: complete

key-files:
  created:
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-54-SUMMARY.md
    - .planning/todos/completed/2026-11-06-flasks-wallpaper-redo.md
    - .planning/todos/completed/2026-11-06-spider-match-logo.md
  modified:
    - lib/phase20-visual-approval.test.ts
    - tests/e2e/visual-candidates/phase20-review-extras.spec.ts
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-VISUAL-APPROVAL.md
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-EVIDENCE-REFRESH.md

key-decisions:
  - "D-59 подтверждена владельцем: колбы (манометр убран, доски и волна у доски двигаются) приняты, ответ «Да, так и задумано»; задача flasks-wallpaper-redo закрыта"
  - "D-62 подтверждена: кнопка нового раздела сверху во вкладке «Информация» редактора, ответ «Да, это»"
  - "D-60: карточка шаблона всегда в две колонки как в «Базе вирусов»; раскладка классификации возвращается к прежней (три ячейки сверху, «способ распространения» посередине, три снизу), одна ячейка «угроза побега» не должна ломать остальные"
  - "D-63: вместо трёх ползунков «Видимая часть» нужен предпросмотр с рамкой выбора, как выбор баннера в Discord; образец владелец пришлёт; q-template-framing без ответа"

requirements-completed: []

coverage:
  - id: D1
    description: "Все CANDIDATE-строки пересняты на одном коммите H5; 13 отклонённых 2026-11-07 кадров закреплены в разделе 14, повторный показ отклонённых байтов и кадр до коммита исправления отвергаются тестом"
    requirement: STAB-REL-08
    verification:
      - kind: unit
        ref: "lib/phase20-visual-approval.test.ts#20-54 recapture guard"
        status: pass
    human_judgment: false
  - id: D2
    description: "Колбы (D-59) и паук (D-53) на пересъёмке: вердикт владельца «принято»"
    requirement: STAB-VIS-01
    verification:
      - kind: manual
        ref: "20-VISUAL-APPROVAL.md, 12 flasks-* и 16 spider-*, 2026-11-08, «Да, остальное принято»"
        status: pass
    human_judgment: true
    rationale: "Вердикт даёт только владелец; принят точный SHA256 каждой строки"
  - id: D3
    description: "Карточка шаблона (D-60): классификация и две колонки"
    requirement: STAB-TMPL-01
    verification:
      - kind: manual
        ref: "20-VISUAL-APPROVAL.md, 8 template-builder-*, вердикт «исправить» 2026-11-08"
        status: fail
    human_judgment: true
    rationale: "Владелец отклонил раскладку классификации; следующий цикл"
  - id: D4
    description: "Видимая часть картинки (D-63): интерфейс выбора"
    requirement: STAB-EDIT-02
    verification:
      - kind: manual
        ref: "20-VISUAL-APPROVAL.md, 8 строк кадра картинок, вердикт «исправить» 2026-11-08"
        status: fail
    human_judgment: true
    rationale: "Владелец не принял ползунки; нужен предпросмотр с рамкой"
  - id: D5
    description: "Кнопка «+ ДОБАВИТЬ РАЗДЕЛ» в «Информации» (D-62)"
    requirement: STAB-EDIT-02
    verification:
      - kind: manual
        ref: "20-VISUAL-APPROVAL.md, editor-info-add-section:pc/phone, 2026-11-08, «Да, остальное принято» и q-info-add-section «Да, это»"
        status: pass
    human_judgment: true
    rationale: "UI-контракт на подменённых чтениях, не доказательство ролей"

duration: n/a (три сессии исполнителей; Task 3 продолжение после ответа владельца)
completed: 2026-11-08
---

# Phase PORTIA-20 Plan 54: пересъёмка после исправлений D-59..D-64 и вердикт владельца Summary

**Пересъёмка набора phase20-refresh-a6e2918b2afb (143 строки) показана владельцу: 70 строк принято точными hash, 16 отправлены на исправление (карточка шаблона и интерфейс выбора видимой части картинки), план остановлен как `stopped-for-fixes`.**

## Что сделано

- **Task 1** (`a6e2918`, `a876b2d`): раунд 14 в тесте ledger (RED: 44 теста, 37 pass, 6 fail; затем GREEN), 13 отклонённых кадров (12 `flasks-*` и `template-builder-preview:pc`) пересняты на H5 `a6e2918b2afb0539f468cfa5ac802d349cae0ffb`, раздел 14 ledger с отклонёнными hash и коммитами исправления `b003476` (20-48) и `b9ff7d0` (20-49). PLAN_BASE `9e68f1ebe6485b75634cc69b1140e255d1f3f2b3`.
- **Task 2** (`40d7f81`): остальные строки на H5, раздел 15 (10 строк, «UI-контракт на подменённых чтениях, не доказательство ролей»), раздел доказательств в `20-EVIDENCE-REFRESH.md`, галерея с вопросами; 8 строк `empty-microscope-guide-*` и `rebaseline-application-guide--chromium-desktop:pc` переведены в BLOCKED (DATA), потому что на цели теперь есть раздел «Справочника».
- **Task 3** (`cd3f064`): вердикт владельца 2026-11-08 записан в ledger дословно, раздел 16, ответы раздела 7, две задачи перенесены в `.planning/todos/completed/`.

## Вердикт владельца 2026-11-08

Дословно (свободный ответ): «Наверное, только два изменения можно, в принципе, сделать. Это, во-первых, поменять, в принципе, как ты вставляешь картинку. […] мне не нравятся эти ползунки, они занимают слишком много места. Во-вторых, ими неудобно пользоваться. Так что предлагаю тебе сделать, можно сказать, превью. […] как в Дискорде, когда ты выбираешь баннер экрана. […] А во-вторых, мне не нравится, как теперь выглядит предупреждение, то есть нужно было, как раньше, то есть было три сверху, посередине способ распространения и три снизу, а не как сейчас. […] Я бы, наверное, только бы эти моменты изменил.» Полный текст в разделе 16 ledger. Уточнение: «Да, остальное принято».

Итог по ledger (143 строки): 82 «принято» (12 прежних и 70 новых, принятый hash равен SHA256 кандидата), 16 «исправить», 45 BLOCKED, ОЖИДАЕТ 0.

**Принято (70, цитата «Да, остальное принято»):** 12 `flasks-*`, 16 `spider-*`, 23 `rebaseline-*`, 17 прочих (`empty-flask-news-*`, `promotion-participant-*`, `info-phone-next:*`), `editor-info-add-section:pc` и `:phone`. Перед записью скриптом проверено, что файл каждого кандидата на диске и его SHA256 равен hash строки; несовпадений нет (0 строк оставлено ОЖИДАЕТ).

**Исправить (16, принятого hash нет):**

| Строки | Что просит владелец |
| --- | --- |
| `template-builder-main`, `-text`, `-mutations`, `-preview` на pc и phone (8) | классификация как раньше: три сверху, способ распространения посередине, три снизу; карточка всегда как в «Базе вирусов» (фото слева, текст справа) |
| `editor-image-framing-guide`, `editor-image-framing-dossier`, `guide-framed`, `dossier-framed` на pc и phone (8) | вместо ползунков предпросмотр с рамкой выбора видимой части, как выбор баннера в Discord; образец владелец пришлёт |

**Ответы раздела 7 (2026-11-08):**

| Вопрос | Ответ | Решение |
| --- | --- | --- |
| q-template-columns | «Всегда как в «Базе вирусов»» | D-60 |
| q-template-hyphen | вторая часть свободного ответа (раскладка классификации сломана, вернуть как раньше) | D-60 |
| q-flasks-reading | «Да, так и задумано» | D-59 |
| q-template-framing | без ответа | D-63 |
| q-info-add-section | «Да, это» | D-62 |

q-download-browser не задавался: причина ошибки скачивания воспроизведена в 20-49 (D-61).

## Следующий цикл исправлений (не планировался и не выполнялся)

1. **Выбор видимой части картинки:** заменить три ползунка «Видимая часть» в редакторе окном предпросмотра с рамкой, показывающей, какая часть картинки будет видна (как выбор баннера в Discord); ждём файл-образец от владельца. Затрагивает 8 строк кадра картинок; q-template-framing остаётся открытым.
2. **Карточка шаблона:** вернуть раскладку классификации (три ячейки сверху, «способ распространения» посередине, три снизу), чтобы одна ячейка «угроза побега» не ломала остальные; карточка всегда в две колонки как в «Базе вирусов»; слово «Предупреждение» остаётся в одну строку. Затрагивает 8 строк `template-builder-*`.

После исправлений нужны новая пересъёмка и вердикт владельца по этим 16 строкам; 20-12 для этих поверхностей заблокирован.

## Проверки

- `node --experimental-strip-types --test lib/phase20-visual-approval.test.ts`: 44 tests, 43 pass, 0 fail, 1 skipped (строгий гейт пропущен без флага).
- `PORTIA_REQUIRE_APPROVAL=1 node --experimental-strip-types --test lib/phase20-visual-approval.test.ts`: exit 1, 43 pass, 1 fail. Единственный упавший тест «every captured candidate has an exact positive owner verdict and every owner question an answer» содержит ровно 16 ошибок вида `<id>: owner asked for a fix: исправить: …` (8 `template-builder-*`, 8 строк кадра картинок). Ошибок «owner verdict is still pending», «stale candidates», «captured outside candidates_set», «does not match», «re-presents the rejected frame» и «owner answer is missing» нет.
- `git status --porcelain -- tests/e2e/visual/__screenshots__` пуст; `git log 9e68f1e..HEAD -- tests/e2e/visual/__screenshots__` пуст; на порту 3100 нет LISTENING. Эталоны не менялись.

## Deviations from Plan

None - план выполнен как написан; ветка «исправить» (stopped-for-fixes) предусмотрена планом. Из окружения: `.planning/todos/completed/` не существовало, каталог создан при `git mv`.

Заметка: в рабочем дереве есть чужие изменения (`.planning/todos/pending/2026-11-07-desktop-visual-overhaul.md`, `2026-11-07-nick-access-request.md`, новые `2026-11-08-access-levels.md`, `2026-11-08-image-framing-crop-preview.md`); исполнитель их не трогал и не коммитил.

## Known Stubs

Нет: код приложения в этом плане не менялся.

## Threat Flags

Нет новой поверхности: изменены только документы ledger и todo.

## Self-Check: PASSED

- Файлы найдены: 20-VISUAL-APPROVAL.md, 20-EVIDENCE-REFRESH.md, lib/phase20-visual-approval.test.ts, tests/e2e/visual-candidates/phase20-review-extras.spec.ts, оба todo в `.planning/todos/completed/`.
- Коммиты найдены в истории: a6e2918, a876b2d, 40d7f81, cd3f064 (`git rev-list --count` от PLAN_BASE даёт 4).
