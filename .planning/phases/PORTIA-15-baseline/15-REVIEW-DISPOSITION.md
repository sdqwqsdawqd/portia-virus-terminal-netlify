---
phase: 15
source: 15-REVIEW.md
review_commit: c958827
updated: 2026-11-01
closure_plans: [15-17, 15-18, 15-19]
---

# Phase 15 — диспозиция находок code review

12 находок: 0 critical, 6 warning, 6 info. Исправлены: WR-03, WR-04, WR-05, WR-06, IN-05 (5). Частично: IN-01 (1). Отложены: WR-01, WR-02, IN-02, IN-03, IN-04 (5). Открыта: IN-06 (1, нужен ответ владельца). G1-G5 этой диспозицией не меняются и остаются открытыми.

Закрывающие планы: 15-17 (preflight), 15-18 (visual policy), 15-19 (CSP guard и эта диспозиция). Закрыты только находки, исправимые в репозитории; остальные ждут своих фаз.

## W1 (верификатор): исключение из правила Phase 15 о product source

Коммит b535d14 (Plan 15-03) изменил два файла product source: `components/portia-desktop.tsx` (`role="toolbar"`, a11y) и `next.config.ts` (флаг `PORTIA_E2E_ALLOW_HTTP`, снимающий `upgrade-insecure-requests` для локального HTTP-сервера Playwright). Правило ROADMAP «Do not modify product source in Phase 15» этим нарушено.

Фиксация владельцем: принято решением владельца Qloxz в рамках scope-решения 2026-11-01 (закрывать только исправимые в репозитории находки); решение передано оркестратором в сессии планирования gap closure 15-17..15-19. Отдельного письменного подтверждения текста исключения от владельца нет; формулировка здесь опирается на это scope-решение.

Визуально нейтрально: 33 утверждённых PNG подтверждаются `--verify-promotion`, байты не менялись.

Дальнейшие правки product source в рамках того же исключения касаются только `next.config.ts`: 29d2e01 (флаг игнорируется при `NETLIFY=true`) и 140a265 (Plan 15-19, Task 1: флаг игнорируется и при любом непустом Netlify `CONTEXT`, включая сборки CLI, плюс поведенческий тест `lib/security-headers.test.ts` по семи комбинациям окружения). Планы 15-17 и 15-18 product source не меняли.

Остаток (принят, T-15-50): не-Netlify хостинг или ручная выкладка локальной сборки с флагом. Сайт работает только на Netlify (корневой README), HSTS отправляется всегда, пункт release checklist Phase 22 (переменная не задана в окружении Netlify) остаётся в SEC-L5.

## Диспозиция

| ID | Severity | Disposition | Reason |
|----|----------|-------------|--------|
| WR-01 | warning | deferred | Непрозрачный proof имеет смысл только вместе с производителем server-probe (G1). Производителя нет, привилегированные дорожки BLOCKED, ложного pass нет. Phase 16. |
| WR-02 | warning | deferred | Снижение допусков и сужение маски требуют замера шума браузерными прогонами на утверждённых baseline. `application:employees` зависит от живых данных (G2), motion от замены кандидатов (G4). Утверждённые PNG не меняются. Phase 18 (motion и visual), данные в Phase 16. |
| WR-03 | warning | fixed | Plan 15-17, 22f8818 (preflight судит цель мутации по shell-окружению, снимок до `loadEnvConfig`; вариант shell-only), тест в `lib/e2e-preflight.test.ts` на одноразовом каталоге с env-файлом (тот же коммит), bbf2a55 (README). |
| WR-04 | warning | fixed | Plan не требовался, 30faeab: preflight отказывает с `production-target`, если ref из `NEXT_PUBLIC_SUPABASE_URL` есть в `PORTIA_E2E_PRODUCTION_PROJECT_IDS`; тест в `lib/e2e-preflight.test.ts`. |
| WR-05 | warning | fixed | Plan 15-17, 22f8818 (комментарий над regex) и 4e30bd1 (тест закрепляет пин Node 22.13.x и `engines.node` `>=22.13.0 <23`), bbf2a55 (README). Пин 22.13.x намеренный по ROADMAP и 15-RESEARCH, поэтому исправлена документация и тест, а не версия. |
| WR-06 | warning | fixed | Plan 15-17, 22f8818 и 4e30bd1: preflight принимает publishable или anon ключ с приоритетом `lib/supabase/env.ts`; тесты в `lib/e2e-preflight.test.ts`; `.env.example` согласован (22f8818), README (bbf2a55). |
| IN-01 | info | partial | Plan 15-18, 7bc7f48: явная проверка компаратора с кодом `PORTIA_VISUAL_COMPARATOR_MISSING`, комментарий с пином 1.64.1, тест в `lib/e2e-visual-policy.test.ts`. Прикрепление diff при падении открыто до Phase 18 вместе с WR-02, потому что доказывается только браузерным прогоном. |
| IN-02 | info | deferred | Общий motion-driver меняет путь утверждённых motion-сравнений; 18 motion-кандидатов заменяются в Phase 18, рефакторинг делается там. |
| IN-03 | info | deferred | Повторный запуск preflight в воркерах косметический и без браузерного прогона не проверяется. Отказ от проверки ключей сборки при внешнем `PORTIA_E2E_BASE_URL` ослабляет gate и снимает deny-list WR-04: это решение о безопасности для Phase 16, когда появится staging-цель. |
| IN-04 | info | deferred | `--promote-approved` единственный писатель утверждённых PNG; текущее поведение fail-closed. Следующий реальный запуск это промоция заменённых кандидатов в Phase 18, менять и доказывать вместе с ним. |
| IN-05 | info | fixed | Plan 15-18, 0203844: тесты `visualPolicy` на фиктивном Page в `lib/e2e-visual-policy.test.ts`, мёртвый `assertVisualDiffAllowed` удалён. |
| IN-06 | info | open | (1) Authority снимков window-search в firefox-desktop: решение владельца, его нельзя записать в подписанный `15-FRAME-TEST-MAP.md` без явного ответа. (2) Операторские списки проектов: принятое допущение fail-closed guard, удалённая проверка через Management API в Phase 16. |
