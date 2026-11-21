import type { SVGProps } from "react";
import { canonicalClassificationName } from "@/lib/portia-content";

export type PortiaIconName =
  | "search" | "virus" | "employees" | "broadcasts" | "info" | "guide"
  | "settings" | "promotion" | "charter" | "sheet" | "trash" | "editor" | "template"
  | "class-hephaestus" | "class-proteus" | "class-apeiron"
  | "class-nomos" | "class-theseus" | "class-abraxas"
  | "class-warning" | "class-risk" | "class-esnov"
  | "class-lucidium" | "class-transitium" | "class-oblivium"
  | "class-stabilar" | "class-impulsar" | "class-infernar"
  | "class-isomorph" | "class-polymorph" | "class-xenomorph"
  | "route-droplet" | "route-dust" | "route-contact" | "route-oral" | "route-sexual" | "route-unknown"
  | "route-vector" | "route-blood"
  | "lock-open" | "lock-closed";

// Classification badges: the 18 signs of the six axes are the owner's round-5 drawing (26-ICON-DECISION.md, «Геометрия»),
// each <symbol> copied verbatim into JSX. One base sign per axis; the level reads from growing distortion, there is no separate
// level mark. Line 1.5 (not the 1.75 of the other icons); the filled parts carry stroke="none" so the root stroke does not swell them.
// Routes of transmission are not levelled, so each is its own small picture without a frame.
// Owner 2026-11-20 (OWN-03, clarification 11): the old route icons are back as they were (root line 1.75, the drop helper below); «Гемоконтактный» had none
// and is drawn in their style: drop(), dots with fill="currentColor", minor lines with opacity=".55", no colours, no dashes.
// Owner 2026-11-21, item 19: «Аэрозольный» shows the old dust icon (route-dust); «Трансмиссивный» keeps the 26.1-03 route-vector drawing.
const drop = (x: number, y: number, k: number) => <path d={`M${x} ${y}c${-k} ${1.3 * k} ${-1.5 * k} ${2.1 * k} ${-1.5 * k} ${2.8 * k}a${1.5 * k} ${1.5 * k} 0 0 0 ${3 * k} 0c0 ${-0.7 * k} ${-0.5 * k} ${-1.5 * k} ${-1.5 * k} ${-2.8 * k}Z`} />;
// Access locks (sketch #locks-a): a padlock whose shackle swings aside when open.
const lockBody = <><rect x="5" y="10.5" width="14" height="10" rx="2" /><circle cx="12" cy="14.6" r="1.3" /><path d="M12 15.9v2" /></>;

// One 24px grid, one stroke weight; colour comes from the theme through currentColor.
const iconPaths: Record<PortiaIconName, React.ReactNode> = {
  search: <>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.4 15.4 5.1 5.1" />
    <path d="M7.6 8c1.9.6 3.9 2.4 5.8 5M13.4 8c-1.9.6-3.9 2.4-5.8 5" />
  </>,
  virus: <>
    <circle className="icon-virus-scan" cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" strokeDasharray="2 2.6" opacity="0" />
    <circle className="icon-virus-core" cx="12" cy="12" r="5" />
    <path className="icon-virus-spikes" d="M12 7V3.5M12 20.5V17M7 12H3.5M20.5 12H17M8.5 8.5 6 6M18 18l-2.5-2.5M8.5 15.5 6 18M18 6l-2.5 2.5" />
    <g className="icon-virus-tips" fill="currentColor" stroke="none"><circle cx="12" cy="3" r=".9" /><circle cx="12" cy="21" r=".9" /><circle cx="3" cy="12" r=".9" /><circle cx="21" cy="12" r=".9" /></g>
    <circle className="icon-virus-detail" cx="10.5" cy="11" r="1.1" /><path className="icon-virus-detail" d="M13.6 13.2h.01" />
  </>,
  employees: <>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19.5c.6-3.3 2.8-5.2 5.5-5.2s4.9 1.9 5.5 5.2" />
    <circle cx="16.6" cy="9.2" r="2.6" />
    <path d="M15.6 14.4c2.6-.4 4.5 1.3 5 4.6" />
  </>,
  broadcasts: <>
    <circle className="icon-broadcast-beacon" cx="12" cy="11" r="1.6" />
    <path className="icon-broadcast-signal icon-broadcast-signal-inner" d="M8.6 14.4a4.8 4.8 0 0 1 0-6.8M15.4 7.6a4.8 4.8 0 0 1 0 6.8" />
    <path className="icon-broadcast-signal icon-broadcast-signal-outer" d="M5.8 17.2a8.8 8.8 0 0 1 0-12.4M18.2 4.8a8.8 8.8 0 0 1 0 12.4" />
    <path className="icon-broadcast-mast" d="M12 12.6 9.5 21h5L12 12.6Z" />
  </>,
  info: <>
    <path className="icon-info-page" d="M6 3.5h8.5L19 8v12.5H6Z" />
    <path className="icon-info-fold" d="M14.5 3.5V8H19" />
    <g className="icon-info-lines"><path d="M9 12h7" /><path d="M9 15h7" /><path d="M9 18h4.5" /></g>
  </>,
  guide: <>
    <path className="icon-guide-back" d="M3.5 17.5v-10A1.5 1.5 0 0 1 5 6h4.2l2 2.2H19a1.5 1.5 0 0 1 1.5 1.5v7.8" />
    <path className="icon-guide-front" d="M3.5 10.5h17v7A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5Z" />
  </>,
  settings: <>
    <path className="icon-settings-rails" d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" />
    <circle className="icon-settings-knob icon-settings-knob-a" cx="15" cy="7" r="2" />
    <circle className="icon-settings-knob icon-settings-knob-b" cx="9" cy="12" r="2" />
    <circle className="icon-settings-knob icon-settings-knob-c" cx="17" cy="17" r="2" />
  </>,
  promotion: <>
    <path className="icon-promotion-base" d="M5 19.5h14" />
    <path className="icon-promotion-level icon-promotion-level-low" d="M7 16.5h10" opacity=".65" />
    <path className="icon-promotion-level icon-promotion-level-high" d="M8.5 13.5h7" opacity=".65" />
    <path className="icon-promotion-arrow" d="M12 13V4.5m0 0L8.8 7.7M12 4.5l3.2 3.2" />
  </>,
  template: <>
    {/* Owner 2026-11-18: «Шаблон» — a dossier sheet with a photo frame and two text lines; its cycle tilts the sheet, develops the photo and slides the lines in. */}
    <path className="icon-template-sheet" d="M6.5 3.5h11a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z" />
    <rect className="icon-template-photo" x="8.5" y="6.5" width="7" height="5.5" rx=".5" />
    <path className="icon-template-lines" d="M8.5 15h7M8.5 17.8h4.5" />
  </>,
  charter: <>
    <path d="M7 4.5H5.5v16h13v-16H17" />
    <rect x="8.5" y="3" width="7" height="3" rx="1" />
    <path d="M8.5 10.5h7M8.5 13.5h7" />
    <circle cx="14.5" cy="17.2" r="1.8" /><path d="M8.5 16.5h3" />
  </>,
  sheet: <>
    <rect x="4" y="4" width="16" height="16" rx="1.5" />
    <path d="M4 9h16M4 14h16M10 9v11" />
  </>,
  trash: <>
    <path d="M4.5 6.5h15M9.5 6.5V4h5v2.5" />
    <path d="m6.5 6.5 1 14h9l1-14" />
    <path d="M10.2 10v7M13.8 10v7" />
  </>,
  editor: <>
    <path d="M5 4v16M5 7h3M5 12h5M5 17h3" />
    <path d="m19.5 6.5-7.8 7.8-.9 3.1 3.1-.9 7.8-7.8a1.6 1.6 0 0 0-2.2-2.2Z" />
  </>,
  "class-hephaestus": <><g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13.73 5.25L19.8 15.75A2 2 0 0 1 18.07 18.75L5.93 18.75A2 2 0 0 1 4.2 15.75L10.27 5.25A2 2 0 0 1 13.73 5.25Z" /></g><g fill="currentColor" stroke="none"><path d="M10.25 13.25A1.75 1.75 0 1 0 13.75 13.25A1.75 1.75 0 1 0 10.25 13.25Z" /></g></>,
  "class-proteus": <><g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13.73 5.25L19.8 15.75A2 2 0 0 1 18.07 18.75L5.93 18.75A2 2 0 0 1 4.2 15.75L10.27 5.25A2 2 0 0 1 13.73 5.25Z" /><path d="M12 13.25L14.86 11.6" /><path d="M12 13.25L12 16.55" /><path d="M12 13.25L9.14 11.6" /></g><g fill="currentColor" stroke="none"><path d="M10.25 13.25A1.75 1.75 0 1 0 13.75 13.25A1.75 1.75 0 1 0 10.25 13.25Z" /></g></>,
  "class-apeiron": <><g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13.73 5.25L19.8 15.75A2 2 0 0 1 18.07 18.75L5.93 18.75A2 2 0 0 1 4.2 15.75L10.27 5.25A2 2 0 0 1 13.73 5.25Z" /><path d="M12 13.25L19.14 9.13" /><path d="M12 13.25L12 21.5" /><path d="M12 13.25L4.86 9.13" /></g><g fill="currentColor" stroke="none"><path d="M9.75 13.25A2.25 2.25 0 1 0 14.25 13.25A2.25 2.25 0 1 0 9.75 13.25Z" /></g></>,
  "class-nomos": <><g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5.25 12L10.48 9.06" /><path d="M15.25 5.25A2 2 0 1 0 19.25 5.25A2 2 0 1 0 15.25 5.25Z" /><path d="M5.25 12L10.48 14.94" /><path d="M15.25 18.75A2 2 0 1 0 19.25 18.75A2 2 0 1 0 15.25 18.75Z" /></g><g fill="currentColor" stroke="none"><path d="M3 12A2.25 2.25 0 1 0 7.5 12A2.25 2.25 0 1 0 3 12Z" /></g></>,
  "class-theseus": <><g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5.25 12L15.51 6.23" /><path d="M15.25 5.25A2 2 0 1 0 19.25 5.25A2 2 0 1 0 15.25 5.25Z" /><path d="M5.25 12L15.51 17.77" /><path d="M15.25 18.75A2 2 0 1 0 19.25 18.75A2 2 0 1 0 15.25 18.75Z" /></g><g fill="currentColor" stroke="none"><path d="M3 12A2.25 2.25 0 1 0 7.5 12A2.25 2.25 0 1 0 3 12Z" /></g></>,
  "class-abraxas": <><g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5.25 12L15.51 6.23" /><path d="M17.25 5.25L21.78 2.7" /><path d="M5.25 12L15.51 17.77" /><path d="M17.25 18.75L21.78 21.3" /></g><g fill="currentColor" stroke="none"><path d="M3 12A2.25 2.25 0 1 0 7.5 12A2.25 2.25 0 1 0 3 12ZM15 5.25A2.25 2.25 0 1 0 19.5 5.25A2.25 2.25 0 1 0 15 5.25ZM15 18.75A2.25 2.25 0 1 0 19.5 18.75A2.25 2.25 0 1 0 15 18.75Z" /></g></>,
  "class-warning": <><g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 3.75H19.5" /><path d="M4.5 20.25H19.5" /><path d="M6.75 3.75V20.25" /><path d="M17.25 3.75V20.25" /></g><g fill="currentColor" stroke="none"><path d="M9.75 12A2.25 2.25 0 1 0 14.25 12A2.25 2.25 0 1 0 9.75 12Z" /></g></>,
  "class-risk": <><g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 3.75H19.5" /><path d="M4.5 20.25H19.5" /><path d="M6.75 3.75V20.25" /><path d="M17.25 3.75Q21.75 12 17.25 20.25" /></g><g fill="currentColor" stroke="none"><path d="M12.35 12A2.25 2.25 0 1 0 16.85 12A2.25 2.25 0 1 0 12.35 12Z" /></g></>,
  "class-esnov": <><g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 3.75H19.5" /><path d="M4.5 20.25H19.5" /><path d="M6.75 3.75V20.25" /><path d="M17.25 3.75Q17.25 7 19.6 7.8" /><path d="M17.25 20.25Q17.25 17 19.6 16.2" /></g><g fill="currentColor" stroke="none"><path d="M17.75 12A2.25 2.25 0 1 0 22.25 12A2.25 2.25 0 1 0 17.75 12Z" /></g></>,
  "class-lucidium": <><g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21.5V17.4A7.5 7.5 0 1 1 17.95 13.3L19.9 14.8L17.8 15.7L17 18.6L14.5 19.6V21.5" /><path d="M7.6 10.5A3.4 3.4 0 1 0 14.4 10.5A3.4 3.4 0 1 0 7.6 10.5Z" /></g></>,
  "class-transitium": <><g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21.5V17.4A7.5 7.5 0 1 1 17.95 13.3L19.9 14.8L17.8 15.7L17 18.6L14.5 19.6V21.5" /><path d="M7.6 10.5A3.4 3.4 0 1 0 14.4 10.5A3.4 3.4 0 1 0 7.6 10.5Z" /></g><g fill="currentColor" stroke="none"><path d="M9.8 10.5A1.2 1.2 0 1 0 12.2 10.5A1.2 1.2 0 1 0 9.8 10.5Z" /></g></>,
  "class-oblivium": <><g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21.5V17.4A7.5 7.5 0 1 1 17.95 13.3L19.9 14.8L17.8 15.7L17 18.6L14.5 19.6V21.5" /><path d="M11 10.5A1.4 1.4 0 0 1 13.8 10.5A2.8 2.8 0 0 1 8.2 10.5A4.2 4.2 0 0 1 16.6 10.5" /></g></>,
  "class-isomorph": <><g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8.2 7A3.8 3.8 0 1 0 15.8 7A3.8 3.8 0 1 0 8.2 7Z" /><path d="M5 21V19A4 4 0 0 1 9 15H15A4 4 0 0 1 19 19V21" /></g></>,
  "class-polymorph": <><g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8.3 6.8A3.7 4.4 0 1 0 15.7 6.8A3.7 4.4 0 1 0 8.3 6.8Z" /><path d="M5 21V19A4 4 0 0 1 9 15H12A5.6 5.6 0 0 1 20.8 17.6V21" /></g></>,
  "class-xenomorph": <><g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6.6A3.3 5 0 1 0 14.6 6.6A3.3 5 0 1 0 8 6.6Z" /><path d="M5 21V19A4 4 0 0 1 9 15H12A5.6 5.6 0 0 1 20.8 17.6V21" /><path d="M17.4 9A2 2.6 0 1 0 21.4 9A2 2.6 0 1 0 17.4 9Z" /></g></>,
  "class-stabilar": <><g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 12A8.5 8.5 0 1 0 20.5 12A8.5 8.5 0 1 0 3.5 12Z" /><path d="M7.5 10H10.5" /><path d="M13.5 10H16.5" /><path d="M9 15.5H15" /></g></>,
  "class-impulsar": <><g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 12A8.5 8.5 0 1 0 20.5 12A8.5 8.5 0 1 0 3.5 12Z" /><path d="M7.5 8.6L10.5 10.6" /><path d="M16.5 8.6L13.5 10.6" /><path d="M8.8 16.4A5 5 0 0 1 15.2 16.4" /></g></>,
  "class-infernar": <><g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.5L14.98 4.79L18.72 5.28L19.21 9.02L21.5 12L19.21 14.98L18.72 18.72L14.98 19.21L12 21.5L9.02 19.21L5.28 18.72L4.79 14.98L2.5 12L4.79 9.02L5.28 5.28L9.02 4.79Z" /><path d="M7.2 8L10.6 10.8" /><path d="M16.8 8L13.4 10.8" /><path d="M8.4 16.2L10.2 14.6L12 16.2L13.8 14.6L15.6 16.2" /></g></>,
  "route-droplet": <>{drop(9, 3.5, 2.6)}{drop(16.5, 11, 1.7)}<path d="M5 20.5h14" opacity=".55" /></>,
  "route-dust": <><path d="M3.5 9.5h9.2a2.6 2.6 0 1 0-2.6-2.6M3.5 14h12.4a2.6 2.6 0 1 1-2.6 2.6" /><circle cx="18.6" cy="7.4" r=".9" fill="currentColor" /><circle cx="20.4" cy="11.6" r=".9" fill="currentColor" /><circle cx="7" cy="19.2" r=".9" fill="currentColor" /></>,
  "route-contact": <><rect x="3.6" y="5.2" width="10" height="10" rx="2.2" /><rect x="10.4" y="8.8" width="10" height="10" rx="2.2" /></>,
  "route-oral": <>{drop(12, 2.6, 1.3)}<path d="M5.6 9.6h12.8l-1.5 9.6a1.8 1.8 0 0 1-1.8 1.5H8.9a1.8 1.8 0 0 1-1.8-1.5Z" /><path d="M7.6 13h8.8" opacity=".55" /></>,
  "route-sexual": <><circle cx="9.2" cy="12" r="5.4" /><circle cx="14.8" cy="12" r="5.4" /></>,
  "route-unknown": <><circle cx="12" cy="12" r="8.5" strokeDasharray="2.2 2.6" /><path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.9v.4" /><circle cx="12" cy="16.9" r=".9" fill="currentColor" /></>,
  "route-vector": <><g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="6.2" r="1.3" /><path d="M12 4.9V2.4" /><ellipse cx="12" cy="10.5" rx="2.2" ry="2.2" /><ellipse cx="12" cy="16.8" rx="1.7" ry="3.4" /><path d="M10 9.6C7 6.6 4.5 7 3.8 9C4.2 11 7.5 11.5 10 10.8" /><path d="M14 9.6C17 6.6 19.5 7 20.2 9C19.8 11 16.5 11.5 14 10.8" /><path d="M9.8 12.4L4.8 14.2" /><path d="M10.3 14.6L6.2 19.2" /><path d="M14.2 12.4L19.2 14.2" /><path d="M13.7 14.6L17.8 19.2" /></g></>,
  "route-blood": <><g transform="rotate(-45 12 12)"><path d="M2.5 12H7" /><rect x="7" y="9.6" width="10" height="4.8" rx="1" /><path d="M17 8.4v7.2M17 12h4M21 9.8v4.4" /><path d="M10 9.6v1.6M12.5 9.6v1.6M15 9.6v1.6" opacity=".55" /></g>{drop(5, 19.6, .65)}</>,
  "lock-open": <>{lockBody}<path d="M8 10.5V7.5a4 4 0 0 1 7.7-1.6" /></>,
  "lock-closed": <>{lockBody}<path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></>,
};

// The badge for each canonical term (lib/portia-content.ts). The badge sits beside the term, never instead of it.
export const classificationIcon: Record<string, PortiaIconName> = {
  "Гефест": "class-hephaestus", "Протей": "class-proteus", "Апейрон": "class-apeiron",
  "Номос": "class-nomos", "Тезей": "class-theseus", "Абраксас": "class-abraxas",
  "Предупреждение": "class-warning", "Риск": "class-risk", "Эснов": "class-esnov",
  "Люцидиум": "class-lucidium", "Транзитиум": "class-transitium", "Обливиум": "class-oblivium",
  "Изоморф": "class-isomorph", "Полиморф": "class-polymorph", "Ксеноморф": "class-xenomorph",
  "Стабилар": "class-stabilar", "Импульсар": "class-impulsar", "Инфернар": "class-infernar",
  "Аэрозольный": "route-dust","Контактно-бытовой": "route-contact", "Фекально-оральный": "route-oral",
  "Трансмиссивный": "route-vector", "Гемоконтактный": "route-blood", "Половой путь": "route-sexual", "Неизвестно": "route-unknown",
};

// Content values are editor input: own keys only, so "constructor" or "__proto__" never resolve to a prototype member.
export function classificationIconFor(value: string): PortiaIconName | undefined {
  const name = canonicalClassificationName(value);
  return Object.hasOwn(classificationIcon, name) ? classificationIcon[name] : undefined;
}

export function PortiaIcon({ name, ...props }: { name: PortiaIconName } & SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{iconPaths[name]}</svg>;
}

// flaskEmpty and microscopeGuide are the only empty-state drawings: every app shows them wherever information is missing
// (empty lists, no search matches, error panels, a missing picture). The old dish, flask and microscope drawings are gone.
export type PortiaIllustrationName = "flaskEmpty" | "microscopeGuide";

// Empty-state drawings on a 96px grid, in the same line language as the icons.
const illustrations: Record<PortiaIllustrationName, React.ReactNode> = {
  flaskEmpty: <>
    <path d="M36 12h24M41 12v22L21.6 69.2A7 7 0 0 0 27.7 80h40.6a7 7 0 0 0 6.1-10.8L55 34V12" />
    <path d="M27.7 58c4.5-3 9 3 13.5 0s9 3 13.5 0 9 3 13.5 0L74.4 69.2a7 7 0 0 1-6.1 10.8H27.7a7 7 0 0 1-6.1-10.8Z" fill="currentColor" fillOpacity=".16" stroke="none" />
    <path d="M27.7 58c4.5-3 9 3 13.5 0s9 3 13.5 0 9 3 13.5 0" opacity=".8" />
    <path d="M46 20h4M46 27h6" opacity=".6" />
    <circle cx="40" cy="70" r="3" /><circle cx="56" cy="72.5" r="2" /><circle cx="49" cy="65" r="1.5" opacity=".7" />
    <circle cx="48" cy="45" r="2" opacity=".6" /><circle cx="51.5" cy="38.5" r="1.2" opacity=".5" />
    <path d="M16 86h64" opacity=".45" />
  </>,
  microscopeGuide: <>
    <path d="M22 86h52M28 86v-7h38v7" />
    <path d="M52.5 28c16 0 25 12 24.5 28-.5 10-8 18-15 23" />
    <g transform="translate(46 32) rotate(-22)">
      <rect x="-6" y="-17" width="12" height="34" rx="2" />
      <rect x="-4" y="-23" width="8" height="6" rx="1.5" />
      <path d="M-3 17v6h6v-6" />
    </g>
    <path d="M34 63h42" />
    <rect x="40" y="59" width="18" height="4" rx="1" opacity=".7" />
    <circle cx="49" cy="72" r="3" opacity=".7" /><path d="M49 67v-2" opacity=".6" />
    <circle cx="72" cy="44" r="4" opacity=".7" />
  </>,
};

export function PortiaIllustration({ name, ...props }: { name: PortiaIllustrationName } & SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 96 96" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-illustration={name} {...props}>{illustrations[name]}</svg>;
}
