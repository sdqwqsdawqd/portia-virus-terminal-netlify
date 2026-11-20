import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { lf } from "./component-source.ts";

// OWN-03 (owner 2026-11-20), the screens: several routes of transmission are chosen with checkboxes in the shared ClassificationField
// (the editor, the recycle bin and the template builder all use it), and the virus card draws every route with its own icon and, on a
// press, the owner's description. The model (parse, format, toggle, descriptions) is lib/transmission-routes.ts, tested there.
// These are source tests: the components are .tsx and cannot be rendered here. Browser looks are the owner's check, not a pass.
const read = (path: string) => lf(readFileSync(new URL(path, import.meta.url), "utf8"));
const dossier = read("../components/portia-editor-dossier.tsx");
const card = read("../components/portia-virus-card.tsx");
const css = read("../app/portia.css");
const exporter = read("./portia-template-export.ts");
const builder = read("../components/portia-template-builder.tsx");
const editor = read("../components/portia-editor.tsx");

function sliceOf(source: string, start: RegExp, end: RegExp) {
  const from = source.search(start);
  assert.ok(from >= 0, `${start} is found`);
  const rest = source.slice(from + 1);
  const next = rest.search(end);
  return next < 0 ? source.slice(from) : source.slice(from, from + 1 + next);
}

const field = sliceOf(dossier, /export function TransmissionRoutesField/, /\nexport function |\ntype ConfirmAction/);
const classificationField = sliceOf(dossier, /export function ClassificationField/, /\ntype ConfirmAction/);
const cell = sliceOf(card, /function TransmissionCell/, /\nexport function VirusCardBody/);

test("OWN-03 the route picker is a group of checkboxes: legend, one option per choice, icon, name, description", () => {
  assert.match(field, /export function TransmissionRoutesField\(\{ label, value, onChange \}/);
  assert.match(field, /<fieldset className="route-picker"/);
  assert.match(field, /<legend>\{label\}<\/legend>/);
  assert.match(field, /TRANSMISSION_CHOICES\.map\(/);
  assert.match(field, /<label key=\{choice\.name\} className="route-option"/);
  assert.match(field, /type="checkbox"/);
  assert.match(field, /checked=\{selected\.includes\(choice\.name\)\}/);
  assert.match(field, /<PortiaIcon name=\{icon\} className="route-icon"/);
  assert.match(field, /choice\.description/);
});

test("OWN-03 a choice is changed only through toggleTransmissionRoute; the draft gets the canonical string; clearing gives an empty value", () => {
  assert.match(field, /onChange\(toggleTransmissionRoute\(value, choice\.name\)\)/);
  assert.match(field, /parseTransmissionRoutes\(value\)/);
  // A value the table does not know stays visible with its own «Убрать» button and leaves through formatTransmissionRoutes.
  assert.match(field, /formatTransmissionRoutes\(selected\.filter\(\(item\) => item !== extra\)\)/);
  assert.match(field, />Убрать</);
  assert.doesNotMatch(field, /\.split\(","\)|\.join\(", "\)/, "the string is never read or written by hand in the component");
});

test("OWN-03 the shared ClassificationField draws the picker for the transmission axis only, so the editor, the bin and the template get it", () => {
  assert.match(classificationField, /classificationKey === "transmission"\) return <TransmissionRoutesField label=\{label\} value=\{value\} onChange=\{onChange\} \/>/);
  assert.match(classificationField, /<select value=\{value\}/, "the other six axes keep their select");
  assert.match(dossier, /from "@\/lib\/transmission-routes"/);
  assert.match(dossier, /from "@\/components\/portia-icons"/);
  // The property list of ClassificationField is unchanged, so the three callers need no edit.
  assert.match(classificationField, /export function ClassificationField\(\{ label, classificationKey, value, onChange \}: \{/);
  assert.match(builder, /<ClassificationField key=\{key\}/);
  assert.match(editor, /<ClassificationField key=\{key\}/);
  assert.match(dossier, /<ClassificationField key=\{key\} label=\{label\} classificationKey=\{key\} value=\{virus\.classification\[key\]\}/, "the recycle bin");
});

test("T-26.1-08 route values reach the screen as React text only; the icon is looked up by the site's own table", () => {
  for (const [where, source] of [["picker", field], ["card", cell]] as const) {
    assert.doesNotMatch(source, /dangerouslySetInnerHTML|innerHTML/, `${where}: no raw markup`);
  }
  assert.match(cell, /classificationIconFor\(name\)/);
  assert.match(field, /classificationIconFor\(choice\.name\)/);
});

test("OWN-03 the card draws a button per route with its icon, an «Не указан» line without routes, and keeps its imports clean", () => {
  assert.match(card, /import \{[^}]*\bparseTransmissionRoutes\b[^}]*\} from "@\/lib\/transmission-routes"/);
  assert.match(cell, /parseTransmissionRoutes\(value\)/);
  assert.match(cell, /className="route-list"/);
  assert.match(cell, /<button type="button" className="route-item"/);
  assert.match(cell, /<PortiaIcon name=\{icon\} className="class-badge"/);
  assert.match(cell, /<em className="formatted-empty">Не указан<\/em>/);
  assert.match(card, /<TransmissionCell value=\{value\} \/>/, "the transmission cell of VirusCardBody is the new component");
  for (const match of card.matchAll(/from "(@\/[^"]+)"/g)) {
    assert.ok(["@/lib/portia-content", "@/components/portia-icons", "@/lib/rich-text-media", "@/lib/transmission-routes"].includes(match[1]), `the card imports ${match[1]}`);
  }
  assert.doesNotMatch(card, /fetch\(|localStorage|sessionStorage/);
});

test("OWN-03 a route opens the owner's description on a press: one at a time, aria-expanded, Escape closes, closed by default", () => {
  assert.match(cell, /const \[open, setOpen\] = useState<string \| null>\(null\)/, "closed by default, so the template file has no open description");
  assert.match(cell, /aria-expanded=\{open === name && description !== undefined\}/);
  assert.match(cell, /onClick=\{\(\) => setOpen\(open === name \? null : name\)\}/);
  assert.match(cell, /event\.key === "Escape"/);
  assert.match(cell, /transmissionDescription\(open\)/);
  assert.match(cell, /<p className="route-description"/);
});

test("OWN-03 the styles: picker, option, list, item, description; a phone-sized tap target; the file of the template carries them too", () => {
  for (const selector of [".route-picker", ".route-option", ".route-icon", ".route-list", ".route-item", ".route-description"]) {
    assert.ok(css.includes(`${selector} {`) || css.includes(`${selector},`) || css.includes(`${selector}:`) || css.includes(`${selector} `), `${selector} has a rule`);
  }
  assert.match(css, /\.route-picker \{[^}]*grid-column: 1 \/ -1/);
  assert.match(css, /\.route-picker \{[^}]*repeat\(auto-fill, minmax\(min\(100%, 260px\), 1fr\)\)/);
  assert.match(css, /\.route-option:has\(input:checked\)/);
  assert.match(css, /\.route-option \{ min-height: var\(--tap-target\)/);
  assert.match(css, /\.route-description \{[^}]*font-size: 12px/);
  for (const name of ["route-list", "route-item", "route-description"]) {
    assert.match(exporter, new RegExp(`"${name}"`), `${name} is a card class of the exported file`);
  }
});
