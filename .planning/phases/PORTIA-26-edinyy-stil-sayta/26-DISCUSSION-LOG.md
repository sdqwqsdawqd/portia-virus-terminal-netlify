# Phase 26: Единый стиль сайта - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-16
**Phase:** 26-Единый стиль сайта
**Areas discussed:** Развёрнутое окно, Иконки классов, Порядок экранов и «одна переделка», «Информация» на телефоне, Снимки v1.3

Questions were asked as numbered text (owner preference), one per turn.

---

## Развёрнутое окно

| Question | Options | Selected |
|---|---|---|
| Lists in a maximized window | 1 auto-fill card grid / 2 rows capped ~900px centred / 3 two panes | 1 |
| Buttons and fields | 1 content-width buttons, inputs ~640px, 2-column forms / 2 one centred column / 3 Claude decides | 1 |
| Anything else differs? | 1 only layout (8px inset, 10px radius stay) / 2 edge-to-edge, no radius / 3 no radius, 8px inset | 1 |
| Which windows | 1 all windows and apps / 2 owner names them / 3 Claude audits and lists | 1 |

## Иконки классов

| Question | Options | Selected |
|---|---|---|
| How to show variants | 1 one claude.ai artifact page / 2 PNG in chat / 3 text only | 1 |
| How many styles | 1 three: А line, Б filled, В emblem / 2 two: line and fill / 3 owner describes | 1 |
| Level visible on the icon | 1 shared base + notches/dots / 2 each icon by meaning / 3 show both | 1 |
| Rounds | 1 one round / 2 two rounds / 3 per-group style mix | 1 |

## Порядок экранов и «одна переделка»

| Question | Options | Selected |
|---|---|---|
| What is a «screen» | 1 each window/app and each editor tab / 2 big blocks / 3 whole site | 1 |
| Order | 1 shared elements first, then screens / 2 most seen first / 3 most annoying first | 1 |
| Editor tab model | 1 new shared layout / 2 existing tab as model / 3 Claude decides | 1 |
| «Перелистывание и разделы» | 1 section navigation / 2 long forms scrolling / 3 both / 4 owner describes | 3 |

**Notes:** owner added on the layout question: «сделать удобные кнопки и дизайн, улучшение перелистования и разделов, вкладку повышения и т.д.»

## «Информация» на телефоне

| Question | Options | Selected |
|---|---|---|
| Button placement | 1 thin bar above article, scrolls away / 2 same bar fixed / 3 floating corner button | 1 |
| How the list opens | 1 inline, pushes article down / 2 bottom sheet / 3 dropdown overlay | 1 |
| Search hits when closed | 1 count on the button + highlight in list / 2 auto-open on search / 3 highlight only | 1 |

## Снимки v1.3

| Question | Options | Selected |
|---|---|---|
| What to do with v1.3 approved snapshots | 1 freeze as history, no new signed reference / 2 recapture new reference / 3 remove from checks | 1 |

## Claude's Discretion

- Shortcut labels at 521–900px (UI-09) mechanism.
- Grid card size, two-column breakpoint, sticky action bar details.
- axe fixes and contrast checks (UI-10); regressions verification order (UI-11).
- Evolution of the radius guard test.

## Deferred Ideas

- None new — discussion stayed within phase scope.
