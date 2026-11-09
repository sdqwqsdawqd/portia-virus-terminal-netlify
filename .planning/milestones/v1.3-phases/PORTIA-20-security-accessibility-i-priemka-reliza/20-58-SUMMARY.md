---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 58
subsystem: visual-acceptance
tags: [D-68, offline-harness, e2e, gap-closure, owner-accepted]
requires:
  - phase: PORTIA-20
    provides: "20-55 template card (D-65), 20-56 dialog «Видимая часть» (D-66, D-67), 20-57 drag, keyboard, Tab ring, phone, axe"
provides:
  - "D-68: the frame table and the review.html galleries no longer take part in acceptance (ledger test and gallery companion spec removed, ledger documents kept as history)"
  - "tests/e2e/harness/offline-supabase.cjs: explicit, tested offline Supabase stub for the Next server process (OFFLINE_ENV for 20-12 and 20-13)"
  - "functional checks of D-68 point 4 on H6, labelled by data mode"
affects: [20-12, 20-13, 20-14, 20-15]
tech-stack:
  added: []
  patterns:
    - "Offline stub = NODE_OPTIONS --require preload, on only with PORTIA_E2E_OFFLINE_SUPABASE=1 and the invented project address, refuses staging and mutation variables"
key-files:
  created:
    - tests/e2e/harness/offline-supabase.cjs
    - lib/e2e-offline-supabase-harness.test.ts
  modified:
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-VISUAL-APPROVAL.md
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-EVIDENCE-REFRESH.md
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-UAT.md
  deleted:
    - lib/phase20-visual-approval.test.ts
    - tests/e2e/visual-candidates/phase20-review-extras.spec.ts
key-decisions:
  - "RED 4d469f3 (round 16 and the re-ask rule) is superseded, not completed: the ledger test is removed whole (D-68), so it has no GREEN"
  - "The preload from the scratchpad became a file of the repository with refusals and a unit test (D-68 point 4, honesty about the data mode)"
status: complete
outcome: accepted
owner_verdict: accepted
owner_verdict_date: 2026-11-08
owner_verdict_commit: 0c2a59d1d1a7e805ccd48612cdb93ddf5ec7f1f1
plan_head_before: fe3b4c1123c4187a78e86e965592c64f4e116e08
actuals:
  tasks: 3
---

# Phase 20 Plan 58: Retire the visual ledger (D-68), offline harness, functional checks on H6 Summary

Tasks 1 and 2 are done: the frame table and the galleries are out of the process, the offline Supabase stub is an explicit tested file, and the mandatory functional checks of D-68 point 4 are green on H6 under that stub. Task 3 (the owner's overall verdict) is open: the owner has not answered, nothing is recorded as accepted, and the `owner_verdict*` fields are deliberately absent until the owner's words exist.

PLAN_BASE: fe3b4c1123c4187a78e86e965592c64f4e116e08

H6: 0c2a59d1d1a7e805ccd48612cdb93ddf5ec7f1f1 (product code equals 83ba50b: `git diff --name-only 83ba50b3f6438a332fcc7090b23e1688587b0e9a H6 -- app components public lib` lists only `*.test.*` files, here only `lib/e2e-offline-supabase-harness.test.ts`).

## Commits

| Task | Commit | Subject |
|------|--------|---------|
| 1 | 5a08a51 | chore(PORTIA-20-58): retire the visual ledger and galleries (D-68) |
| 2 RED | 873d8a6 | test(PORTIA-20-58): RED for the offline Supabase harness |
| 2 GREEN | 0c2a59d | feat(PORTIA-20-58): explicit offline Supabase harness for checks without a data source |

## Task 1: D-68 retirement

- `git rm` of `lib/phase20-visual-approval.test.ts` and `tests/e2e/visual-candidates/phase20-review-extras.spec.ts` in one commit. Replaces RED `4d469f3` (round 16 and the re-ask rule; its own run was 59 tests, 53 pass, 5 fail, 1 skipped). No GREEN, by D-68. Other candidate specs and `support.ts` untouched (they stage scenes for 20-12).
- `20-VISUAL-APPROVAL.md`, `20-EVIDENCE-REFRESH.md`: `status: retired-by-D-68`, `retired: 2026-11-08`, paragraph on the refusal. No frame table row changed (`git diff PLAN_BASE` has 0 lines matching `^[-+]| id:(pc|phone)`).
- `20-UAT.md`: VISUAL-APPROVED points at `20-58-SUMMARY.md; 20-12-SUMMARY.md`; SPIDER-03, CLASS-04, SVG-01 (PC and phone, 6 rows) compare with the view the owner accepted (20-58) and the 20-12 baseline. IDs, columns, statuses unchanged.
- No remaining reference: `grep -rl -e PORTIA_REQUIRE_APPROVAL -e phase20-visual-approval -e phase20-review-extras lib tests scripts package.json playwright.config.ts .claude/skills` prints nothing.
- `tests/e2e/visual/__screenshots__`, `scripts/phase15-visual-manifest.mjs`, `lib/phase15-visual-manifest.test.ts`: `git diff --exit-code` 0.

Verification (main tree, Node 22.13.1, no build, no Playwright):

| Check | Result |
|-------|--------|
| `node --experimental-strip-types --test lib/*.test.ts` after Task 1 | 1560 tests, 1557 pass, 0 fail, 3 skipped |
| `lib/phase15-visual-manifest.test.ts` + `lib/phase20-uat.test.ts` | 67 pass, 0 fail (37 manifest, 30 UAT) |
| `node scripts/phase15-visual-manifest.mjs --verify-promotion` | Verified 33 exact owner-approved snapshot bytes; 18 non-approved rows excluded. |
| `tsc --noEmit` | exit 0 |
| `eslint . --ignore-pattern dist --ignore-pattern .next` | 0 errors, 17 warnings (all before the plan: `<img>` in `portia-virus-card.tsx`, unused vars in `portia-promotion.test.ts` and in `tests/e2e/visual-candidates/.runs/**`) |

## Task 2: offline Supabase harness and functional checks

### RED

`node --experimental-strip-types --test lib/e2e-offline-supabase-harness.test.ts` against the missing file: 16 tests, 1 pass (the product-code reference scan), 15 fail. Commit `873d8a6`.

### GREEN

`tests/e2e/harness/offline-supabase.cjs`: on only with `PORTIA_E2E_OFFLINE_SUPABASE=1`; `dns.lookup` of any name under `.supabase.co` gives ENOTFOUND on the next tick; `GET https://abcdefghijklmnopqrst.supabase.co/rest/v1/portia_content` answers `200 []`; everything else uses the original functions; refuses with `[PORTIA_OFFLINE_HARNESS_REFUSED]` for another project address, a missing address and any of the seven staging or mutation variables; exports `OFFLINE_ENV` (three invented public values). Unit test: 16 tests, 16 pass, 0 fail; no network. After GREEN the full `lib/*.test.ts`: 1576 tests, 1573 pass, 0 fail, 3 skipped. tsc exit 0; eslint on the two new files: no problems (one `eslint-disable-next-line @typescript-eslint/no-require-imports` for the `require("node:dns")` of a CommonJS preload).

### Environment

Node 22.13.1 (`%TEMP%\portia-node-v22.13.1\node-v22.13.1-win-x64`). Throwaway worktree `%TEMP%\portia-20-58-verify`, reused from the interrupted run: `git checkout --detach H6`, no environment files, physical `node_modules`, no install. Production `next build` and `next start --hostname 127.0.0.1 --port 3100` there only; never in the main tree. Invented public values from `OFFLINE_ENV`, plus `PORTIA_E2E_ALLOW_HTTP=1`; no server-side key, no production, no Supabase call. Server under the stub: PID 22196 (stopped); control server: PID 5048 (stopped); `netstat` 0 listeners on 3100 before the first start and after each stop. Playwright via `node node_modules/@playwright/test/cli.js test --retries=0`.

`git -C "$WT" status --porcelain --ignored` before removal:

```
!! .next/
!! next-env.d.ts
!! node_modules/
!! test-results/
!! tests/e2e/visual-candidates/.runs/
```

`next-env.d.ts` is written by `next build`; `tests/e2e/visual-candidates/.runs/` is an ignored folder left by the earlier interrupted run. Nothing tracked changed. Worktree removed (`git worktree remove --force`); `git worktree list` has no `portia-20-58-verify`.

### Checks on H6 (data mode: offline stub)

| # | Check | Projects | passed / failed / skipped | Data mode | Result |
|---|-------|----------|---------------------------|-----------|--------|
| 2 | `template-builder.spec.ts` + `accessibility.spec.ts` `-g "STAB-TMPL-01\|template builder"` | chromium-desktop, chromium-phone | 40 / 0 / 2 | offline stub | PASS (offline-заглушка: стартовый контент, UI-контракт) |
| 3 | `template-builder.spec.ts` `-g "D-61\|D-65"` | chromium-desktop, chromium-dpr125, firefox-desktop, chromium-phone, webkit-phone | 15 / 0 / 5 | offline stub | PASS (offline-заглушка: стартовый контент, UI-контракт) |
| 4 | `editor-ui-contract.spec.ts` + `image-framing.spec.ts` | chromium-desktop, chromium-phone | 87 / 0 / 3 | offline stub | PASS (offline-заглушка: стартовый контент, UI-контракт) |
| 5 | `editor-ui-contract.spec.ts` `-g "D-66 touch\|D-66 dialog\|D-67 «Справочник» section photo"` | firefox-desktop, webkit-phone | 8 / 0 / 4 | offline stub | PASS (offline-заглушка: стартовый контент, UI-контракт) |

Skips are all by project, by the conditions in the specs: check 2 and 3: the phone layout test of D-65 runs on the phone projects only, the two-column test on the desktop projects only (2 and 5 skips); check 4: the finger drag skipped on chromium-desktop, the phone dialog test skipped on chromium-desktop, the mouse drag skipped on chromium-phone; check 5: on firefox-desktop the finger drag (a finger exists on the phone projects only), the mouse drag (mouse is checked on chromium-desktop) and the phone dialog test are skipped, on webkit-phone the mouse drag. No skip with a BLOCKED reason. Both projects of check 5 have passes (firefox-desktop 3, webkit-phone 5). Numbers equal the 20-57 reference (87 passed in check 4).

The result is the UI contract on the starting content under the stub. It says nothing about real content, roles, saving or the live data source.

### Control run without the stub

Server of the same build without `NODE_OPTIONS` and without the flag; check 2 only: 36 passed, 4 failed, 2 skipped.

| Test | Projects | Reason (diagnostics attachment) | Label |
|------|----------|----------------------------------|-------|
| `[STAB-A11Y-01] PC controls: axe, names, focus › template builder (UI-contract stub): axe and accessible names on every tab, dialog trap and focus restore` | chromium-desktop, chromium-phone | `[PORTIA_E2E_DIAGNOSTICS]` 1 unexpected runtime event: `GET /api/promotion/status -> 404` with its console line, and a `requestfailed` of a fetch `net::ERR_ABORTED` (the URL is redacted by the diagnostics; /api/content as in 20-55 is not visible in the attachment) | BLOCKED (ENV) без источника данных; PASS только под заглушкой |
| `[STAB-TMPL-01] a local image and long text reach the preview, the offline HTML and the PNG without any server write` | chromium-desktop, chromium-phone | the same unexpected runtime events | BLOCKED (ENV) без источника данных; PASS только под заглушкой |

The 36 other tests passed without the stub too (they do not depend on a data source). The causes are environmental (no data source and no roles), not product defects: this is the same kind of failure that 20-55 recorded as BLOCKED (ENV). They are NOT proven on a real source and stay BLOCKED (ENV) until a real read data source exists.

### Not run

`requirements.mark-complete` (STAB-A11Y-01/02, STAB-REL-08 wait for the physical acceptance 20-14). Figma and Codex Security: not reintroduced.

## Deviations from Plan

**1. [Rule 3 - Blocking] CLASS-04 wording in 20-UAT.md**
- **Found during:** Task 1
- **Issue:** the action text gives «соответствуют виду, принятому владельцем (20-58)», the acceptance grep (`принятым владельцем (20-58)` at least 6) counts exactly the instrumental form; with the dative form the count is 5.
- **Fix:** CLASS-04 now reads «различимы и совпадают с видом, принятым владельцем (20-58), и эталоном phase20-class-icons (20-12)». Same meaning, 6 matches.
- **Files modified:** 20-UAT.md (two rows).
- **Commit:** 5a08a51

**2. [Rule 2 - Honesty] Control run label**
- The plan expected a `requestfailed` on /api/content; the diagnostics redact the URL, so the report says "a fetch", not "/api/content". The 404 on `/api/promotion/status` is shown verbatim.

Otherwise: plan executed as written.

## Authentication gates

None.

## Known Stubs

None in product code. The offline harness is a test-only stub by design (explicit, refusing, labelled); its results are labelled "offline stub" everywhere.

## Threat Flags

None: the harness is not referenced from `app`, `components`, `lib` (non-test), `next.config.ts` or `package.json` (checked by `lib/e2e-offline-supabase-harness.test.ts`).

## Task 3: общий вердикт владельца (D-68)

Ответ владельца исполнитель-субагент не принял к записи: он пришёл к нему пересказом оркестратора, а не словами владельца (T-20-131). Вердикт записал оркестратор, в разговоре которого владелец ответил сам. Исполнитель-субагент ничего не решал и «принято» не писал.

## Список изменений, показанный владельцу (D-68)

Показан оркестратором 2026-11-08 в разговоре сессии. Содержание — текст плана с H6 `0c2a59d1d1a7`, переданный своими словами в виде списка (пункты и числа те же). Показанный текст:

> Код сайта в этом коммите тот же, что после 20-57: план менял только тесты и документы.
>
> 1. Карточка шаблона в «Повышении». Классы стоят как в «Базе вирусов»: три сверху, «Способ распространения» во всю ширину посередине, три снизу. На ПК карточка в две колонки (фото слева, классы справа) и в обычном окне, и в развёрнутом. Если окно сузить меньше примерно 690 px, карточка встаёт в одну колонку. На телефоне фото сверху, классы под ним. «Предупреждение» и другие значения пишутся целиком, без переноса, шрифт не меньше 12 px. Скачанные HTML и PNG выглядят так же. Публичная «База вирусов» не менялась.
> 2. Видимая часть картинки в редакторе. Ползунки убраны. Под полем картинки маленький предпросмотр и кнопка «Изменить». Кнопка открывает окно как выбор баннера в Discord: картинка затемнена, светлая рамка показывает место показа, картинку двигают мышью или пальцем. Внизу «Масштаб» 100–300 %, кнопки «Сбросить», «Отмена», «Применить»; Esc работает как «Отмена». Рамка повторяет место на сайте: у полосы раздела «Справочника» около 754×63 на ПК, у обложки 4:3. Фото досье, мутации, «Информации» и «Корзины» сайт показывает целиком. Поэтому при 100 % в рамке вся картинка, и чтобы выбрать часть, сначала увеличьте масштаб.
> 3. Окно и клавиатура. Стрелки сдвигают картинку на 5 %. Tab и Shift+Tab ходят по кругу внутри окна. На телефоне окно помещается в экран, кнопки не меньше 44 px.
> 4. Где сайт покажет чуть больше рамки. Картинка файла в «Корзине» на ПК (до 4 % ширины) и картинка мутации на низком экране телефона (до 18 % высоты). В развёрнутом «Справочнике» видна более узкая по высоте полоса той же картинки.
> 5. Не менялось: фото сотрудников, конструктор шаблона (выбора видимой части в нём нет), файл редактора.
> 6. Замечено, но не исправлено: у обычного окна подтверждения та же причина, по которой окно «Видимая часть» сначала стояло в углу. Если увидите его не по центру, скажите.
>
> Что значит «принято». План 20-12 снимет эталоны снимков с этого кода на стартовом контенте сайта, без реальных данных. Прежние эталоны окон, где теперь другой вид, тоже будут заменены. Ваше «принято» относится ко всему виду сайта на этом коде.
>
> Необязательные вопросы: (а) На телефоне карточка шаблона выглядит как «База вирусов» на телефоне. Вы это имели в виду под «всегда как в «Базе вирусов»»? (б) Рамка повторяет место показа на сайте. Так подходит? (в) Нужно ли такое же окно в конструкторе шаблона?
>
> Ответьте «принято» или «исправить: <что именно>».

## Вердикт владельца (D-68)

2026-11-08, дословно, без правки орфографии:

> а) чтобы шаблон был почти индетичен как дата базы вирусов, Б) да В)да. принято

Вердикт: `accepted` (однозначное «принято»), привязан к H6 `0c2a59d1d1a7e805ccd48612cdb93ddf5ec7f1f1`. 20-12 может снимать эталоны с этого кода на стартовом контенте.

## Ответы на прочтения

- (а) 2026-11-08: «чтобы шаблон был почти индетичен как дата базы вирусов». Прочтение: карточка шаблона почти идентична карточке «Базы вирусов» (в том числе на телефоне) — совпадает с тем, что сделано в 20-55.
- (б) 2026-11-08: «да» — рамка окна повторяет место показа на сайте.
- (в) 2026-11-08: «да» — владелец хочет такое же окно «Видимая часть» в конструкторе шаблона. Это новая работа, в 20-58 не сделана: todo `.planning/todos/pending/2026-11-08-template-builder-framing-dialog.md`. Если её сделать после 20-12, эталоны конструктора шаблона придётся переснять.
