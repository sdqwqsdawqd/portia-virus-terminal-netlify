# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Members of the Portia roleplay squad** in the Roblox game "Kurodzakura". Portia is one of the game's simpler directions; its in-game work is virology research, creating super soldiers ("СС") and bioweapons, and passing tests. Members open the site to read virus dossiers, rules and lore, and to see the squad roster.
- **Squad leadership (owner + granted editors)** maintain the content through the built-in editor: viruses, info sections, broadcasts, recycle-bin files, assistant phrases and employee profiles.
- Most visitors come from a PC, but the site must work fully on phones too.
- Many visitors know only Russian.

## Product Purpose

PORTIA OS is the squad's archive presented as the desktop of a scientific station terminal. It is equally an immersion piece (it should feel like a real in-world terminal, with information delivered as in-world documents) and a working reference (finding a virus, a rule or an employee must stay quick and easy). Neither side may be sacrificed for the other.

Success: members use it as the source of truth for viruses and squad information, and leadership can update it themselves without code.

## Positioning

An in-world station terminal built specifically around Portia's own virus classification, scientist logs with clearance levels, and a live roster synced from the squad's working spreadsheet and Roblox accounts. It is the squad's archive, not a generic wiki.

## Operating Context

- The roster comes from the squad's Google Sheet (sheet "Portia", 34 numbered staff slots) and is enriched with Roblox avatars; it refreshes automatically.
- Editors work in the in-site editor (Settings → Open editor); changes are stored in Supabase and appear for everyone.
- Hosted on Netlify, deployed from the GitHub `main` branch.

## Capabilities and Constraints

- Desktop metaphor with app windows: virus database, global search, broadcasts ("Сводка"), information, employees, charter ("Устав"), sheet ("Таблица"), recycle bin, settings, and an assistant character.
- Virus classification uses fixed in-world terms: main line Гефест / Протей / Апейрон; spread Номос / Тезей / Абраксас; threat Предупреждение / Риск / Эснов; plus mind, behaviour and appearance scales (see `lib/portia-content.ts`).
- Scientist logs: 0–5 per virus; level II is readable, levels III and IV appear locked.
- Per-device settings (background, colour, shortcut size and position) are stored in the browser.
- Interface language: Russian only.
- Stack: Next.js on Netlify, Supabase for data, auth and media.

## Brand Commitments

- Name: PORTIA / PORTIA OS; logo and icons in `public/assets/`.
- In-world voice: station terminal and laboratory documents.
- Part of the "Kurodzakura" Roblox game world.

## Evidence on Hand

- Real content in Supabase: viruses, information sections, broadcasts, recycle-bin files.
- Real roster: Google Sheet + Roblox avatars (16 employees at the time of writing).
- Assets: `public/assets/` (app icons, logo, assistant, virus icon, background).
- No testimonials, statistics or external claims exist; do not invent them.

## Product Principles

1. Immersion and usefulness are equal: every in-world flourish must leave search and reading fast.
2. Leadership edits content without code; anything visitors see should be editable or synced, not hard-coded.
3. The squad's own terms and classification are canon; do not rename or simplify them.
4. PC first, but nothing may be PC-only.
5. Write for Russian-only readers.

## Accessibility & Inclusion

- Russian-only audience: all UI text, errors and help must be in plain Russian.
- Full use on phone touch screens, not only with mouse and keyboard.
