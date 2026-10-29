---
phase: 14
slug: prilozhenie-povyshenie
status: approved
shadcn_initialized: false
preset: none
created: 2026-10-27
---

# Phase 14 — UI Design Contract

> Visual and interaction contract for the public «Повышение» application and trusted reviewer workspace.

---

## Design Intent

The application must feel like a native part of PORTIA OS, not a separate dashboard. Its tone is procedural and calm: eligibility, queue state, deadlines and consequences are explicit, while security internals, reviewer identity and test answers remain invisible. Dynamic effects are limited to short status transitions and obey `html[data-motion]`.

Eligibility is always the server's current projection of `Portia!A61:E85`. The interface shows only the resulting access/title/cooldown state and never exposes raw rows or technical range details to the participant.

The participant surface has one dominant next action. The reviewer surface is denser but keeps one selected record and one primary action at a time. Ordinary promotion tasks and qualification checks must never share labels, progress bars or action buttons that could make them look like one workflow.

## Design System

| Property | Value |
|----------|-------|
| Tool | Existing hand-written React + CSS |
| Preset | PORTIA OS dark terminal |
| Component library | none |
| Icon library | existing `PortiaIcon`, add one `promotion` icon on the same 24px/1.75 stroke grid |
| Interface font | `var(--sans)` / IBM Plex Mono stack |
| Long instructions | `var(--doc)` / Golos Text stack |
| Numeric time | `var(--mono)` with tabular numerals |

No shadcn, Radix, external icon set or new styling dependency is introduced.

## Information Architecture

### Participant window «Повышение»

1. **Identity gate** — nickname input, short privacy/device-binding notice, primary CTA «ПРОВЕРИТЬ НИК».
2. **Current state** — identity header, title, next title, anti-speedrun availability, and exactly one ordinary-promotion card plus one qualification card when applicable.
3. **Active ordinary promotion** — request state or immutable task checklist; no qualification language.
4. **Active qualification** — request state, pre-start warning, active test, submitted/waiting, result or retake date.
5. **Recent results** — compact maximum-three list, collapsed below active state.

### Reviewer tab «Повышение»

Top-level tabs, in this order:

1. **ЗАПРОСЫ** — queues for ordinary promotion and qualification, visible counters.
2. **ЗАДАНИЯ** — banks grouped by target title and configured issue count.
3. **КВАЛИФИКАЦИЯ** — test banks, question-type counts, active reviews and retake controls.

Within «ЗАПРОСЫ», ordinary promotion and qualification are separate filters with distinct badges. Never place both action sets in the same card.

## Layout Contracts

### Desktop participant window

- Default geometry: approximately `760 × 620px`; minimum `620 × 480px`.
- Content width: `min(680px, 100%)`, centered, with a single scroll container below the window titlebar.
- Identity header remains visible at the top of content while scrolling active tasks or test history.
- State cards use a single column. Two-column dashboards are prohibited: they weaken the single-next-action hierarchy.

### Desktop reviewer workspace

- Uses the existing full editor window and `.editor-tabs` pattern.
- At `>= 900px`, request workbench uses `280px minmax(0, 1fr)`: queue on the left, selected request on the right.
- Bank screens use `260px minmax(0, 1fr) minmax(220px, 0.65fr)` for group navigation, item editor and preview only when space permits.
- Claim state is displayed in both queue row and detail header so stale visual state cannot imply edit rights.

### Phone

- Participant application fills the available window body and uses one column with `16px` side padding.
- Reviewer queue, detail and preview become sequential views with a compact back button in the top-left; no horizontal squeeze or hidden side panel.
- Fixed controls use `env(safe-area-inset-bottom)` and may contain only the current primary action plus one secondary action.
- Test question, answer control and navigation fit in one vertical scroll region; the 15-minute timer remains sticky under the titlebar.

## Spacing Scale

Declared values are multiples of 4:

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Badge internals, icon/text micro-gap |
| sm | 8px | Inline controls, compact queue rows |
| md | 16px | Card padding on phone, field groups |
| lg | 24px | Desktop card padding and section gaps |
| xl | 32px | Major participant-state separation |
| 2xl | 48px | Empty-state breathing room |

Exceptions: existing 28px window controls and inherited 7px/5px corner radii remain unchanged for consistency.

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14px | 400 | 1.55 |
| Long task/question copy | 15px | 400 | 1.65 (`var(--doc)`) |
| Label / status | 11px | 700 | 1.35, uppercase, `.06em` letter spacing |
| Card heading | 18px | 700 | 1.25 |
| Window heading | `clamp(27px, 4vw, 42px)` | 700 | 1.08 |
| Timer | 24px | 700 | 1, tabular numerals |

- Uppercase is reserved for tabs, badges, compact labels and buttons; paragraphs and error explanations use normal case.
- No body text below 12px and no interactive label below 11px.
- Long nicknames and bank names use ellipsis in lists and wrap in detail views.

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | existing `--bg`, `--panel` | Window and content surfaces |
| Secondary (30%) | existing `--panel-2`, subtle white alpha surfaces | Cards, queue rows, editor work areas |
| Accent (10%) | `--teal`, `--teal-dim`, `--teal-soft` | Primary action, selected tab, active/available status, focus ring, timer while healthy |
| Warning | existing `--warning` | Cooldown, timer below 03:00, pending reviewer attention |
| Destructive | existing `--danger` / `#e07d74` family | Failed state, connection/focus violation, delete/reset confirmation |
| Success | `--teal` plus text/icon | Passed/approved; never color alone |

Accent is reserved for current selection, primary CTA, active eligibility, focus and healthy countdown. It is not applied to every button or every border.

Every state combines color with a text label or icon. Contrast must remain valid under custom accent colors; warning and destructive states do not inherit the custom accent.

## Component Contracts

### `PromotionIdentityGate`

- One labelled nickname field, autocomplete off, spellcheck off, max length aligned with sheet nickname rules.
- Device-binding notice appears before submission: «Первая заявка закрепит этот ник за устройством. Сменить его сможет проверяющий.»
- Loading disables submission and keeps entered text.
- Neutral device refusal never includes the bound nickname.

### `PromotionStatusCard`

- Eyebrow identifies `ОБЫЧНОЕ ПОВЫШЕНИЕ` or `КВАЛИФИКАЦИЯ`.
- Contains one plain-language status sentence, relevant date/countdown and one next action.
- States: unavailable, available, requested, claimed, assigned/ready, awaiting review, passed, failed, retake wait.
- Ordinary and qualification cards use distinct icons and nouns, not merely different colors.

### Reviewer queue

- Queue row: nickname, request kind, target title/transition, age, status badge.
- Claimed rows display «В РАБОТЕ» and no active mutation affordance for other reviewers.
- Detail opens read-only until the atomic «ВЗЯТЬ ЗАПРОС» succeeds.
- On claim conflict, keep the card open, refresh state and show «Запрос уже взят другим проверяющим.»

### Bank editor and preview

- Left navigation groups banks by target title/transition and shows `active / required` counts.
- Item list supports active toggle, edit and delete with labels; drag handles are optional, explicit move controls must remain keyboard-accessible.
- Random build opens a preview panel listing the exact immutable snapshot order.
- Preview actions: primary «ПОДТВЕРДИТЬ НАБОР»; secondary «ПЕРЕСОБРАТЬ»; per-item «ЗАМЕНИТЬ».
- Confirmation is disabled with a visible explanation when active pool size or type quotas are insufficient.

### Qualification runner

- Pre-start view states that permission starts the timer immediately; participant does not get a second start button.
- Sticky timer shows `MM:SS`, server-derived; warning style below 03:00 and destructive style below 01:00.
- Progress is `ВОПРОС 3 ИЗ 10`, never a clickable stepper.
- Single-choice uses radio controls; multiple-choice uses checkboxes; free text uses a labelled textarea with a visible character counter if a limit applies.
- Primary action «ОТПРАВИТЬ И ДАЛЬШЕ» requires a valid answer and cannot navigate backward.
- On server acceptance, the previous question disappears before the next payload is rendered.
- On timeout, focus/visibility violation, page exit or connection loss, replace question UI with a terminal failure state; never leave editable controls behind.

### Grading workspace

- Shows one answer at a time or a vertically grouped review list, with question and participant answer but no participant-facing answer-key projection.
- Each answer has mutually exclusive «ВЕРНО» / «НЕВЕРНО» controls.
- Percentage is derived and displayed separately from final decision.
- Final actions remain explicit: «ЗАСЧИТАТЬ ПРОВЕРКУ» and «НЕ ЗАСЧИТЫВАТЬ».
- Technical automatic failure has a visible reason and separate «ОТМЕНИТЬ АВТОПРОВАЛ» action.

## Interaction and State Contracts

- All irreversible actions use the existing `ConfirmDialog` pattern: issue immutable set, finalize pass/fail, reset device binding, release retake early, delete bank item.
- Destructive confirmations name the nickname and action, but public participant messages remain neutral.
- Refresh and polling never close the selected reviewer card. If server state changes, controls become read-only and an inline status explains why.
- Public status polling pauses while the document is hidden except during an active desktop test, where hiding immediately reports failure.
- Reduced-motion mode removes lifts, pulses and sliding transitions; status changes use opacity only or no animation.
- No automatic focus stealing after background refresh. After explicit navigation, focus moves to the new view heading.

## Copywriting Contract

| Element | Copy |
|---------|------|
| Identity heading | «ПРОВЕРИТЬ ПОВЫШЕНИЕ» |
| Identity CTA | «ПРОВЕРИТЬ НИК» |
| Ordinary request CTA | «ПОДАТЬ ЗАЯВКУ НА ЗАДАНИЯ» |
| Qualification request CTA | «ЗАПРОСИТЬ КВАЛИФИКАЦИЮ» |
| Claim CTA | «ВЗЯТЬ ЗАПРОС» |
| Neutral rejection | «Заявка отклонена.» |
| Device conflict | «Это устройство уже связано с другим участником. Обратитесь к проверяющему.» |
| Nick absent | «Ник не найден в списке PORTIA. Проверьте написание или обратитесь к руководителю.» |
| Sheet unavailable | «Список участников временно недоступен. Попробуйте позже — заявка не отправлена.» |
| Empty queue heading | «НОВЫХ ЗАПРОСОВ НЕТ» |
| Empty queue body | «Оставьте вкладку открытой — список обновится автоматически.» |
| Insufficient bank | «Недостаточно активных элементов: требуется {N}, доступно {M}.» |
| Test warning | «После разрешения проверяющего начнутся 15 минут. На ПК уход со вкладки, потеря фокуса или соединения завершат попытку.» |
| Timeout | «Время истекло. Проверка завершена и передана проверяющему.» |
| Connection failure | «Соединение прервано. Попытка завершена и передана проверяющему.» |
| Retake wait | «Повторная проверка доступна {date} в {time}.» |
| Three-day hint | «Незавершённые данные удаляются через 3 дня.» |
| Device reset confirmation | «СБРОСИТЬ ПРИВЯЗКУ: после сброса на этом устройстве можно будет закрепить другой ник.» |

Errors always state what happened and the safe next step. They never reveal another nickname, answer key, reviewer identity, internal note, IP/risk signal or future question.

## Accessibility Contract

- Every input has a visible label; placeholders are examples only.
- Tabs use correct tab semantics or existing accessible button-tab pattern with `aria-pressed`.
- Status updates use one polite live region; timeout/failure uses assertive announcement once.
- Timer is not announced every second. Announce only 5 minutes, 3 minutes, 1 minute and expiration.
- All controls meet 40px minimum hit target; phone primary controls target 44px.
- Queue and bank operations are fully keyboard accessible; drag is never the only ordering method.
- Focus is trapped only in confirmation dialogs, not in application windows.
- Desktop anti-cheat warning is readable before the reviewer starts the test.

## Responsive and Failure Matrix

| Situation | Required UI response |
|-----------|----------------------|
| Nick removed from sheet | Immediately replace content with access-lost state; no stale tasks/test controls remain. |
| Sheet unavailable | Non-destructive retry state; never render “not found”. |
| Device rate-limited | Neutral message plus server-derived remaining wait; input and submit disabled. |
| Claim race lost | Refresh detail to read-only claimed state without closing it. |
| Bank changed after preview | Confirmation detects stale version and requests a new preview. |
| Test reload | Server state decides outcome; no client-only restoration or timer reset. |
| Desktop hide/blur | Immediate terminal state after best-effort report; server reconciles on next request. |
| Phone rotation | Preserve current question text and unsent local answer; timer remains server-derived. |
| Poll/fetch failure | Keep last safe non-sensitive state, label it stale, disable irreversible actions. |

## Motion Contract

- Full motion: cards may enter with `opacity + translateY(4px)` over 160ms; active badge may use one 220ms emphasis when state changes.
- Timer never pulses continuously. At one minute it receives a static destructive border.
- No celebratory particles. Passed state uses one subtle check draw/fade up to 300ms.
- Reduced motion: remove transforms and animated icon internals; keep instantaneous state/color changes.

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| None | Existing project components only | No third-party registry or package installation |

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS — every primary, empty, error and destructive state has explicit Russian copy.
- [x] Dimension 2 Visuals: PASS — participant, reviewer, bank, test, grading and responsive layouts are specified.
- [x] Dimension 3 Color: PASS — semantic roles use existing tokens; accent and destructive usage are bounded and never color-only.
- [x] Dimension 4 Typography: PASS — fonts, scale, weights, line heights and casing rules are explicit.
- [x] Dimension 5 Spacing: PASS — 4px scale, desktop/phone geometry and touch targets are explicit.
- [x] Dimension 6 Registry Safety: PASS — no registry components or new UI dependencies.

**Approval:** approved 2026-10-27
