import type { SVGProps } from "react";

export type PortiaIconName =
  | "search" | "virus" | "employees" | "broadcasts" | "info"
  | "settings" | "charter" | "sheet" | "trash" | "editor"
  | "class-hephaestus" | "class-proteus" | "class-apeiron"
  | "class-nomos" | "class-theseus" | "class-abraxas"
  | "class-warning" | "class-risk" | "class-esnov"
  | "class-rubedo" | "class-albedo" | "class-nigredo"
  | "class-nyktea" | "class-morfea" | "class-dedalea"
  | "class-fobus" | "class-areus" | "class-selenus"
  | "route-droplet" | "route-dust" | "route-contact" | "route-oral" | "route-sexual" | "route-unknown"
  | "lock-open" | "lock-closed";

// Classification badges (sketch #badges-b): one shape per class line, 1-3 inner marks for the level.
const dangerShape = <path d="m12 3.2 7.6 4.4v8.8L12 20.8l-7.6-4.4V7.6Z" />;
const spreadShape = <circle cx="12" cy="12" r="8.5" />;
const escapeShape = <path d="M12 3.5 21 19.5H3Z" />;
const dot = (x: number) => <circle key={x} cx={x} cy="12" r=".9" fill="currentColor" />;
const chevron = (y: number) => <path key={y} d={`M10.2 ${y}l1.8-1.8 1.8 1.8`} />;
// The additional line follows the same rule: mind is a diamond with lines of thought, appearance a pentagon
// with mutation crosses, behaviour a rounded square with tremor waves.
const mindShape = <path d="M12 3.2 20.8 12 12 20.8 3.2 12Z" />;
const lookShape = <path d="M12 3.4 20.4 9.5 17.2 19.4H6.8L3.6 9.5Z" />;
const moodShape = <rect x="4.2" y="4.2" width="15.6" height="15.6" rx="3.6" />;
const dash = (y: number) => <path key={y} d={`M9.4 ${y}h5.2`} />;
const cross = ([x, y]: [number, number]) => <path key={`${x} ${y}`} d={`M${x - 1.5} ${y}h3M${x} ${y - 1.5}v3`} />;
const wave = (y: number) => <path key={y} d={`M7.6 ${y}q2.2-2 4.4 0t4.4 0`} />;
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
    <circle cx="12" cy="12" r="5" />
    <path d="M12 7V3.5M12 20.5V17M7 12H3.5M20.5 12H17M8.5 8.5 6 6M18 18l-2.5-2.5M8.5 15.5 6 18M18 6l-2.5 2.5" />
    <circle cx="12" cy="3" r=".9" fill="currentColor" /><circle cx="12" cy="21" r=".9" fill="currentColor" />
    <circle cx="3" cy="12" r=".9" fill="currentColor" /><circle cx="21" cy="12" r=".9" fill="currentColor" />
    <circle cx="10.5" cy="11" r="1.1" /><path d="M13.6 13.2h.01" />
  </>,
  employees: <>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 19.5c.6-3.3 2.8-5.2 5.5-5.2s4.9 1.9 5.5 5.2" />
    <circle cx="16.6" cy="9.2" r="2.6" />
    <path d="M15.6 14.4c2.6-.4 4.5 1.3 5 4.6" />
  </>,
  broadcasts: <>
    <circle cx="12" cy="11" r="1.6" />
    <path d="M8.6 14.4a4.8 4.8 0 0 1 0-6.8M15.4 7.6a4.8 4.8 0 0 1 0 6.8M5.8 17.2a8.8 8.8 0 0 1 0-12.4M18.2 4.8a8.8 8.8 0 0 1 0 12.4" />
    <path d="M12 12.6 9.5 21h5L12 12.6Z" />
  </>,
  info: <>
    <path d="M6 3.5h8.5L19 8v12.5H6Z" />
    <path d="M14.5 3.5V8H19" />
    <path d="M9 12h7M9 15h7M9 18h4.5" />
  </>,
  settings: <>
    <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" />
    <circle cx="15" cy="7" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="17" r="2" />
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
  "class-rubedo": <>{mindShape}{[12].map(dash)}</>,
  "class-albedo": <>{mindShape}{[10.6, 13.4].map(dash)}</>,
  "class-nigredo": <>{mindShape}{[9.4, 12, 14.6].map(dash)}</>,
  "class-nyktea": <>{lookShape}{([[12, 13]] as [number, number][]).map(cross)}</>,
  "class-morfea": <>{lookShape}{([[9.6, 13.4], [14.4, 13.4]] as [number, number][]).map(cross)}</>,
  "class-dedalea": <>{lookShape}{([[12, 9.8], [8.9, 14.8], [15.1, 14.8]] as [number, number][]).map(cross)}</>,
  "class-fobus": <>{moodShape}{[12.6].map(wave)}</>,
  "class-areus": <>{moodShape}{[10.8, 14.6].map(wave)}</>,
  "class-selenus": <>{moodShape}{[9, 12.6, 16.2].map(wave)}</>,
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
  "Рубедо": "class-rubedo", "Альбедо": "class-albedo", "Нигредо": "class-nigredo",
  "Нюктея": "class-nyktea", "Морфея": "class-morfea", "Дедалея": "class-dedalea",
  "Фобус": "class-fobus", "Ареус": "class-areus", "Селенус": "class-selenus",
  "Воздушно-капельный": "route-droplet", "Воздушно-пылевой": "route-dust", "Контактно-бытовой": "route-contact",
  "Фекально-оральный": "route-oral", "Половой": "route-sexual", "Неизвестно": "route-unknown",
};

// Content values are editor input: own keys only, so "constructor" or "__proto__" never resolve to a prototype member.
export function classificationIconFor(value: string): PortiaIconName | undefined {
  return Object.hasOwn(classificationIcon, value) ? classificationIcon[value] : undefined;
}

export function PortiaIcon({ name, ...props }: { name: PortiaIconName } & SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{iconPaths[name]}</svg>;
}

export type PortiaIllustrationName = "dish" | "microscope" | "flask";

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
};

export function PortiaIllustration({ name, ...props }: { name: PortiaIllustrationName } & SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 96 96" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{illustrations[name]}</svg>;
}
