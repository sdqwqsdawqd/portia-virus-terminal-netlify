import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classificationOptions } from "./portia-content.ts";
import {
  TRANSMISSION_CHOICES,
  TRANSMISSION_ROUTES,
  TRANSMISSION_SEPARATOR,
  TRANSMISSION_UNKNOWN,
  canonicalTransmission,
  formatTransmissionRoutes,
  legacyTransmissionRoutes,
  parseTransmissionRoutes,
  toggleTransmissionRoute,
  transmissionDescription,
} from "./transmission-routes.ts";

const SIX = ["Аэрозольный", "Контактно-бытовой", "Фекально-оральный", "Трансмиссивный", "Гемоконтактный", "Половой путь"];

// OWN-03: the six routes and their descriptions are the owner's words, read from the recorded request, not retyped here.
const request = readFileSync(new URL("../.planning/phases/PORTIA-26.1-pravki-vladeltsa-spravochnik-puti-peredachi-redaktor-teksta/26.1-OWNER-REQUEST.md", import.meta.url), "utf8").replace(/\r\n/g, "\n");

function ownerRoutes() {
  const from = request.indexOf("## Пути передачи (дословно от владельца)");
  assert.ok(from >= 0, "the owner's routes section exists");
  const rest = request.slice(from + 1);
  const next = rest.indexOf("\n## ");
  const section = next < 0 ? rest : rest.slice(0, next);
  return [...section.matchAll(/^- \*\*(.+?)\*\* — (.+)$/gm)].map((match) => ({ name: match[1], description: match[2] }));
}

test("OWN-03 the six routes carry the owner's names and descriptions word for word", () => {
  assert.deepEqual(TRANSMISSION_ROUTES.map((route) => route.name), SIX);
  assert.deepEqual([...TRANSMISSION_ROUTES], ownerRoutes());
  assert.equal(TRANSMISSION_SEPARATOR, ", ");
});

test("option-b: «Неизвестно» is a seventh, separate choice with its own short description", () => {
  assert.equal(TRANSMISSION_UNKNOWN.name, "Неизвестно");
  assert.ok(TRANSMISSION_UNKNOWN.description.length > 0 && TRANSMISSION_UNKNOWN.description.length < 60);
  assert.deepEqual(TRANSMISSION_CHOICES.map((choice) => choice.name), [...SIX, "Неизвестно"]);
  assert.deepEqual(classificationOptions.transmission.map((option) => option.value), [...SIX, "Неизвестно"]);
});

test("OWN-03 the approved translation table (option-b): old names read as the new ones", () => {
  assert.equal(canonicalTransmission("Воздушно-капельный"), "Аэрозольный");
  assert.equal(canonicalTransmission("Воздушно-пылевой"), "Аэрозольный");
  assert.equal(canonicalTransmission("Половой"), "Половой путь");
  assert.equal(canonicalTransmission("Контактно-бытовой"), "Контактно-бытовой");
  assert.equal(canonicalTransmission("Фекально-оральный"), "Фекально-оральный");
  assert.equal(canonicalTransmission("Неизвестно"), "Неизвестно");
  assert.deepEqual(Object.keys(legacyTransmissionRoutes).sort(), ["Воздушно-капельный", "Воздушно-пылевой", "Половой"].sort());
});

test("several routes are one canonical string: owner's order, no repeats", () => {
  assert.equal(canonicalTransmission("Гемоконтактный, Аэрозольный, Аэрозольный"), "Аэрозольный, Гемоконтактный");
  assert.equal(canonicalTransmission("Воздушно-капельный, Воздушно-пылевой"), "Аэрозольный");
  assert.equal(canonicalTransmission("Половой, Трансмиссивный, Контактно-бытовой"), "Контактно-бытовой, Трансмиссивный, Половой путь");
  assert.deepEqual(parseTransmissionRoutes("Половой путь,Аэрозольный"), ["Аэрозольный", "Половой путь"]);
  assert.equal(formatTransmissionRoutes(["Половой путь", "Аэрозольный"]), "Аэрозольный, Половой путь");
  assert.equal(formatTransmissionRoutes([]), "");
  assert.equal(canonicalTransmission(""), "");
  assert.equal(canonicalTransmission(" , ,"), "");
});

test("accent marks, case and spaces do not matter on the way in", () => {
  assert.equal(canonicalTransmission("Аэрозо́льный"), "Аэрозольный");
  assert.equal(canonicalTransmission("  контактно-бытовой "), "Контактно-бытовой");
  assert.equal(canonicalTransmission("ГЕМОКОНТАКТНЫЙ"), "Гемоконтактный");
  assert.equal(canonicalTransmission("  половой   путь "), "Половой путь");
});

test("a value that is neither a route nor an old name is not lost: it stays after the known routes", () => {
  assert.equal(canonicalTransmission("Чужое значение, Аэрозольный"), "Аэрозольный, Чужое значение");
  assert.equal(canonicalTransmission("Чужое"), "Чужое");
  assert.equal(canonicalTransmission("Б, А, Б"), "Б, А");
});

test("«Неизвестно» is exclusive: it survives only alone; a mixed legacy value keeps the real routes (rule: real routes win)", () => {
  assert.equal(canonicalTransmission("Неизвестно, Половой"), "Половой путь");
  assert.equal(canonicalTransmission("Половой, Неизвестно"), "Половой путь");
  assert.equal(canonicalTransmission("Неизвестно, Неизвестно"), "Неизвестно");
  assert.equal(canonicalTransmission("неизвестно"), "Неизвестно");
  assert.equal(canonicalTransmission("Неизвестно, Чужое"), "Чужое");
  assert.deepEqual(parseTransmissionRoutes("Неизвестно, Аэрозольный, Гемоконтактный"), ["Аэрозольный", "Гемоконтактный"]);
  assert.equal(formatTransmissionRoutes(["Неизвестно", "Половой путь"]), "Половой путь");
});

test("selecting «Неизвестно» clears the routes; selecting a route clears «Неизвестно»; selecting again removes", () => {
  assert.equal(toggleTransmissionRoute("Аэрозольный, Гемоконтактный", "Неизвестно"), "Неизвестно");
  assert.equal(toggleTransmissionRoute("", "Неизвестно"), "Неизвестно");
  assert.equal(toggleTransmissionRoute("Неизвестно", "Неизвестно"), "");
  assert.equal(toggleTransmissionRoute("Неизвестно", "Половой путь"), "Половой путь");
  assert.equal(toggleTransmissionRoute("Неизвестно", "Аэрозольный"), "Аэрозольный");
  assert.equal(toggleTransmissionRoute("Половой путь", "Аэрозольный"), "Аэрозольный, Половой путь");
  assert.equal(toggleTransmissionRoute("Аэрозольный, Половой путь", "Аэрозольный"), "Половой путь");
  assert.equal(toggleTransmissionRoute("Половой путь", "Половой путь"), "");
  // An old stored value is read through the table before the toggle.
  assert.equal(toggleTransmissionRoute("Воздушно-капельный", "Гемоконтактный"), "Аэрозольный, Гемоконтактный");
  // A name that is not one of the seven choices changes nothing.
  assert.equal(toggleTransmissionRoute("Половой", "Чужое"), "Половой путь");
});

test("normalizing twice changes nothing", () => {
  const samples = [
    "Воздушно-капельный", "Воздушно-пылевой", "Половой", "Неизвестно", "Неизвестно, Половой", "Гемоконтактный, Аэрозольный, Аэрозольный",
    "Аэрозо́льный", "  контактно-бытовой ", "Чужое значение, Аэрозольный", "", " , ", "x".repeat(300), Array.from({ length: 30 }, (_, index) => `v${index}`).join(", "),
  ];
  for (const sample of samples) {
    const once = canonicalTransmission(sample);
    assert.equal(canonicalTransmission(once), once, sample.slice(0, 30));
  }
});

test("T-26.1-06 prototype names find nothing in the tables (own keys only)", () => {
  for (const name of ["__proto__", "constructor", "toString", "hasOwnProperty", "valueOf"]) {
    assert.equal(canonicalTransmission(name), name, name);
    assert.equal(transmissionDescription(name), undefined, name);
    assert.deepEqual(parseTransmissionRoutes(name), [name]);
  }
  assert.equal(canonicalTransmission("__proto__, Аэрозольный"), "Аэрозольный, __proto__");
  assert.equal(Object.getPrototypeOf(legacyTransmissionRoutes), null);
});

test("T-26.1-07 garbage is cut: 120 characters a value, 12 values", () => {
  const long = canonicalTransmission("я".repeat(500));
  assert.equal(long.length, 120);
  const many = canonicalTransmission(Array.from({ length: 40 }, (_, index) => `значение${index}`).join(", "));
  assert.equal(many.split(TRANSMISSION_SEPARATOR).length, 12);
  assert.equal(many.split(TRANSMISSION_SEPARATOR)[0], "значение0");
  // The known routes are never pushed out by garbage in front of them.
  const crowded = canonicalTransmission(`${Array.from({ length: 20 }, (_, index) => `мусор${index}`).join(", ")}, Аэрозольный`);
  assert.ok(crowded.startsWith("Аэрозольный, "), crowded);
});

test("transmissionDescription gives the owner's text for the seven choices and for old names", () => {
  for (const route of TRANSMISSION_ROUTES) assert.equal(transmissionDescription(route.name), route.description);
  assert.equal(transmissionDescription("Неизвестно"), TRANSMISSION_UNKNOWN.description);
  assert.equal(transmissionDescription("Воздушно-пылевой"), TRANSMISSION_ROUTES[0].description);
  assert.equal(transmissionDescription("Чужое"), undefined);
});
