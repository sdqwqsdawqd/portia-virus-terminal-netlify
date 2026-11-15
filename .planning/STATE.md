---
gsd_state_version: "1.0"
milestone: v1.4
milestone_name: Доступ и единый стиль
current_phase: 25
current_phase_name: "Переключение закрытия: база, кэш, сборка, хранилище"
status: executing
stopped_at: Completed PORTIA-25-08-PLAN.md
last_updated: "2026-11-15T19:30:49.984Z"
last_activity: 2026-11-15
last_activity_desc: Phase PORTIA-25 execution started
state_head: a490668150df6f0ea53a4a728b20b371ecd15745
progress:
  total_phases: 7
  completed_phases: 3
  total_plans: 50
  completed_plans: 48
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-11-09)

**Core value:** Участник открывает сайт и сразу находит нужную запись; редактор правит её без потерь и без путаницы — и всё это выглядит как цельная «PORTIA OS».
**Current focus:** Phase PORTIA-25 — Переключение закрытия: база, кэш, сборка, хранилище

## Current Position

Phase: PORTIA-25 (Переключение закрытия: база, кэш, сборка, хранилище) — EXECUTING
Plan: 9 of 10
Status: Executing Phase PORTIA-25
Last activity: 2026-11-15 — Phase PORTIA-25 execution started

Progress: [████░░░░░░] 43% (3/7 phases closed: 21, 23 и 24 — принятый риск; Phase 22 не закрыта)

## Performance Metrics

**Current milestone (v1.4):**

- Total plans completed: 0
- Phases: 3 of 7 closed (21 — D-72, 23 — D-73, 24 — D-74; принятый риск, не PASS)

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| — | — | — | — |

*Plan counts and velocity begin after Phase 21 planning.*

**Previous milestone (v1.3, closed 2026-11-09 via override):** 6 phases, 134 plans. Per-plan duration table was reset at v1.4 roadmap creation; it remains in the git history of this file and the totals are in `.planning/MILESTONES.md`.
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase PORTIA-22 P01 | 18min | 2 tasks | 23 files |
| Phase PORTIA-22 P02 | 12m | 2 tasks | 3 files |
| Phase PORTIA-22 P03 | 1h45m | 2 tasks | 16 files |
| Phase PORTIA-22 P04 | 32m | 2 tasks | 11 files |
| Phase PORTIA-22 P05 | 21h23m | 3 tasks | 20 files |
| Phase PORTIA-22 P06 | 5h40m | 3 tasks | 19 files |
| Phase PORTIA-22 P07 | 12m | 2 tasks | 2 files |
| Phase PORTIA-22 P08 | 12h58m | 2 tasks | 11 files |
| Phase PORTIA-22 P09 | 26m | 2 tasks | 5 files |
| Phase PORTIA-22 P10 | 20m | 3 tasks | 3 files |
| Phase PORTIA-23 P23-08 | ~45min | 2 tasks | 4 files |
| Phase PORTIA-23 P09 | 25min | 3 tasks | 4 files |
| Phase PORTIA-23 P10 | 20min | 2 tasks | 6 files |
| Phase PORTIA-23 P11 | 45min | 3 tasks | 8 files |
| Phase PORTIA-23 P12 | 9min | 3 tasks | 10 files |
| Phase PORTIA-24 P01 | 25min | 2 tasks | 15 files |
| Phase PORTIA-24 P02 | 40min | 3 tasks | 7 files |
| Phase PORTIA-24 P03 | 15 min | 2 tasks | 6 files |
| Phase PORTIA-24 P04 | 35min | 3 tasks | 11 files |
| Phase PORTIA-24 P05 | 35min | 3 tasks | 8 files |
| Phase PORTIA-24 P06 | 15 min | 2 tasks | 3 files |
| Phase PORTIA-24 P07 | 40min | 2 tasks | 9 files |
| Phase PORTIA-24 P08 | 35min | 2 tasks | 5 files |
| Phase PORTIA-24 P09 | 35min | 2 tasks | 3 files |
| Phase PORTIA-24 P10 | 35min | 3 tasks | 3 files |
| Phase PORTIA-24 P11 | continuation about 1h | 3 tasks | 15 files |
| Phase PORTIA-25 P01 | 55min | 2 tasks | 13 files |
| Phase PORTIA-25 P02 | 70 min | 2 tasks | 12 files |
| Phase PORTIA-25 P03 | 25 min | 2 tasks | 9 files |
| Phase PORTIA-25 P04 | 20 min | 3 tasks | 9 files |
| Phase PORTIA-25 P05 | 15 min | 3 tasks | 26 files |
| Phase 25 P06 | 20 min | 2 tasks | 13 files |
| Phase PORTIA-25 P07 | 30m | 3 tasks | 5 files |
| Phase PORTIA-25 P08 | 40 min | 2 tasks | 12 files |

## Accumulated Context

### Decisions

Full decision history: `.planning/PROJECT.md`.

- [v1.4 roadmap]: 7 фаз (21–27), нумерация продолжает v1.3; 52/52 требования отображены ровно по одной фазе. Порядок: основа доступа → вкладка «Пользователи» → вход по нику при выключенном закрытии → уровни → переключение → единый стиль → приёмка.
- [v1.4 roadmap]: Вкладка «Пользователи» идёт раньше входного экрана (иначе некому одобрять); закрытие сайта — флаг, выключенный по умолчанию и меняемый только владельцем; включение на production — шаг владельца в Phase 25.
- [v1.4 roadmap]: `register_attempt` отзывается в миграции Phase 21 (SEC-06) вместе с правилами доступа; `next` 16.4.5 — отдельным коммитом (SEC-08). Новая миграция нумеруется после неприменённых `20261104000000`, `20261104000100`, `20261106000000`.
- [Phase PORTIA-21]: D-72: фаза закрыта владельцем как принятый риск без живого прогона, не PASS; 6 пунктов 21-UAT.md skipped («принято владельцем»), 21-VERIFICATION.md остаётся human_needed с разделом Acknowledged Gaps; Postgres/RLS, роли, pgcrypto, конкурентность, Netlify-адаптер BLOCKED; требования без галочки; WR-01 закрыть до staging, WR-04 до Phase 23
- [Phase PORTIA-23]: D-73: фаза закрыта владельцем как принятый риск, не PASS; 23-UAT.md 9/9 pass (браузер, dev), 23-SECURITY.md threats_open 0 (офлайн); 23-VERIFICATION.md остаётся human_needed с разделом Acknowledged Gaps; миграции 20261113/20261114 не применены, ACC-05/06/07 и закрытие по умолчанию в базе BLOCKED; WR-08/WR-09 open; требования без галочки
- [Phase PORTIA-24]: D-74: фаза закрыта владельцем как принятый риск, не PASS; 24-UAT.md 5/5 skipped («принято владельцем»), 24-SECURITY.md threats_open 0 (офлайн), RLS-ревью 2 раунда (open critical/high 0); 24-VERIFICATION.md остаётся human_needed с разделом Acknowledged Gaps; LVL-09 без галочки (живая проверка BLOCKED); WR-01..WR-03 open; анонимное чтение portia_content — Phase 25 (SEC-01)
- [v1.4 roadmap]: Решения владельца D-71 (1б–8а) закреплены; три направления стиля A/B/C показываются текстом в Phase 22, перекраска идёт в Phase 26 (не больше одной переделки на экран); галереи и реестр по хэшам не возвращаются.
- [Phase PORTIA-22]: 22-08: статический supabase-rls-reviewer проверил commit `9f2778c49f63ef44925170bcf07df8e98baf842e`; RLS22-01..05 исправлены, новых находок Phase 22 нет. SEC-M1 остаётся ранее принятым baseline; live Postgres/RLS, роли и конкуренция BLOCKED.
- [Phase PORTIA-22]: 22-10: владелец 2026-11-12 ответил «оставить blocked C»; миграции не применялись, staging BLOCKED (ENV), production ОЖИДАЕТ ВЛАДЕЛЬЦА.
- [Phase PORTIA-22]: 22-10: владелец выбрал направление C для Phase 26 — мягкие поверхности, острые элементы управления и вкладки, статусы-капсулы; UI-01 закрыто решением владельца.

- [v1.3 roadmap]: Continue numbering after incomplete Phase 14; v1.3 uses Phases 15–22.
- [v1.3 roadmap]: Stabilization preserves current PORTIA OS identity and validated behavior; it is not a redesign.
- [v1.3 roadmap]: Every requirement belongs to exactly one phase; browser/live/visual/UAT evidence is required even where code already exists.
- [v1.3 roadmap]: Decomposition follows approved characterization; Promotion proof follows isolated Supabase staging.
- [v1.3 roadmap]: Repository-native UI approval, local security evidence and physical owner PC/phone UAT remain honest gates until performed.
- [Phase 15]: External design and managed-scan dependencies were removed from the active plan by owner decision; historical artifacts remain provenance only.
- [Phase 15]: Persisted candidate evidence remains bound to source commit `4ec66b7d693c`; later evidence commits do not change its byte identity.
- [Phase 15]: Final visual ledger contains 33 APPROVED, 18 REJECTED and 33 BLOCKED rows; new hashes require repository-local per-hash review.
- [Phase 15]: Firefox is the Search-window pixel authority; other projects retain shell/device coverage.
- [Phase 15]: Candidate-generation specs are opt-in and excluded from default Playwright regression discovery.
- [Phase 15]: 15-14: Local security gate PASS (repo-local scope only); authenticated/RLS-runtime/staging lanes stay BLOCKED; 0 unresolved critical/high; dev-tooling highs fixed via lockfile-only audit fix
- [Phase 15]: 15-15: Phase 15 stays gaps_found after clean-checkout verification; only STAB-BASE-01 and -05 complete; 15 data-backed Playwright tests recorded BLOCKED (DATA) because no real read backing was supplied
- [Phase 15]: 15-16: tracked 15-CANDIDATE-INDEX.json is the clean-checkout source for --verify-ui-map/--verify-approval; raw capture stays preferred and index==capture is enforced (PORTIA_CANDIDATE_INDEX_DRIFT). G6 resolved, G1-G5 and all STAB-BASE statuses unchanged.
- [Phase 17]: 17-01: визуальная дорожка в эталоне BLOCKED (ENV, preflight требует NEXT_PUBLIC_SUPABASE_*); чистота переносов доказывается scripts/phase17-move-parity.mjs
- [Phase 17]: 17-01: seam-модули называются components/portia-desktop-<seam>.tsx / portia-editor-<seam>.tsx, source-тесты читают семейство через componentFamily()
- [Phase 17]: 17-02: восемь частей досье перенесены чистым переносом в portia-editor-dossier.tsx; мутации без перетаскивания (UX вне Phase 17)
- [Phase PORTIA-17]: 17-03: dossier viewer + FormattedText moved byte-for-byte to portia-desktop-dossier.tsx; seven exports; visual lane stays BLOCKED (ENV)
- [Phase PORTIA-17]: 17-04: portia-editor-rich-text exports exactly seven names; one createContext, Provider stays in PortiaEditor
- [Phase 17]: 17-05: решение openApp/finishExit вынесено в lib/window-open.ts (openedWindow, exitedWindow); поведение как на эталоне, e2e window-reopen BLOCKED (ENV)
- [Phase 17]: 17-06: unused imports (dragGeometry, resizeGeometry, ResizeEdge, PortiaIconName) removed from portia-desktop.tsx after the AppWindow/shortcuts move to keep lint at 18 warnings
- [Phase 17]: 17-07: embeddedApps stays in portia-desktop.tsx; embedSandbox private to portia-desktop-documents.tsx next to both iframes (D-19/SEC-03)
- [Phase 16]: 16-08: authz matrix is derived from baseline SQL; D-11 and SEC-M1 are accepted outcomes, not denials; outsider on reviewer RPCs is forbidden (SQL), not 42501 as sketched in research
- [Phase 16]: 16-09: race N and R go into receipt suite keys; races blocked by admin 42501 or a foreign owner are BLOCKED, never pass; the shared live script runs files serially because of the single owner fixture
- [Phase 16]: 16-09: race winner is judged by RPC reply type; an idempotent reply inside a different-nonce race is unexpected and checked in a separate step
- [Phase 16]: 16-09: the shared live npm script runs files serially via test-concurrency=1 (shared owner fixture and Auth limits)
- [Phase 16]: 16-10 D9: explicit grants migration needed (audit sequence ACL leaked to anon/authenticated); golden fingerprint recorded; wrapper code left uncommitted due to guard
- [Phase 16]: 16-11: db query шлёт один prepared statement; скрипты ступеней оборачиваются в один DO EXECUTE без begin/commit верхнего уровня, SQL-файлы не менялись; golden == upgrade без мост-миграции
- [Phase 16]: 16-12: platform function rls_auto_enable excluded from golden-vs-matrix check but pinned by name; Storage insert-oversize/bad-mime for anon/outsider expected http-413/415 (bucket limits before insert policy, baseline 1639/1640)
- [Phase 16]: 16-13: proof привилегированной lane только от probeSession после входа через /owner-login и iss; participant cookie через supabase/ssr (owner-login выходит из сессии не-редактора); mutation запускается с --workers=1 (единственный owner email)
- [Phase 16]: 16-13: клиентский бандл редактора не должен импортировать node:crypto (CSP eval); HMAC-токены предпросмотра вынесены в lib/portia-promotion-preview-token.ts
- [Phase 16]: 16-14: production DRIFT (sequence ACL + two legacy promo RPC overloads) closed by forward-only migrations 20261101000100/20261101000200; NOT applied to production (owner decides, D5). STAB-SEC-04 stays Pending, STAB-REL-04 Complete.
- [Phase PORTIA-18]: 18-01: owner approved all motion [PROPOSED] values (7=A drag inside 8px, 8=A Vivian hidden on phone with open window); STAB-MEDIA-06 stays BLOCKED until owner traces
- [Phase 18]: 18-02: заставка только в режиме full; в reduced и off не рендерится (п. 6 утверждён)
- [Phase PORTIA-18]: 18-03: ease-in on shortcut return sits on the peak keyframe; promotion arrow removed from the soft-mode kill rule so it plays in reduced
- [Phase PORTIA-18]: 18-04: dragGeometry keeps symmetric 8px inset vertically (owner variant A); nodWindow via Web Animations, 240ms, only motion full and not qualification-locked
- [Phase 18]: 18-05: spider body outline 38% accent applied; outline contrast >= 1.5:1 verified by calculation on four presets
- [Phase 18]: 18-06: .editor-card-columns rules placed after .flat-editor-form (equal specificity) in min-width:901px; Vivian hidden on phone via sibling selector (item 8 variant A)
- [Phase PORTIA-18]: 18-07: owner accepted physical review (b) 'verified'; frame verdicts, groups D/F, baseline promotion and traces deferred; spider/web/shortcut/window candidates stale after quick 261102-d7r, no re-capture
- [Phase 19]: 19-02: refusal text reaches ImageEditorField through an uploadMessage prop (dossier part must not import lib/image-upload, D-03); SQL photo_url rule untouched, TS is stricter only
- [Phase 19]: 19-01: owner approved all 11 agent recommendations (staging roster via PORTIA_PROMOTION_STAGING_ROSTER, LAN dev, search keys, fail-closed permission text)
- [Phase 19]: 19-03: staging promotion roster is honoured only behind the isolated-project guard (isolated ref, non-empty production list, CONTEXT not production); acceptance data scoped by run prefix, manifest and window
- [Phase 19]: 19-04: submit success requires response.ok plus a string requestId; PC/phone warning texts per owner verdict 11; server refusal texts unchanged (verdict 10 A)
- [Phase 19]: 19-05: access revocation = HTTP 403 without error code; per-command 403s keep their code and do not wipe reviewer state
- [Phase 19]: 19-08: device-cached data counts as loaded (lastGoodAt = cache time or empty string) and only the newest /api/content request may start a failure; a degraded roster answer is shown with the stale strip
- [Phase 19]: 19-06: sheet column E of the promotion roster is the availability date; rank cooldown is no longer added on top (defect 1, 4d2a3e9)
- [Phase 19]: 19-06: owner variant 2 - accept without re-running steps 1-9 on staging; steps 2-8 ran on production (incident); recorded as deviation, does NOT close STAB-PROM-15

- [Phase 19]: 2026-11-03 owner: promotion icon level strokes stay at full brightness at rest (19-09 rule 4, opacity 1); no keyframe change
- [Phase 19]: 2026-11-03 owner: production state after the mistaken UAT steps 2–8 reviewed by owner — «всё нормально», no revert list needed

- [Phase 19]: 2026-11-03 owner: 19-07 teardown of staging run mvz5fqgv_c40b449b: earlier hold («не надо запускать») REVERSED by owner with «удалить»; run executed, residual 0 on all categories, 19-07 closed
- [Phase PORTIA-19]: 19-14: owner verdict from 19-UAT.md recorded; D physical, F9-F12 and STAB-PROM-15 stay BLOCKED (debt); only STAB-MEDIA-01..05 and STAB-SEARCH-03 marked complete, other 19-14 requirements left Pending
- [Phase 19]: 19-15: visibility-gated media timeout passed on Chromium desktop and phone; folded guide covers remain BLOCKED (DATA) until 19-19
- [Phase 19]: 19-16: failed initial restore ignores all HTTP refusals before 404/423 reset; live role and owner UAT evidence remains Pending
- [Phase PORTIA-19]: 19-17: v2 acceptance snapshot uses staging DB Date and preserves preexisting rows; STAB-PROM-13/15 remain Pending until live staging and owner devices
- [Phase 19]: Владелец (Qloxz), 2026-11-04: B — серверный источник «Сотрудников» не менять; Task 2 плана 19-18 пропущена.
- [Phase 19]: 19-19: случайный PASS живого ростера не закрывает empty и desktop stale «Сотрудников» при вердикте B; STAB-DESK-08, STAB-APP-02, STAB-APP-10 Pending.
- [Phase PORTIA-19]: 19-20: Qloxz, 2026-11-04 — «Удалить этот run и создать новый v2 (рекомендуется)»; mw0rbyf6 teardown residual 0; новый v2 mw1loqa9_c9451c80; физическая PC/phone приёмка остаётся открытой.
- [Phase PORTIA-20]: 20-01: задание «создать шаблон» распознаётся по тексту (/шаблон/i); конструктор скрывает оболочку Повышения через hidden, а не размонтирует её
- [Phase PORTIA-20]: 20-08: CSP candidate delivered only as Content-Security-Policy-Report-Only; enforced policy and img-src https: unchanged; enforcement blocked until D-05 PC/phone UAT
- [Phase PORTIA-20]: 20-09: status/test routes unchanged (no confirmed leak); participant status body on staging stays BLOCKED(DATA) until roster nickname exists
- [Phase PORTIA-20]: 20-17: open-tab check moved from /api/uploads route into uploadGate; 403 sheet-employee delete keeps server text
- [Phase PORTIA-20]: 20-18: IN-05 ratings-column fallback kept as disposition (production unavailable); comment points to baseline migration with removal condition
- [Phase PORTIA-20]: 20-19: recommendation seed via useSyncExternalStore (module-cached per page load) instead of setState in effect; global keydown uses globalSearchKeyAction (Ctrl/Cmd+K only)
- [Phase PORTIA-20]: 20-02: local image allow-list PNG/JPEG/WebP (5 MB, 4096 px side, 12 Mpx), SVG/GIF refused; PNG card 1000 px wide, max 8000 px high, longer is refused with an HTML alternative instead of cropping
- [Phase PORTIA-20]: 20-03: spider restyled (dark opaque fills, #020706 contour, accent only in eye details); D-25 supersedes the quick 261102-d7r no-outline rule
- [Phase PORTIA-20]: 20-03 D-45: resting-spider blur on PC is caused by will-change: transform; will-change now only via .wallpaper-spider[data-spider-walking]; spiderTransform snaps resting shift to 1/dpr and drops scale()
- [Phase PORTIA-20]: 20-10: no high findings, 9 medium in release ledger; register_attempt has no caller, revoke recommended but not applied; IN-05 stays a D-09 disposition; STAB-SEC-05/06 not marked by 20-10 (ready-ids gate)
- [Phase PORTIA-20]: 20-20: legacy class names are mapped only inside normalizePortiaContent (D-36a); classificationIconFor resolves via canonicalClassificationName; nine class icons are candidates until 20-11 approval
- [Phase PORTIA-20]: 20-04: flask wallpaper accent blended 70/30 toward --desktop-base via color-mix (relative colours are forbidden); text contrast asserted over the brightest 8 px square
- [Phase PORTIA-20]: 20-04: wallpaper save failure keeps the previous wallpaper and shows a message (wallpaper only; other settings unchanged)
- [Phase PORTIA-20]: 20-21: owner chose option a; D-36b migration applied to isolated staging only (fixture verified, residual 0); production left to owner (ОЖИДАЕТ ВЛАДЕЛЬЦА)
- [Phase PORTIA-20]: 20-05: flaskEmpty/microscopeGuide are additive variants used only by info empty, news empty and guide empty; quests, archive, search, iframe error and all error panels keep the old drawings; info empty and populated news/guide stay BLOCKED (DATA)
- [Phase PORTIA-20]: 20-06: Promotion redesign appended as separate CSS blocks; E4 evidence via real-request faults only, populated/reviewer states BLOCKED (DATA/ENV)
- [Phase PORTIA-20]: 20-24: editor notes migration 20261104000100 (hash e1866a5b) applied nowhere; owner chose option a but staging availability unconfirmed, so staging checks BLOCKED (OWNER), STAB-EDIT-04 open, production ОЖИДАЕТ ВЛАДЕЛЬЦА
- [Phase PORTIA-20]: 20-16: phone layout of Информация via useSyncExternalStore(matchMedia 900px); back button in flow (not sticky, .app-window clips); expansion/Далее/search reveal BLOCKED (DATA) on target, STAB-A11Y-02/03 stay open
- [Phase PORTIA-20]: 20-07: tap area measured by elementFromPoint; start button grows only its hit area, window controls drawn at 44, taskbar label hidden by clip not display:none (accessible name kept)
- [Phase PORTIA-20]: 20-07: colour-contrast defects in Archive/Search/Trash pinned as FAIL until owner verdict D-10, not fixed (would change approved window frames); STAB-A11Y-02/04 stay open
- [Phase PORTIA-20]: 20-22: section columns of five via columnMajor; pinned add bar uses sticky (-28px PC, overflow: clip + 48px on phone); editor notes only via /api/content/notes, outside content undo; all live checks BLOCKED (ENV)/(OWNER), no requirement closed
- [Phase PORTIA-20]: 20-23: One tree model for Рекомендации keeps the flat searchRecommendations equal to the expansion of the sections and each line's own styles through write, move and delete
- [Phase PORTIA-20]: 20-23: Sections of Сводка only label entries (sectionId); removing a group sends its entries to Без раздела, broadcasts is never reordered or cut
- [Phase PORTIA-20]: 20-23: A section that disagrees with the flat list is dropped by normalizePortiaContent, flat list wins
- [Phase PORTIA-20]: 20-23: The recommendation form does not carry editor-card-columns because the D-15 test pins that class to three forms
- [Phase 20]: 20-25: webkit-phone [STAB-MEDIA-03] flake was a test defect (running fake clock, 1 s slack); portia-desktop-media.tsx untouched, test parks the clock and proves the request is held
- [Phase 20]: 20-25: expected faults are per-test DiagnosticLedger.expectFault rules judged at assertion time; global allowlist stays 11 rows; csp/pageerror/hydration never expectable
- [Phase 20]: 20-25: PW-07 (firefox-desktop page.goto no load, once, unreproducible) is a waiver ОЖИДАЕТ ВЛАДЕЛЬЦА, release gate FAIL until owner verdict; STAB-REL-01..03 and STAB-MEDIA-07 left open
- [Phase PORTIA-20]: 20-26: 97d7abb is intentional, no bypass; bank route unchanged, STAB-PROM-05 held by preview 409, version-bound token, SQL count check (6 tests)
- [Phase PORTIA-20]: 20-26: security matrix pinned to commit b88669f; later plans touching the matrix coverage paths must refresh it or lib/security-matrix.test.ts fails with stale matrix
- [Phase 20]: 20-27: UAT ledger prepared (20-UAT.md + lib/phase20-uat.test.ts); P19-GAP PASS only with residual-0 SUMMARY evidence (20, 22), others BLOCKED; OWNER-MIG rows never agent PASS; strict PORTIA_REQUIRE_UAT=1 fails until owner fills
- [Phase PORTIA-20]: 20-28: the stub lane found that Tab left the qualification window (blur failed the PC attempt on Chromium); fixed with a Tab wrap in portia-desktop.tsx. Live run and the editor keyboard-move scenario stay BLOCKED (ENV); PW-10 is a waiver awaiting the owner.
- [Phase 20]: 20-30: release gate runner is fail-closed (flaky/retry/skip/BLOCKED never PASS; waiver without owner verdict is FAIL, PW-10 pending, PW-07 accepted); first clean-checkout smoke: lint PASS, unit and typecheck FAIL because tracked lib/phase16-guard-boundary.test.ts imports untracked .claude/hooks/guard.mjs (deferred, blocks 20-13 unit/typecheck PASS)
- [Phase PORTIA-20]: 20-29: all 73 candidates recaptured on HEAD 0929a084c13d (set phase20-refresh-0929a084c13d); strict mode rejects product changes after candidates_commit — Owner must not approve stale hashes; old baselines failing for data or unisolated causes (B1-B5) stay blockers, only explained changes get rebaseline-* rows
- [Phase PORTIA-20]: 20-31: 20-15 finalizes the 20-RELEASE-NOTES.md draft (matrix_commit b88669f) instead of creating notes; STAB-A11Y-01, STAB-A11Y-03, STAB-MEDIA-07 reopened to Pending (BLOCKED sub-items listed); STAB-SEC-05 stays Complete on the 20-26 matrix; lib/phase20-requirements-ledger.test.ts blocks Complete without UAT/matrix/reconciliation proof
- [Phase PORTIA-20]: 20-11: owner accepted 79 visual rows, 4 sent back for fixes (spider on #1a1a1a, Transitium); strict gate fails on those by design; D-10 contrast fix-now needs a gap in 20-12/20-13
- [Phase PORTIA-20]: D-52: template builder in Promotion becomes a near copy of the site editor's mutation description editing (no scientist records); creating a template must not affect the main site; fix plan required before 20-37
- [Phase PORTIA-20]: 20-38: an edit that changes the template's mutation count is refused (same draft returned); id, scientist logs, image addresses and image slots are restored after every edit
- [Phase PORTIA-20]: 20-38: template export reads images only from validated local data URL slots and re-checks them; virus.infectedImage and mutation.image are never read
- [Phase PORTIA-20]: 20-35: spider redrawn per D-50 (S1-A light neutral rim #d0d0d0 in each group, S2-A strand = accent, S3-A size 72px unchanged); spider_fix_commit d7d917e
- [Phase PORTIA-20]: 20-36: flasks wallpaper is a 12-vessel lab scene (D-51); name and settings key unchanged; 96 endless animations (budget 100)
- [Phase 20]: 20-37 outcome stopped-for-fixes: owner verdict 2026-11-07 asks to fix 36 rows (16 spider, 12 flasks, 8 template builder), decisions D-53..D-57 in 20-CONTEXT.md; 39 rebaseline/other rows have no verdict; access-request gate is a deferred idea; phase 20 needs a new gap cycle before 20-12
- [Phase PORTIA-20]: 20-45 (D-57): editor launch button is the shared FormatLaunchButton; portia-editor.tsx guarded by a git sample test (449c756 + the one allowed hunk), needs full non-shallow clone; any future approved editor edit must extend the guard
- [Phase PORTIA-20]: 20-40 (D-53): spider rim layer, rule and --spider-rim token removed entirely (cancels S1-A of D-50); legs have no white, strand follows accent; dark-accent legibility comes from the white body only (owner accepts); spider_art_commit f7a1faf172a9adbe029f066027e3890a0b18a598
- [Phase PORTIA-20]: D-53 (20-41): размах каждой ноги считается из её длины (legSwingDegrees, LEG_REACH), около 9-10° у всех пар; таблицы размахов и подгиба по парам удалены — Ход стопы за опору 0.8-1.2 пути тела; задние пары на HEAD давали 0.25 и 0.49 и выглядели неподвижными
- [Phase PORTIA-20]: D-53 (20-41): волны шага выделяются emitStepWaves с приоритетом над эхом, 16 слотов, жизнь 0.9 s, одна волна на сторону тела на постановку — Спрос 6.48 x 2 x 0.9 = 11.7 слотов при 16; на HEAD 607 из 874 постановок оставались без волны (8 слотов, 4 волны на постановку)
- [Phase PORTIA-20]: D-54 (20-42): предел бесконечных анимаций рисунка колб 100 -> 140 (phone 80 с отображаемой целью); обоснование в 20-42-SUMMARY, без слияния переливов в группы
- [Phase PORTIA-20]: D-54 (20-42): часы колб под полкой справа (x 1258, y 414), чтобы рисунок оставался 55.8% высоты и телефон видел циферблат; замер пика приводит время в пределы цикла (отрицательное currentTime не принимается)
- [Phase PORTIA-20]: D-55 (20-43): предпросмотр шаблона рисует тот же VirusCardBody, что публичное досье (portia-virus-card.tsx); разметка досье побайтно прежняя; переключатель Поля/Предпросмотр, высота формы на PC 2033 -> 769 px
- [Phase PORTIA-20]: D-55 (20-43): карточка шаблона двухколоночна как у архива только в развёрнутом окне (окно Повышение 760 px < порога 840 px); особый порог отвергнут, решение за владельцем по кадрам 20-47
- [Phase PORTIA-20]: D-55 (20-44): downloaded HTML and PNG are the archive card itself (VirusCardBody markup + the card's own CSS from the site's sheets, closed policy over HTML and SVG before download); PNG is the SVG foreignObject raster at 1060 CSS px, scale 2 up to 4000 px, refusal above 8000 px
- [Phase PORTIA-20]: 20-44: typed http(s):/url( in card text is neutralised with a character reference so a typed address never blocks an export; real addresses in attributes still fail the policy
- [Phase PORTIA-20]: 20-46: D-56 в объёме D-58 выполнен; подсказки сайта сокращены или убраны, components/portia-editor.tsx не менялся; предупреждение теста на ПК (утверждено в 19) оставлено дословно
- [Phase PORTIA-20]: 20-47: owner verdict 2026-11-07: flasks rows fix (remove extra clock, animate boards and board-pinned waves), animation cap 140 and shortened D-56 texts accepted, spider rows without verdict; plan stopped-for-fixes
- [Phase PORTIA-20]: 20-47: ambiguous owner answer 4 recorded as fix for the word break Предупреждение on template-builder-preview:pc (orchestrator reading, to confirm in next gallery)
- [Phase PORTIA-20]: 20-48: манометр убран, доски и волны у доски двигаются (D-59); предел 140/80 не тронут: 136 анимаций на PC, 55 на phone; D-59 прочтения планировщика показываются владельцу в 20-54
- [Phase PORTIA-20]: D-61 (20-49): причина ложной ошибки скачивания — нативный setTimeout вызывался как метод объекта окружения (TypeError во всех движках); тесты не видели из-за поддельных часов Playwright, проверка идёт на странице с нативными таймерами
- [Phase PORTIA-20]: D-60 (20-49, толкование оркестратора): значения классов в карточке шаблона не рвутся посреди слова — колонки не уже 200 px и overflow-wrap normal только под .template-card-preview; в развёрнутом окне классы теперь в две колонки; вопрос 1 про колонки карточки открыт
- [Phase PORTIA-20]: 20-50: STAB-EDIT-01, STAB-EDIT-02 и STAB-A11Y-02 не отмечены Complete (ждут галереи 20-54); STAB-A11Y-03 возвращён в Pending (закрытие 20-49 отметило его без вердикта PC)
- [Phase PORTIA-20]: 20-50: axe редактора терпит два прежних узла (метка .nested-editor-toggle, контраст .eyebrow) по разметке узла; перенесённый блок без допусков; находки в deferred-items.md
- [Phase PORTIA-20]: 20-51: кадр картинки D-63 = три целых числа (x,y 0–100, zoom 100–300), читаются только собственные конечные числа, кадр без картинки и кадр по умолчанию отбрасываются; поля вируса и мутации вынимаются из разворота withoutNote и ставятся заново из нормализованных чисел; PortiaImage нормализует кадр вторым разом, стиль только числами
- [Phase PORTIA-20]: 20-52: владелец выбрал вариант b — фото сотрудников без выбора кадра; миграции и кода нет, 20-53 не подключает кадр к полю «Фото сотрудника»
- [Phase PORTIA-20]: 20-53: блок «Видимая часть» во всех полях картинок редактора кроме фото сотрудника (b) и фото-блока страницы карточки; предпросмотр рисует рамку сайта сам (без импорта PortiaImage: граница конструктора шаблона); сброс кадра при смене адреса в обработчике и по метке загрузки; охрана D-64 вырезает атрибуты кадра только из строк <ImageEditorField
- [Phase PORTIA-20]: 20-54: владелец 2026-11-08 принял 70 строк (колбы, паук, rebaseline, прочие, кнопка раздела в «Информации»), 16 строк на исправление: карточка шаблона (классификация как раньше, всегда две колонки) и выбор видимой части (предпросмотр с рамкой как баннер в Discord вместо ползунков); outcome stopped-for-fixes, 20-12 не запускается
- [Phase PORTIA-20]: 20-55 D-65: template card classification is the archive's grid; two columns on a PC from 584px content width; values sized by cell width (12-15px), whole word under badge; template_fix_commit d1d7b0f177522a14303171621398ed12ecd7ded5
- [Phase PORTIA-20]: 20-56: band frame is 754:63 on PC and (screen-50):63 on a phone; the dialog compares against the drawn picture where the site caps a picture (known limit for 20-57)
- [Phase PORTIA-20]: 20-57: the dialog Видимая часть keeps the Tab ring itself (keepFocusInside); native modal dialog hands focus to browser UI past the last stop. framing_fix_commit 98af387
- [Phase PORTIA-20]: D-68: галереи и таблица кадров убраны; 20-58 принят владельцем общим вердиктом 2026-11-08 на 0c2a59d1d1a7; (в) окно «Видимая часть» в конструкторе шаблона — новый todo
- [Phase PORTIA-20]: 20-12: replaced Phase 15 baselines carry class accepted-redesign/fixed-data and supersedes in phase20-baselines.json; phone-webkit stays (г), motion activity/offended BLOCKED (CAPTURE); STAB-REL-03 open
- [Phase PORTIA-20]: 20-13: release rehearsal on c11adf6 gave verdict FAIL (ui-contract-offline red, visual-approved red, visual-phase20/e2e/mutation BLOCKED); offline gates run by the runner under the offline harness; open 20-12 blockers recorded as FAIL/BLOCKED; STAB-REL-01..03 stay open
- [Phase PORTIA-20]: D-69 (20-59): release npm is explicit (--npm-cli) and recorded as 'npm: <x.y.z> (<source>)'; embedded npm 10.9.2 of the portable Node 22.13.1 is an environment fault (node-gyp/bin empty), not hidden
- [Phase PORTIA-20]: D-69 (20-59): skip by project counts only when the spec source proves a project-only condition and the same test passed without retry on another project in the same gate run; data skips and BLOCKED never count; live lanes stay strict
- [Phase PORTIA-20]: D-69 G1 (20-60): the about:srcdoc console event comes from the Playwright trace snapshotter (--trace) in the sandboxed measureCardPage frame, not from the product; expected only in the 5 PNG tests, global allowlist stays 11 rows
- [Phase PORTIA-20]: D-69 G2 (20-61): approved phone-webkit frame was taken while the closed Settings window still stood in the page flow (scrollbar 10 px, 30 px shift); removed by 7b31bdd (18-01) and 23c1c85 (quick 261104-m6g); same Playwright 1.64.1 and WebKit 27.2, so not environment; baseline replaced as accepted-redesign with supersedes ccf89983
- [Phase 20]: D-69 G3 (20-62): motion scene nondeterminism had three causes (spider head start on a post-load parked clock, endless dew phase, finite Vivian transitions) plus an aborted /api/employees; fixed by parking before load, 16 ms grid alignment and settleAnimations (Animation objects only); policy unchanged; activity/offended/recovery replaced as deterministic-capture with supersedes
- [Phase PORTIA-20]: D-69 G6: the rehearsal is repeated by one full run on f49aa00f2b98, verdict BLOCKED (environment lanes only, no FAIL of product, UI contract or baselines); the effective owner verdict is read by readEffectiveOwnerVerdict (chain owner_verdict_renews), baselines stay with 20-58
- [Phase PORTIA-20]: 20-14 (D-70): UAT ledger records the owner's refusal of device acceptance in his words; verdicts are ПРИНЯТО ВЛАДЕЛЬЦЕМ БЕЗ UAT (D-70), never PASS; 80 steps not checked, MEDIA-01 and PROMO-03 stay BLOCKED on both devices; PORTIA_REQUIRE_UAT=1 stays red (not acceptance); STAB-REL-05..08 and STAB-A11Y-01..04 not marked complete (accepted debt, statuses by 20-15)
- [Phase PORTIA-20]: 20-15: итог релиза под D-70 — худший из итога раннера и PASS-WITH-OWNER-WAIVERS (на FRC a05a6019e867 — BLOCKED); закрытие фазы «С ПРИНЯТЫМИ ДОЛГАМИ (D-70)» — допуск закрытия, не PASS
- [Phase PORTIA-20]: 20-15: 21 требование Phase 20 без доказательства на FRC записано Accepted debt (D-70) без галочки; открытые пункты Phase 18/19 — принятые долги по прочтению 20-CONTEXT.md D-70 (4); requirements.mark-complete не запускался
- [Phase PORTIA-22]: The HTTP route and the directly callable SQL function both enforce the users-tab gate.
- [Phase PORTIA-22]: Unknown, failed or stale badge counts render no badge; active-tab list responses remain authoritative.
- [Phase PORTIA-22]: Long Russian UI copy stays in lib/users-copy.ts to preserve the frozen component copy inventory.
- [Phase PORTIA-22]: Radius and tap-target tokens remain declare-only until Phase 26 applies the owner's choice C.
- [Phase PORTIA-22]: UI-01 remained BLOCKED until the owner's C decision on 2026-11-12; choosing C does not prove live database or devices.
- [Phase PORTIA-22]: Decision actors are masked inside portia_access_list; the client only renders the server value.
- [Phase PORTIA-22]: Search responses use a monotonic request epoch so an older refresh cannot replace newer results.
- [Phase PORTIA-22]: The phone action window reuses the native portia-dialog chrome and returns focus to its row.
- [Phase PORTIA-22]: Mutation controls are rendered only from server permission flags; database result codes remain authoritative and are never retried automatically.
- [Phase PORTIA-22]: Clearing a cooldown is owner-only in both the UI and POST handler before the Phase 21 RPC is called.
- [Phase PORTIA-22]: History masking and detail-key whitelisting stay inside the security-definer RPC because editors may call it directly.
- [Phase PORTIA-22]: Open history panels are keyed by nicknameKey and reload through per-key request epochs after every successful list refresh.
- [Phase PORTIA-22]: D-07 retention deletes only rows older than the newest twenty for the same nickname_key; live trigger execution remains BLOCKED (ENV).
- [Phase PORTIA-22]: Only successful roster reads enter the 20-second list cache; every approval reads the roster fresh.
- [Phase PORTIA-22]: Bulk eligibility is owner-only at both HTTP and SQL boundaries and covers all pending sheet requests, not the 50-row display slice.
- [Phase PORTIA-22]: Bulk approval is a confirmed sequential loop of ordinary level-2 decisions, each independently re-authorized and re-matched.
- [Phase PORTIA-22]: The responsive users backstop is fully mocked and aborts every non-GET request; blocked Playwright preflight is recorded as BLOCKED (ENV), never PASS.
- [Phase PORTIA-23]: 23-08: resolveGate проверяет редактора до флага закрытия; откат на open/none только при PGRST202/42883 + имя функции закрытия целым идентификатором, одно предупреждение на процесс; остальные сбои fail-closed (503). Перенос в Phase 25: пересмотреть/убрать откат и подтвердить перезагрузку кэша схемы до включения закрытия.
- [Phase PORTIA-23]: 23-09: missing closure function = closure ON (fail-closed, owner 1a); editor-first kept; unverifiable editor gets 503; poll latency not fixed (no proven code cause), owner measures on dev server
- [Phase PORTIA-23]: 23-10: closure ON by default via new forward-only migration 20261114000000 (owner 3a, overrides D-01); frozen foundation untouched; not applied anywhere (D-72)
- [Phase PORTIA-23]: 23-11: RLS23-05 (low) принята, ручной повторный запуск миграции 20261114000000 запрещён инструкцией владельцу; миграция заморожена; D-01 отменён владельцем 2026-11-14
- [Phase PORTIA-23]: 23-12: RLS23-07 and RLS23-08 (low) accepted; unauthorized client reply unchanged, owner may later choose to send unavailable
- [Phase PORTIA-24]: 24-01: closed records are left out of PortiaContent arrays and marked in content.redaction (slot HMAC, requiredLevel, at); GET /api/content is built per viewer, no-store, 401 before the row read
- [Phase PORTIA-24]: 24-01: level modules named lib/level-*.ts to stay outside the access-* import ban for components; damaged placeholder node level reads as 5
- [Phase PORTIA-24]: 24-02: reconcileSelection is one pure rule (open stays, reopened slot returns silently, else nearest closed slot in chain gives lostSlot/lostLevel, else empty); result never carries the previous record
- [Phase PORTIA-24]: 24-02: placeholder number span renamed access-redacted-number to avoid collision with the index form class
- [Phase PORTIA-24]: 24-03: lockedLevel записи учёного — нет поля = 1, целое 1-5 как есть, мусор = 5 (D-13); withheld сохраняется как true при любом значении
- [Phase PORTIA-24]: 24-03 (O-2, допущение): appLevels принадлежит разделу info в sectionOfKey; смена места — одна строка
- [Phase PORTIA-24]: 24-04: ключ зрителя editor|level-N; приём ответа по ревизии или зрителю, порядок по номеру запроса; кэш только при точном совпадении ключа; опрос 30 с посетитель, 10 с редактор
- [Phase PORTIA-24]: 24-05: formattedText посетителя - allow-list по точному id владельца; ответ собирается явно по полям; documents по зрителю из lib/embedded-documents.ts
- [Phase PORTIA-24]: 24-06: PUT refuses a viewer copy with 422 viewer-copy before any DB read/write; row stores prepared.content (levels lifted), response carries levelsRaised
- [Phase PORTIA-24]: 24-07: LevelPicker - один выбор уровня 1-5 у вируса, записей учёных и «Устава»; новая карточка без записей, новая запись с уровнем 1; охрана файла редактора расширена записью PORTIA-24
- [Phase PORTIA-24]: 24-08: строка автоподъёма принадлежит разделу и сбрасывается при смене раздела и следующем изменении уровня; contentIncomplete блокирует sync, rebase и save, accessFailed сохраняет приоритет
- [Phase PORTIA-24]: 24-09: потерянный выбор окна (slot, level) действует только при пустом id окна; reconcileSelection для вируса, Информации и Справочника вызывается из applySelections до setContent; appViewState считает записи вместе с заглушками
- [Phase PORTIA-24]: 24-10: Корзина — потерянный выбор trashLost через reconcileTrashSelection (ключи virus:<id> сопоставляются со слотами по обычному id)
- [Phase PORTIA-24]: 24-10: окно Устав читает ссылку из documents ответа; ниже уровня только блок, рамка не монтируется; закрытый Устав вне индекса поиска, иконка остаётся
- [Phase PORTIA-24]: 24-10: savedRaised приведён к UI-SPEC: Уровни приведены к иерархии: изменено k.
- [Phase PORTIA-24]: 24-11: ревью и матрица Phase 24 привязаны к коммиту a9847aa; после раунда 2 охваченные пути не правятся, RLS24-08 (комментарий proxy.ts о Set-Cookie) и RLS24-09 переданы Phase 25
- [Phase PORTIA-24]: 24-11: файл корзины kind virus с пустым или битым virusId закрыт на уровне 5 (fail-closed); прямое anon-чтение portia_content остаётся остаточным риском Phase 25 (SEC-01), transfer, не PASS
- [Phase PORTIA-25]: 25-01: read scopes content-read-v1 and employees-read-v1 reuse the 'submit' secret (domain separated from access-submit-v1); editor reads by session without signature; read failure is a single 503 with kind-only log
- [Phase PORTIA-25]: 25-01: Phase 23/24 evidence checks bounded to migration versions <= 20261114000000; later migrations covered by the Phase 25 matrix (25-10)
- [Phase PORTIA-25]: 25-02: picture address change is POST/DELETE on the existing /api/uploads (no new route); the server checks stored content and employee photos before removing a file (409 referenced, 503 unknown); editor logic lives in components/portia-image-rewrite.tsx to keep the D-64 hunk small
- [Phase PORTIA-25]: 25-03: editor paths (loadEmployees) stay live on Sheets and Roblox; only the viewer GET /api/employees uses the 5 min / 30 s server snapshot (TTL [ASSUMED], A6)
- [Phase PORTIA-25]: 25-03: snapshot holds only sheet rows and the Roblox map; stored profiles and manual rows come from the signed portia_employees_read on every request
- [Phase PORTIA-25]: 25-03: GET /api/employees answers no-store with no cache tag; purgeCacheTag(employeesCacheTag) stays in writes for one release; live CDN headers and the owner purge are BLOCKED
- [Phase PORTIA-25]: 25-04: contract migration 20261115000100 guards its own order with a DO block; outsider keeps authenticated grant (rls-empty); editors read employees by portia_can_edit(); emergency file lives in supabase/emergency/ outside the migration CLI; nothing applied (BLOCKED, owner step)
- [Phase PORTIA-25]: 25-05: content fixture is a verbatim copy of the seed (sha256 6de93dd9...2fe7 pinned); lives in lib/testing, production import banned by lib/phase25-fixture-boundary.test.ts. Assumption A-25-05: fixture keeps the real records; replacing them with invented ones is a separate owner decision
- [Phase 25]: 25-06: working code has no seed; emptyPortiaContent + assistantDefaults; visitor without readable row gets 503 content-unavailable, editor gets the empty structure; shownViewerLevel falls back gate level then 1 (WR-03). SEC-03 not checked off until the 25-09 build scan.
- [Phase PORTIA-25]: 25-07: rollout applied by variant B only (one psql file at a time, migration repair); db push is forbidden in the owner checklist because it would apply the contract before the code check (D-06)
- [Phase PORTIA-25]: 25-07: poll intervals unchanged (status 5 s, content 30 s, roster 5 min); 14,2 calls per visitor tab per minute recorded offline, owner did not answer explicitly, recommended variant kept (D-24)
- [Phase PORTIA-25]: 25-08: device cache identity = viewer key + nickname key; any change between gate answers wipes both -v2 copies (either direction), first answer wipes nothing; -v1 copies deleted on gate mount
- [Phase PORTIA-25]: 25-08: with closure off rejected and revoked read as none in accessGateLayout (D-09, D-21); closed mode unchanged

### Pending Todos

- Five legacy pending todo artifacts remain under `.planning/todos/pending/`; classify them during Phase 15 without silently folding them into scope.

### Blockers/Concerns

- [Phase 15] Existing dirty package/planning and quick/UI-review artifacts need an ownership ledger; preserve them and do not reset or absorb them automatically.
- [Phase 15] The 33 approved hashes are promoted exactly; 18 rejected candidates and 33 typed BLOCKED rows remain outside baseline authority.
- [Phase 15] Participant/editor/reviewer/owner browser lanes remain explicit BLOCKED evidence; owner declined isolated staging, so real role proof is handed to Phase 16 and no production mutation is authorized.
- [Phase 16] Dedicated isolated Supabase project/branch, credentials and disposable fixtures are not yet proven available.
- [Phase 20] Security closure uses deep GSD review and the local auth/API/RLS/header/CSP/dependency/secret matrix with no external runtime prerequisite.
- [Phase 20] Physical owner PC (including DPR 1.25) and phone UAT has not occurred and blocks milestone completion.
- [Phase 19] STAB-PROM-15 stays open: live acceptance on isolated staging (steps 1-9, 11, PC and phone) is debt for 19-14 / Phase 20; owner steps 2-8 mutated production, review of those changes is the owner's decision. 19-07 teardown of run mvz5fqgv_c40b449b is permitted by the owner's acceptance.
- [Phase 20] register_attempt RPC is granted to anon but has no caller - decide revoke or confirm purpose in the security review.
- 20-23: live proof of Сводка/Рекомендации sections is BLOCKED (ENV) (no safe staging target) and the notes steps BLOCKED (OWNER) (portia_editor_notes not applied); STAB-EDIT-02/03/04, STAB-A11Y-01/02, STAB-REL-06 stay open
- [Phase 20] Resolved (807ab9f): the guard-boundary test skips as BLOCKED (ENV) when .claude/hooks/guard.mjs is absent; clean-checkout unit and typecheck were PASS in the 20-13 rehearsal.
- [Phase 20] 20-13 rehearsal on c11adf6 = FAIL: ui-contract-offline red (srcdoc console event, cause unexplained), visual-approved red (webkit-phone 58293 px, motion vivian), visual-phase20 and e2e/mutation BLOCKED (ENV); STAB-REL-01..03 stay open; see deferred-items.md
- Phase 20: new gap cycle for D-53..D-57 (spider gait and rim, flasks animation, template builder as real card, short hints, editor format button) must run and be recaptured before 20-12; 20-12 must not run
- [v1.4] Три миграции ждут владельца и не применены ни на production, ни (последняя) на staging: `20261104000000`, `20261104000100`, `20261106000000`; новая миграция v1.4 идёт после них, порядок применения нужно записать в Phase 21.
- [v1.4] Postgres/RLS, авторизованные роли, staging, production и физические устройства BLOCKED, пока соответствующая фаза не докажет: Phase 21–24 доказывают только офлайн-стендом и тестами, Phase 25 — на предпросмотре/staging, Phase 27 — на устройствах владельца.
- [v1.4] Открытый вопрос для discuss-phase 21/22: как база узнаёт, что редактор одобряет «себя» (нужна ли редактору запись о нике); поведение Netlify-кэша (stale-while-revalidate, `Set-Cookie`) и листинг хранилища Supabase — доказывать в Phase 25.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 261102-07k | Окна: плитки держат размер, редактор листается целиком и заполняет полный экран, поиск показывает все рекомендации | 2026-11-02 | 5a8045a | [261102-07k-fix-window-resize-and-editor-scroll-layo](./quick/261102-07k-fix-window-resize-and-editor-scroll-layo/) |
| 261102-d7r | Неподвижная паутина, паук без контура и рывков, мягкое завершение анимаций ярлыков, меньше «База вирусов», плавное появление окна | 2026-11-02 | 6222cf8 | [261102-d7r-spider-web-icons-window-motion-fixes](./quick/261102-d7r-spider-web-icons-window-motion-fixes/) |
| 261104-lkn | Редактор «Повышения»: очередь, раздельные создание и выдача заданий, прокрутка и мобильная ширина | 2026-11-04 | 97d7abb, 2f54ba9 | [261104-lkn-pererabotat-interfeys-redaktora-povyshen](./quick/261104-lkn-pererabotat-interfeys-redaktora-povyshen/) |
| 261104-m6g | Мобильная ширина, кнопки и список квалификаций, GIF помощника и свой цвет | 2026-11-04 | 23c1c85, 7e5e17a | [261104-m6g-ispravit-mobilnyy-sdvig-stranitsy-pri-ot](./quick/261104-m6g-ispravit-mobilnyy-sdvig-stranitsy-pri-ot/) |
| 261109-brj | Папки фаз v1.3 перенесены в milestones/v1.3-phases, тесты и гейты релиза читают архив v1.3 | 2026-11-09 | 3bfa520, 9b3230e | [261109-brj-repoint-tests-and-scripts-to-the-v1-3-ar](./quick/261109-brj-repoint-tests-and-scripts-to-the-v1-3-ar/) |

### Roadmap Evolution

- Phase 19 edited: merged former phases 19+20 into 19 and 21+22 into 20 (owner decision 2026-11-02); requirements traceability remapped
- v1.4 roadmap created 2026-11-09: Phases 21–27 added (7 phases, 52 requirements ACC/USR/LVL/PROM/SEC/UI/UAT); Phase 21 is the first phase of the milestone

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| live_proof | Promotion RLS/RPC/concurrency and authenticated reviewer flows | Open gate in Phase 16/19 | v1.2 incomplete close |
| owner_uat | Promotion plus desktop/motion PC/phone acceptance | Open gate in Phase 19/22 | v1.2 incomplete close |
| security | Local security matrix and finding disposition | Open gate in Phase 20 | v1.2 incomplete close |
| architecture | Oversized desktop/editor composition roots | Planned for reversible extraction in Phase 17 | v1.2 incomplete close |
| verification_gaps | Phases 18, 19, 20 = gaps_found (override closeout, accepted risk) | Known Gaps in MILESTONES.md | v1.3 close 2026-11-09 |
| requirements | STAB-BASE-02/03/04/06 | Not in v1.4 scope: listed in REQUIREMENTS.md Future Requirements (owner) | v1.3 close 2026-11-09 |
| security | portia_promo_register_attempt granted to anon, no caller | Mapped to v1.4 Phase 21 (SEC-06) | v1.3 close 2026-11-09 |
| planning | Tests/scripts read .planning/REQUIREMENTS.md, ROADMAP.md, phases/PORTIA-15..20 | Repointed to v1.3 archive by quick 261109-brj | v1.3 soft close 2026-11-09 |

## Session Continuity

Last session: 2026-11-15T19:30:48.919Z
Stopped at: Completed PORTIA-25-08-PLAN.md
Resume file: None

## Operator Next Steps

- Phase 22: run phase verification against all ten plan summaries and retain explicit `BLOCKED` evidence for browser, staging, live PostgreSQL/RLS, authenticated roles and devices. Migration remains unapplied by the owner's decision; Phase 26 follows style C.
