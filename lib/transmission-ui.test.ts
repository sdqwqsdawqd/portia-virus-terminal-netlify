import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { lf } from "./component-source.ts";
import { templateCardCss, templateExportViolations, templateCardDocument } from "./portia-template-export.ts";
import { TRANSMISSION_CHOICES } from "./transmission-routes.ts";

// OWN-03 (owner 2026-11-20; clarification 12, 26.1-15: a compact drop-down), the screens: several routes of transmission are chosen with checkboxes in a panel of the shared ClassificationField
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

test("OWN-03 the route picker is a compact drop-down: one button with the chosen routes, a panel of seven checkboxes with icon, name and description", () => {
  assert.match(field, /export function TransmissionRoutesField\(\{ label, value, onChange \}/);
  assert.match(field, /<div className="route-dropdown classification-editor-field"/);
  assert.match(field, /<button type="button" className="route-dropdown-toggle"/);
  assert.match(field, /aria-haspopup="true"/);
  assert.match(field, /aria-expanded=\{open\}/);
  assert.match(field, /aria-controls=\{open \? panelId : undefined\}/);
  assert.match(field, /aria-labelledby=\{`\$\{labelId\} \$\{valueId\}`\}/, "the visible label and the chosen routes name the button");
  assert.match(field, /<span className="route-dropdown-label" id=\{labelId\}>\{label\}<\/span>/, "the visible label of the field");
  assert.match(field, /\{open && <div className="route-dropdown-panel" id=\{panelId\} role="group" aria-labelledby=\{labelId\}>/, "the panel is drawn only while open");
  assert.doesNotMatch(field, /fieldset|legend/, "the big group of checkboxes is gone");
  assert.match(field, /TRANSMISSION_CHOICES\.map\(/);
  assert.match(field, /<label key=\{choice\.name\} className="route-option"/);
  assert.match(field, /type="checkbox"/);
  assert.match(field, /checked=\{selected\.includes\(choice\.name\)\}/);
  assert.match(field, /<PortiaIcon name=\{icon\} className="route-icon"/);
  assert.match(field, /choice\.description/);
  assert.match(field, /<em>Не указан<\/em>/, "no route: «Не указан»");
  assert.match(field, /<span className="route-dropdown-chosen" key=\{name\}>/, "every chosen route is shown whole: icon and name");
});

test("OWN-03 the drop-down: Escape closes and returns the focus to the button; a press outside and focus leaving close; Enter and Space are the button's own", () => {
  assert.match(field, /const \[open, setOpen\] = useState\(false\)/, "closed by default");
  assert.match(field, /event\.key === "Escape" && open\) \{ event\.preventDefault\(\); event\.stopPropagation\(\); setOpen\(false\); toggle\.current\?\.focus\(\);/);
  assert.match(field, /document\.addEventListener\("pointerdown", [a-zA-Z]+\)/, "a press outside is heard on the document while open");
  assert.match(field, /root\.current\?\.contains\(event\.target as Node\)/);
  assert.match(field, /document\.removeEventListener\("pointerdown", [a-zA-Z]+\)/, "and it is taken off");
  assert.match(field, /onBlur=\{\(event\) => \{[^}]*event\.relatedTarget[^}]*root\.current\?\.contains\(event\.relatedTarget as Node\)[^}]*setOpen\(false\)/, "focus that leaves the whole drop-down closes it; a null target is a press, the document handles that");
  assert.match(field, /onClick=\{\(\) => setOpen\(\(was\) => !was\)\}/);
  assert.doesNotMatch(field, /"Enter"|" "|"Space"/, "Enter and Space open the button natively");
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
  for (const [where, source] of [["drop-down", field], ["card", cell]] as const) {
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
    assert.ok(["@/lib/portia-content", "@/components/portia-icons", "@/components/portia-live-edit", "@/lib/rich-text-media", "@/lib/transmission-routes"].includes(match[1]), `the card imports ${match[1]}`);
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

test("OWN-03 the styles: drop-down, toggle, panel, option, list, item, description; a phone-sized tap target; the file of the template carries the card ones", () => {
  for (const selector of [".route-dropdown", ".route-dropdown-toggle", ".route-dropdown-panel", ".route-option", ".route-icon", ".route-list", ".route-item", ".route-description"]) {
    assert.ok(css.includes(`${selector} {`) || css.includes(`${selector},`) || css.includes(`${selector}:`) || css.includes(`${selector} `), `${selector} has a rule`);
  }
  assert.ok(!css.includes(".route-picker"), "the big picker has no styles left");
  assert.match(css, /\.route-dropdown \{[^}]*position: relative/);
  assert.match(css, /\.route-dropdown-toggle \{[^}]*min-height: 32px/, "32px on a PC");
  assert.doesNotMatch(css.match(/\.route-dropdown-toggle \{[^}]*\}/)?.[0] ?? "", /text-overflow|white-space: nowrap/, "the chosen routes wrap, never an ellipsis");
  assert.match(css, /\.route-dropdown-value \{[^}]*flex-wrap: wrap/);
  assert.match(css, /\.route-dropdown-panel \{[^}]*position: absolute/);
  assert.match(css, /\.route-dropdown-panel \{[^}]*width: min\(420px, calc\(100vw - 32px\)\)/);
  assert.match(css, /\.route-dropdown-panel \{[^}]*z-index: \d+/, "above the neighbours");
  assert.match(css, /\.route-dropdown-panel \{[^}]*overflow-y: auto/, "scrolls when the room is short");
  assert.match(css, /@media \(max-width: 900px\) \{\s*\.route-dropdown-toggle \{ min-height: var\(--tap-target\)/, "a phone-sized tap target");
  assert.ok(css.indexOf(".route-dropdown-panel {") < css.indexOf("/* ui-unify:start"), "the rules stand before the last block, ui-unify");
  assert.match(css, /\.route-option:has\(input:checked\)/);
  assert.match(css, /\.route-option \{ min-height: var\(--tap-target\)/);
  assert.match(css, /\.route-description \{[^}]*font-size: 12px/);
  for (const name of ["route-list", "route-item", "route-description"]) {
    assert.match(exporter, new RegExp(`"${name}"`), `${name} is a card class of the exported file`);
  }
});

// Reads the declaration blocks of the plain rules (no @media) whose selector is exactly `selector`, as the builder reads the live sheets.
function cssRule(selector: string) {
  const found = [...css.matchAll(/^([^@{}\n][^{}\n]*)\{([^{}]*)\}$/gm)].filter((match) => match[1].trim() === selector);
  assert.ok(found.length >= 1, `${selector} has a rule`);
  return { selector, declarations: found.map((match) => match[2].trim()).join(" ") };
}

test("OWN-03 the exported file of the template carries the look of the routes and not a description opened in advance", () => {
  const carried = templateCardCss([cssRule(".route-list"), cssRule(".route-item"), cssRule(".route-description"), cssRule(".route-dropdown-panel")], {});
  for (const selector of [".route-list", ".route-item", ".route-description"]) assert.ok(carried.includes(`${selector}{`), `${selector} reaches the file`);
  assert.ok(!carried.includes(".route-dropdown"), "the editor's drop-down is not a class of the card and does not travel");
  // The captured card is the closed state: no description paragraph, every route button collapsed. The page is the closed policy's own.
  const markup = `<article class="record-view"><div class="class-cell transmission"><span>Способ распространения</span><strong class="route-list"><button type="button" class="route-item" aria-expanded="false">Аэрозольный</button></strong></div></article>`;
  const document = templateCardDocument(markup, carried, "Вирус");
  assert.deepEqual(templateExportViolations(document), []);
  assert.ok(!document.includes('class="route-description"'), "no opened description in the captured card");
  assert.match(cell, /useState<string \| null>\(null\)/);
});

test("OWN-03 the long texts live in the model, not in the components: the picker and the card read them from transmission-routes", () => {
  for (const choice of TRANSMISSION_CHOICES) {
    assert.ok(!dossier.includes(choice.description), `${choice.name}: the description is not retyped in the picker`);
    assert.ok(!card.includes(choice.description), `${choice.name}: the description is not retyped in the card`);
  }
  assert.match(cell, /\{description\}/, "the opened paragraph shows the model's text");
});
