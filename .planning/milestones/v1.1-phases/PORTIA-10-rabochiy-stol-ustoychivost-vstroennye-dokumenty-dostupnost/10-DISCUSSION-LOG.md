# Phase 10: Рабочий стол: устойчивость, встроенные документы, доступность - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-25
**Phase:** 10-Рабочий стол: устойчивость, встроенные документы, доступность
**Areas discussed:** Custom accent colour, Empty-data fallbacks, Tooltips, Embeds & zoom

---

## Custom accent colour

| Question | Options | Selected |
|----------|---------|----------|
| Tint backgrounds like presets? | Same as presets / Bright parts only | Same as presets |
| Very dark, near-white or grey pick? | Quietly adjust / Use exactly / Warn in picker | Quietly adjust |
| Placement | 5th button «Свой» / «+» only | 5th button «Свой» |
| When applied | Live while dragging / On confirm | Live while dragging |
| Remember after switching to a preset? | Remember / Forget | Remember |
| No flash on boot? | Yes / Brief flash fine | Yes |
| Picker controls | Exactly the editor's / + suggestions | Exactly the editor's |
| Storage scope | Per device / Site-wide | Per device |

---

## Empty-data fallbacks

| Question | Options | Selected |
|----------|---------|----------|
| Empty/deleted tip | Skip, pick another / Stock phrase | Skip; no bubble if none left |
| Missing window text | Empty body / Muted note | Empty body |
| Open bubble's tip deleted | Close quietly / Keep old text | Close quietly |
| Whitespace-only tip | Treat as empty / Show it | Treat as empty |
| Other missing data | Never crash, show what exists / Only the named cases | Never crash |

---

## Tooltips

| Question | Options | Selected |
|----------|---------|----------|
| Kind | Plain `title` / Styled PORTIA tooltip | Plain `title` |
| Roblox portrait text | «Открыть профиль Roblox» / «Профиль Roblox: {ник}» | «Профиль Roblox: {ник}» |
| ≡ handle text | Long hint / «Перетащить» | Free text: "no text" → clarified: no tooltip on ≡ |
| Portrait without Roblox ID | No tooltip / Explain | No tooltip |

**Notes:** The owner dropped the ≡ handle tooltip, which narrows A11Y-02.

---

## Embeds & zoom

| Question | Options | Selected |
|----------|---------|----------|
| Sandbox breaks something | Widen that frame's flags / Strict / Drop sandbox | Widen flags |
| YouTube fullscreen | Keep / Drop | Keep |
| Cmd on Mac | Ctrl only / Keep Cmd on Mac | Keep Cmd on Mac (changes ZOOM-01) |
| Reset announcement | Action + percent / Percent only | Percent only |

---

## Claude's Discretion

ROB-03 side-effect extraction, TEST-01 constant placement and test, A11Y-01 roles and Escape, colour maths for the custom accent, exact sandbox flags.

## Deferred Ideas

None.
