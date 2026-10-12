---
version: 1
slug: "components-portia-desktop-tsx"
primary_target: "components/portia-desktop.tsx"
related_targets: ["components/portia-editor.tsx","app/portia.css"]
---

# PORTIA OS — lab assistant desktop + editor

Scope: the whole app shell (desktop, windows, taskbar, app windows) and the built-in editor. Mode: Operate.

Audience/job: Portia squad members read dossiers, rules, roster (PC first, phone must work, Russian only). Leadership edits viruses, info, broadcasts, recycle bin, desktop shortcuts, employee profiles without code.

Constraints (user-pinned): it stays the PORTIA OS desktop of a lab assistant's computer; keep the existing dark-teal palette (#07100f ground, #0d1917/#11201e panels, #00bca6 teal, #efb84e warning, #d55449 danger); squad emblem is a spider whose legs are DNA strands. Change: desktop look, icons, fonts, editor ergonomics (records, order, desktop shortcuts, long forms, clear save state, less scrolling, simpler text formatting).

## Direction contract

THESIS: Every ordered thing in PORTIA is a gel lane: records are bands at numbered positions, order is moved by moving a band, and an unsaved change is a band still running. Refuses the generic dark admin (sidebar + table) and the neon-terminal costume.

OWN-WORLD: Existing dark-teal ground and panels; teal only for live/selected/saved, amber for running (unsaved), red for destructive. Golos Text for UI, Unbounded only for window and dossier titles, JetBrains Mono for codes, positions, clock. Line icons drawn on one 24px grid with lab forms (flask, gel lane, helix, dossier, roster); spider-with-DNA-legs mark in the top bar and start button. Service labels one size; rank by weight and case (from timetable). Desktop icons snap to whole grid cells (from doujin catalog).

STORY: A visitor opens the lab assistant's desktop and finds the archive as apps. An editor opens the editor, sees at once how many changes are running, picks a record on the lane, edits one section at a time, drags the band to a new position, and saves once.

FIRST VIEWPORT: Desktop with top bar (spider mark, PORTIA OS, status, clock), icon grid on the left in cells, dark-teal taskbar. Editor window: header with the run bar ("N изменений не сохранено", Отменить, Сохранить всё) always visible; tabs per content type with counts; left lane of numbered bands with drag handles and up/down buttons; right the selected record as one fixed-scale plate split into section tabs. Changed records keep an amber dashed band until saved (from boarding pass); the lane stays visible while a record is open (from transit).

FORM: assigned direction, position 3 of the grounded list. seed: none (unavailable)

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
