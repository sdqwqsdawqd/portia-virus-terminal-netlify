import type { SVGProps } from "react";
import { canonicalClassificationName } from "@/lib/portia-content";

export type PortiaIconName =
  | "search" | "virus" | "employees" | "broadcasts" | "info" | "guide"
  | "settings" | "promotion" | "charter" | "sheet" | "trash" | "editor"
  | "class-hephaestus" | "class-proteus" | "class-apeiron"
  | "class-nomos" | "class-theseus" | "class-abraxas"
  | "class-warning" | "class-risk" | "class-esnov"
  | "class-lucidium" | "class-transitium" | "class-oblivium"
  | "class-stabilar" | "class-impulsar" | "class-infernar"
  | "class-isomorph" | "class-polymorph" | "class-xenomorph"
  | "route-droplet" | "route-dust" | "route-contact" | "route-oral" | "route-sexual" | "route-unknown"
  | "lock-open" | "lock-closed";

// Classification badges (sketch #badges-b): one shape per class line, 1-3 inner marks for the level.
const dangerShape = <path d="m12 3.2 7.6 4.4v8.8L12 20.8l-7.6-4.4V7.6Z" />;
const spreadShape = <circle cx="12" cy="12" r="8.5" />;
const escapeShape = <path d="M12 3.5 21 19.5H3Z" />;
const dot = (x: number) => <circle key={x} cx={x} cy="12" r=".9" fill="currentColor" />;
const chevron = (y: number) => <path key={y} d={`M10.2 ${y}l1.8-1.8 1.8 1.8`} />;
// The additional line (D-39) is drawn as pictures, not as framed badges: mind is a brain that goes out, behaviour a line
// that gets restless and then burns, appearance a cell that grows arms and then a torn DNA helix. The level reads from the shape.
const brainHalf = <path d="M12 4.6C10.8 3.2 8.6 3.4 7.6 4.9 5.7 4.8 4.4 6.4 4.8 8 3.4 8.9 3.3 10.8 4.3 12 3.9 13.7 4.9 15.3 6.5 15.6 7 17.3 8.9 18.2 10.4 17.5 10.9 18 11.5 18.6 12 19.2" />;
const brainFolds = <path d="M4.8 8.2c1.2-.2 2.1.3 2.5 1.2M8.2 11.2c1.2-.4 2.3.1 2.7 1.1M6.5 15.6c.4-1.1 1.4-1.8 2.5-1.7" />;
const brainSpine = <path d="M12 4.6v14.6" />;
const mirrored = (children: React.ReactNode) => <g transform="matrix(-1 0 0 1 24 0)">{children}</g>;
const helixHalf = (y: number) => <>
  <path d={`M8 ${y}c0 3.5 8 3.5 8 8M16 ${y}c0 3.5-8 3.5-8 8`} />
  <path d={`M9.2 ${y + 2.2}h5.6`} />
</>;
// Routes of transmission are not levelled, so each is its own small picture without a frame.
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
  "class-hephaestus": <>{dangerShape}<path d="M12 9v6" /></>,
  "class-proteus": <>{dangerShape}<path d="M10 9v6M14 9v6" /></>,
  "class-apeiron": <>{dangerShape}<path d="M8.6 9v6M12 9v6M15.4 9v6" /></>,
  "class-nomos": <>{spreadShape}{[12].map(dot)}</>,
  "class-theseus": <>{spreadShape}{[10, 14].map(dot)}</>,
  "class-abraxas": <>{spreadShape}{[8.5, 12, 15.5].map(dot)}</>,
  "class-warning": <>{escapeShape}{[16.4].map(chevron)}</>,
  "class-risk": <>{escapeShape}{[14.4, 17.2].map(chevron)}</>,
  "class-esnov": <>{escapeShape}{[12.6, 15.2, 17.8].map(chevron)}</>,
  "class-lucidium": <>{brainHalf}{brainFolds}{mirrored(<>{brainHalf}{brainFolds}</>)}{brainSpine}<path d="M12 1v1.6M5.6 2.2l1 1.1M18.4 2.2l-1 1.1" /></>,
  "class-transitium": <>{brainHalf}{brainFolds}{brainSpine}<g strokeDasharray="2 2.4">{mirrored(brainHalf)}</g><g>{mirrored(brainFolds)}</g></>,
  "class-oblivium": <g strokeDasharray="2.2 2.8">{brainHalf}{mirrored(brainHalf)}{brainSpine}</g>,
  "class-isomorph": <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3" /><circle cx="16.4" cy="8.4" r=".9" fill="currentColor" /></>,
  "class-polymorph": <><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.7" /><path d="M15.5 8.5 18.6 5.4M8.5 8.5 5.4 5.4M8.5 15.5 5.4 18.6M15.5 15.5l3.1 3.1" /><circle cx="19.4" cy="4.6" r="1.3" /><circle cx="4.6" cy="4.6" r="1.3" /><circle cx="4.6" cy="19.4" r="1.3" /><circle cx="19.4" cy="19.4" r="1.3" /></>,
  "class-xenomorph": <>{helixHalf(3)}{helixHalf(13)}</>,
  "class-stabilar": <><path d="M5.5 12h13" /><circle cx="3" cy="12" r=".9" fill="currentColor" /><circle cx="21" cy="12" r=".9" fill="currentColor" /><path d="M8 7.5h8M8 16.5h8" opacity=".45" /></>,
  "class-impulsar": <path d="M2.5 12h4l2.2-6.5 3.6 13 2.6-8.5 1.2 2h5.4" />,
  "class-infernar": <><path d="M2.5 15.5h7.2" /><path d="M14 3.5c.5 3 4.6 5 4.6 9.4a4.6 4.6 0 0 1-9.2 0c0-1.6.8-2.7 1.5-3.6.2 1.3.8 2.1 1.5 2.5C12.2 9 12.5 6 14 3.5Z" /><path d="M14 14c.8.9 1.3 1.5 1.3 2.3a1.3 1.3 0 0 1-2.6 0c0-.8.5-1.4 1.3-2.3Z" /></>,
  "route-droplet": <>{drop(9, 3.5, 2.6)}{drop(16.5, 11, 1.7)}<path d="M5 20.5h14" opacity=".55" /></>,
  "route-dust": <><path d="M3.5 9.5h9.2a2.6 2.6 0 1 0-2.6-2.6M3.5 14h12.4a2.6 2.6 0 1 1-2.6 2.6" /><circle cx="18.6" cy="7.4" r=".9" fill="currentColor" /><circle cx="20.4" cy="11.6" r=".9" fill="currentColor" /><circle cx="7" cy="19.2" r=".9" fill="currentColor" /></>,
  "route-contact": <><rect x="3.6" y="5.2" width="10" height="10" rx="2.2" /><rect x="10.4" y="8.8" width="10" height="10" rx="2.2" /></>,
  "route-oral": <>{drop(12, 2.6, 1.3)}<path d="M5.6 9.6h12.8l-1.5 9.6a1.8 1.8 0 0 1-1.8 1.5H8.9a1.8 1.8 0 0 1-1.8-1.5Z" /><path d="M7.6 13h8.8" opacity=".55" /></>,
  "route-sexual": <><circle cx="9.2" cy="12" r="5.4" /><circle cx="14.8" cy="12" r="5.4" /></>,
  "route-unknown": <><circle cx="12" cy="12" r="8.5" strokeDasharray="2.2 2.6" /><path d="M9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.2 1-1.2 1.9v.4" /><circle cx="12" cy="16.9" r=".9" fill="currentColor" /></>,
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
  "Воздушно-капельный": "route-droplet", "Воздушно-пылевой": "route-dust", "Контактно-бытовой": "route-contact",
  "Фекально-оральный": "route-oral", "Половой": "route-sexual", "Неизвестно": "route-unknown",
};

// Content values are editor input: own keys only, so "constructor" or "__proto__" never resolve to a prototype member.
export function classificationIconFor(value: string): PortiaIconName | undefined {
  const name = canonicalClassificationName(value);
  return Object.hasOwn(classificationIcon, name) ? classificationIcon[name] : undefined;
}

export function PortiaIcon({ name, ...props }: { name: PortiaIconName } & SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{iconPaths[name]}</svg>;
}

// flaskEmpty and microscopeGuide are the D-21 drawings for three chosen empty states only («Информация», «Новостей пока нет», «Справочник»).
// flask, microscope and dish keep their old drawings for quests, trash, archive, search and every error panel.
export type PortiaIllustrationName = "dish" | "microscope" | "flask" | "flaskEmpty" | "microscopeGuide";

// Empty-state drawings on a 96px grid, in the same line language as the icons.
const illustrations: Record<PortiaIllustrationName, React.ReactNode> = {
  dish: <>
    <ellipse cx="48" cy="56" rx="36" ry="13" />
    <path d="M12 56v6c0 7.2 16.1 13 36 13s36-5.8 36-13v-6" />
    <ellipse cx="48" cy="50" rx="30" ry="9" strokeDasharray="3 5" opacity=".6" />
    <circle cx="36" cy="54" r="2.5" /><circle cx="56" cy="51" r="3.5" /><circle cx="62" cy="57" r="1.8" /><circle cx="44" cy="58" r="1.5" />
    <path d="M48 22v10M44 26h8" opacity=".7" />
  </>,
  microscope: <>
    <path d="M24 82h48M34 82v-8h28v8" />
    <path d="M40 74c-8-4-11-12-9-21" />
    <path d="m46 14 10 5-12 24-10-5Z" />
    <path d="M40 43l-3 7 6 3 3-7M51 16l3-6" />
    <path d="M50 56h18M58 56v18" />
    <circle cx="66" cy="42" r="5" opacity=".7" />
  </>,
  flask: <>
    <path d="M40 14h16M43 14v22L24 72a6 6 0 0 0 5.3 9h37.4a6 6 0 0 0 5.3-9L53 36V14" />
    <path d="M30 62c8-4 14 4 22 0s12-3 16 0" opacity=".7" />
    <circle cx="44" cy="70" r="2.5" /><circle cx="55" cy="73" r="1.8" /><circle cx="50" cy="52" r="1.5" opacity=".6" />
  </>,
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
