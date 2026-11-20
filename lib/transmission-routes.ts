// OWN-03 (owner 2026-11-20): the routes of transmission of a virus.
// A virus may have several routes. They live in the existing string field `classification.transmission`, joined by ", " in the
// owner's order, without repeats; «Неизвестно» is a seventh, separate choice that is stored alone (decision option-b of 26.1-03).
// Nothing outside this file reads the string by hand: parse, format and canonicalTransmission are the only readers and writers.
// This module is pure: it imports nothing, so lib/portia-content.ts, the normalizer and the editor can all use it.

export type TransmissionRoute = { readonly name: string; readonly description: string };

// The six routes, names and descriptions word for word from the owner (26.1-OWNER-REQUEST.md, «Пути передачи»). Not levelled.
export const TRANSMISSION_ROUTES: readonly TransmissionRoute[] = Object.freeze([
  { name: "Аэрозольный", description: "Вирусы передаются через капли слюны или слизи, выделяемые при кашле, чихании или разговоре. Крупные капли быстро оседают на поверхностях, а мелкие могут часами оставаться в воздухе." },
  { name: "Контактно-бытовой", description: "Прямое прикосновение к больному или заражённым предметам и поверхностям." },
  { name: "Фекально-оральный", description: "Возбудители из кишечника попадают в фекалии, а затем через рот будущего носителя." },
  { name: "Трансмиссивный", description: "Вирус передается через укусы кровососущих насекомых и паукообразных, таких как комары, клещи или блохи." },
  { name: "Гемоконтактный", description: "Заражение происходит при прямом попадании вируса в кровоток. Это случается при использовании нестерильных игл и инструментов." },
  { name: "Половой путь", description: "Контакт со слизистыми оболочками и биологическими жидкостями при интимной близости." },
].map((route) => Object.freeze(route)));

// Option-b: the explicit «unknown» stays as a seventh choice that excludes the other six. Its short description is ours, not the owner's.
export const TRANSMISSION_UNKNOWN: TransmissionRoute = Object.freeze({ name: "Неизвестно", description: "Путь передачи не установлен." });

// The seven choices in the order the editor shows them.
export const TRANSMISSION_CHOICES: readonly TransmissionRoute[] = Object.freeze([...TRANSMISSION_ROUTES, TRANSMISSION_UNKNOWN]);

export const TRANSMISSION_SEPARATOR = ", ";

// The old names, mapped to the new ones (owner decision 2026-11-20 and the table approved in 26.1-03).
// «Контактно-бытовой», «Фекально-оральный» and «Неизвестно» did not change. A null prototype: "__proto__" or "constructor" never resolve.
export const legacyTransmissionRoutes: Readonly<Record<string, string>> = Object.freeze(Object.assign(Object.create(null) as Record<string, string>, {
  "Воздушно-капельный": "Аэрозольный",
  "Воздушно-пылевой": "Аэрозольный",
  "Половой": "Половой путь",
}));

// Garbage guards (T-26.1-07): content comes from the editor request and from stored data, both untrusted.
const MAX_VALUE_LENGTH = 120;
const MAX_VALUES = 12;

const clean = (text: string) => text.replace(/́/g, "").replace(/\s+/g, " ").trim();
const keyOf = (text: string) => text.toLowerCase();

// Lower-cased name -> canonical name. A Map has no prototype lookups, so a prototype member name finds nothing.
const knownNames = new Map<string, string>();
for (const choice of TRANSMISSION_CHOICES) knownNames.set(keyOf(choice.name), choice.name);
for (const [legacy, current] of Object.entries(legacyTransmissionRoutes)) knownNames.set(keyOf(legacy), current);

const routeOrder = new Map<string, number>(TRANSMISSION_ROUTES.map((route, index) => [route.name, index]));

// The canonical list of a stored value.
// Rule (deterministic, also for a mixed legacy value such as «Неизвестно, Половой»): the six routes come first in the owner's
// order, then values that are no route at all, as they were written. «Неизвестно» is kept only when nothing else remains, so real
// routes win over it. Repeats go; a value is cut to 120 characters and a list to 12 values, the known routes are never pushed out.
export function parseTransmissionRoutes(value: string): string[] {
  const routes = new Set<string>();
  const extras = new Map<string, string>();
  let unknown = false;
  for (const raw of String(value ?? "").split(",")) {
    const text = [...clean(raw)].slice(0, MAX_VALUE_LENGTH).join("").trim();
    if (!text) continue;
    const name = knownNames.get(keyOf(text));
    if (name === TRANSMISSION_UNKNOWN.name) unknown = true;
    else if (name !== undefined) routes.add(name);
    else if (!extras.has(keyOf(text))) extras.set(keyOf(text), text);
  }
  const known = [...routes].sort((a, b) => (routeOrder.get(a) ?? 0) - (routeOrder.get(b) ?? 0));
  const rest = [...extras.values()].slice(0, Math.max(0, MAX_VALUES - known.length));
  const result = [...known, ...rest];
  return result.length === 0 && unknown ? [TRANSMISSION_UNKNOWN.name] : result;
}

export function formatTransmissionRoutes(routes: readonly string[]): string {
  return parseTransmissionRoutes(routes.join(TRANSMISSION_SEPARATOR)).join(TRANSMISSION_SEPARATOR);
}

// What the normalizer stores: reading and writing both pass through here, so the stored string is always the canonical one.
export function canonicalTransmission(value: string): string {
  return parseTransmissionRoutes(value).join(TRANSMISSION_SEPARATOR);
}

// The editor's toggle of one choice. «Неизвестно» excludes the six routes, a route removes «Неизвестно»; a name that is none of
// the seven choices changes nothing (the value is only read through the table).
export function toggleTransmissionRoute(value: string, name: string): string {
  const current = parseTransmissionRoutes(value);
  const choice = knownNames.get(keyOf(clean(name)));
  if (choice === undefined || !TRANSMISSION_CHOICES.some((item) => item.name === choice)) return formatTransmissionRoutes(current);
  if (choice === TRANSMISSION_UNKNOWN.name) return current.length === 1 && current[0] === choice ? "" : choice;
  const selected = current.filter((item) => item !== TRANSMISSION_UNKNOWN.name);
  return formatTransmissionRoutes(selected.includes(choice) ? selected.filter((item) => item !== choice) : [...selected, choice]);
}

// The owner's text for a route, also for an old name (it reads as the route it was translated to); undefined for anything else.
export function transmissionDescription(name: string): string | undefined {
  const canonical = knownNames.get(keyOf(clean(name)));
  return TRANSMISSION_CHOICES.find((choice) => choice.name === canonical)?.description;
}
