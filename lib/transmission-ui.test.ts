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
  assert.match(field, /\{open && host && createPortal\(<div className="route-dropdown-panel" id=\{panelId\} role="group" aria-labelledby=\{labelId\} ref=\{panel\}/, "the panel is drawn only while open, as a layer of its host (item 32)");
  assert.doesNotMatch(field, /fieldset|legend/, "the big group of checkboxes is gone");
  assert.match(field, /TRANSMISSION_CHOICES\.map\(/);
  assert.match(field, /<label key=\{choice\.name\} className="route-option"/);
  assert.match(field, /type="checkbox"/);
  assert.match(field, /checked=\{selected\.includes\(choice\.name\)\}/);
  assert.match(field, /<PortiaIcon name=\{icon\} className="route-icon"/);
  assert.match(field, /transmissionDescription\(/, "the description is the model's text, shown in the shared hint line");
  assert.match(field, /<em>Не указан<\/em>/, "no route: «Не указан»");
  assert.match(field, /<span className="route-dropdown-chosen" key=\{name\}>/, "every chosen route is shown whole: icon and name");
});

test("OWN-03 the drop-down: Escape closes and returns the focus to the button; a press outside and focus leaving close; Enter and Space are the button's own", () => {
  assert.match(field, /const \[open, setOpen\] = useState\(false\)/, "closed by default");
  assert.match(field, /event\.key === "Escape" && open\) \{ event\.preventDefault\(\); event\.stopPropagation\(\); setOpen\(false\); toggle\.current\?\.focus\(\);/);
  assert.match(field, /document\.addEventListener\("pointerdown", [a-zA-Z]+\)/, "a press outside is heard on the document while open");
  // Item 32: the panel lives in a portal, outside the field's own markup, so «outside» means outside the button's field AND outside the panel.
  assert.match(field, /const target = event\.target as Node;\s*if \(!root\.current\?\.contains\(target\) && !panel\.current\?\.contains\(target\)\) setOpen\(false\);/, "a press in the panel does not close it");
  assert.match(field, /document\.removeEventListener\("pointerdown", [a-zA-Z]+\)/, "and it is taken off");
  assert.match(field, /const inside = \(node: Node \| null\) => !!node && \(!!root\.current\?\.contains\(node\) \|\| !!panel\.current\?\.contains\(node\)\)/);
  assert.match(field, /onBlur=\{\(event\) => \{[^}]*event\.relatedTarget[^}]*!inside\(event\.relatedTarget as Node\)[^}]*setOpen\(false\)/, "focus that leaves the whole drop-down closes it; a null target is a press, the document handles that");
  assert.match(field, /onClick=\{\(\) => \{ pointed\.current = null; setHost\(routePanelHost\(toggle\.current\)\); setOpen\(\(was\) => !was\); \}\}/, "a press on the button toggles, with a fresh hint and the host of the layer");
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
  assert.match(card, /<TransmissionCell value=\{value\} still=\{staticRoutes\} \/>/, "the transmission cell of VirusCardBody is the new component");
  // Owner 2026-11-22: the template draws the routes as name and icon only, nothing to press.
  assert.match(cell, /<span className="route-item is-still"/);
  assert.match(readFileSync(new URL("../components/portia-template-builder.tsx", import.meta.url), "utf8"), /emptyText=\{emptyTemplateText\}\s+staticRoutes\b/);
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
  assert.match(css, /\.route-dropdown-panel \{[^}]*position: fixed/, "item 32: a layer over the page, not a part of the form's layout");
  assert.match(css, /\.route-dropdown-panel \{[^}]*width: min\(320px, calc\(100vw - 32px\)\)/, "owner 2026-11-21 item 18: a compact panel");
  assert.match(css, /\.route-dropdown-panel \{[^}]*z-index: \d+/, "above the neighbours");
  assert.match(css, /\.route-dropdown-list \{[^}]*overflow-y: auto/, "the rows scroll when the room is short (item 32: the list, not the whole panel)");
  assert.match(css, /@media \(max-width: 900px\) \{\s*\.route-dropdown-toggle \{ min-height: var\(--tap-target\)/, "a phone-sized tap target");
  assert.ok(css.indexOf(".route-dropdown-panel {") < css.indexOf("/* ui-unify:start"), "the rules stand before the last block, ui-unify");
  assert.match(css, /\.route-option:has\(input:checked\)/);
  assert.match(css, /\.route-option \{ min-height: var\(--tap-target\)/);
  assert.match(css, /\.route-description \{[^}]*font-size: 12px/);
  for (const name of ["route-list", "route-item", "route-description"]) {
    assert.match(exporter, new RegExp(`"${name}"`), `${name} is a card class of the exported file`);
  }
});

// OWN-03 (owner 2026-11-21, clarification 18, 26.1-21): the list was «too big, does not fit and drops far away». The rows are one line each, the descriptions
// moved to ONE hint line at the bottom of the panel (for the route under the pointer or in focus), and the panel opens upwards when the room below is short.
// Item 32 (26.1-25): the hint line was inside the scrolling panel and covered the lowest chosen row. It is now the panel's foot, outside the scrolling
// list, and its text is written into it on hover and focus without a render of the rows.
test("OWN-03 items 18 and 32: the rows carry no description; the foot under the list says the route under the pointer or in focus; every checkbox is described by it", () => {
  assert.doesNotMatch(field, /<small>/, "no description in a row");
  assert.match(field, /const footId = useId\(\)/);
  assert.match(field, /aria-describedby=\{footId\}/, "every checkbox is linked to the foot");
  assert.match(field, /onMouseEnter=\{\(\) => describe\(choice\.name\)\}/, "the pointer shows the route's description");
  assert.match(field, /onFocus=\{\(\) => describe\(choice\.name\)\}/, "so does the focus");
  assert.match(field, /onMouseLeave=\{\(\) => describe\(null\)\}/, "leaving the panel shows the chosen route again");
  assert.match(field, /Наведите на путь/, "the default hint, when nothing is chosen or pointed at");
  assert.match(field, /transmissionDescription\(/, "the text is read from the model, not retyped");
});

test("OWN-03 item 32: the foot stands outside the scrolling list, so it never covers a row; its text changes without a render of the rows", () => {
  assert.match(field, /createPortal\(<div className="route-dropdown-panel"[^\n]*\n\s*<div className="route-dropdown-list">/, "the panel is a column: the list first");
  assert.match(field, /<\/div>\s*<p className="route-dropdown-foot" id=\{footId\} ref=\{foot\} \/>\s*<\/div>, host\)\}/, "then the foot, after the list is closed, as the panel's last child");
  assert.match(field, /TRANSMISSION_CHOICES\.map\(/);
  assert.ok(field.indexOf('<div className="route-dropdown-list">') < field.lastIndexOf("TRANSMISSION_CHOICES.map(") && field.indexOf("extras.map(") < field.indexOf('<p className="route-dropdown-foot"'), "every row and every extra is in the list");
  assert.doesNotMatch(field, /route-dropdown-hint|setHint|hintId/, "the old hint line and its state are gone");
  assert.doesNotMatch(field, /useState<string \| null>/, "no state for the pointed route: hover renders nothing");
  assert.match(field, /const pointed = useRef<string \| null>\(null\)/, "the pointed route is a ref");
  assert.match(field, /foot\.current\.textContent = hintFor\(/, "the text is written into the foot, as plain text");
  assert.match(field, /const hintFor = \(name: string \| null\) => transmissionDescription\(name \?\? ""\) \?\? "Наведите на путь"/);
  assert.match(field, /pointed\.current = null; setHost\(routePanelHost\(toggle\.current\)\); setOpen\(\(was\) => !was\);/, "a fresh hint on every press of the button");
  assert.ok(!css.includes(".route-dropdown-hint"), "its rule is removed");
  assert.match(css, /\.route-dropdown-panel \{[^}]*display: flex; flex-direction: column/);
  assert.match(css, /\.route-dropdown-list \{[^}]*flex: 1 1 auto; min-height: 0;[^}]*overflow-y: auto/);
  assert.match(css, /\.route-dropdown-foot \{[^}]*flex: none/);
  for (const rule of css.match(/\.route-dropdown-(panel|list|foot) \{[^}]*\}/g) ?? []) assert.doesNotMatch(rule, /position: sticky/, "nothing sticks over the rows");
});

test("OWN-03 item 32 / T-26.1-55: the place follows the button once per frame on any scroll or resize; a button scrolled out of its form closes the panel; the listeners leave with it", () => {
  const effect = sliceOf(field, /const natural = node\.offsetHeight;/, /\n {2}\}, \[open\]\);/);
  assert.match(effect, /const clips = scrollingAncestors\(button\);/, "the clipping ancestors are found once, on opening");
  assert.match(effect, /if \(frame === 0\) frame = requestAnimationFrame\(onFrame\);/, "one frame per burst of events");
  assert.match(effect, /window\.addEventListener\("scroll", schedule, options\);/);
  assert.match(effect, /window\.addEventListener\("resize", schedule, options\);/);
  assert.match(effect, /const options = \{ capture: true, passive: true \} as const;/, "any scrolling ancestor is heard, in the capture phase, passively");
  assert.match(effect, /window\.removeEventListener\("scroll", schedule, options\);/);
  assert.match(effect, /window\.removeEventListener\("resize", schedule, options\);/);
  assert.match(effect, /cancelAnimationFrame\(frame\)/);
  assert.match(effect, /if \(event\.target instanceof Node && node\.contains\(event\.target\)\) return;/, "the list's own scroll moves nothing");
  assert.match(effect, /const anchor = button\.getBoundingClientRect\(\);/, "one read of the button per frame");
  assert.match(effect, /if \(!routeAnchorVisible\(anchor, clips\.map\(\(clip\) => clip\.getBoundingClientRect\(\)\)\)\) \{ setOpen\(false\); return; \}/, "out of the form: closed");
  assert.match(effect, /writeRoutePanelPlace\(node, routePanelPlacement\(anchor, /, "one write of the style");
  assert.doesNotMatch(effect.slice(effect.indexOf("const onFrame")), /set(Host|Hint|Placement)\(/, "the frame renders nothing; only closing is a state change");
  assert.match(dossier, /function scrollingAncestors\(node: HTMLElement\): HTMLElement\[\]/);
});

test("OWN-03 items 18 and 32: on opening the room around the button is measured and the panel goes up when it is short below and larger above; the place is written, not rendered", () => {
  assert.match(field, /useLayoutEffect\(\(\) => \{/, "measured before the paint, so the panel never flashes below the edge");
  assert.match(field, /getBoundingClientRect\(\)/);
  assert.match(field, /routePanelPlacement\(button\.getBoundingClientRect\(\), \{ width: ROUTE_PANEL_WIDTH, height: natural \}, routeViewport\(\)\)/, "the pure placement of lib/route-dropdown-position.ts");
  assert.match(dossier, /window\.visualViewport\?\.height \?\? window\.innerHeight/, "the visible height, with the phone keyboard accounted for");
  assert.match(dossier, /from "@\/lib\/route-dropdown-position"/);
  assert.doesNotMatch(field, /setPlacement|data-placement|useState<"down" \| "up">/, "no render per measurement: the measure, setState, measure loop is gone");
  // The one write: top or bottom, left, width and max-height straight into the panel's style.
  const write = sliceOf(dossier, /function writeRoutePanelPlace/, /\n\}\n/);
  for (const property of ["top", "bottom", "left", "width", "maxHeight"]) assert.match(write, new RegExp(`node\\.style\\.${property} = `), `${property} is written`);
  assert.match(write, /node\.dataset\.side = place\.side/);
});

test("OWN-03 item 32: the panel is a layer over the page: a portal into document.body, or into the open dialog the field stands in; never inside the form", () => {
  assert.match(dossier, /import \{ createPortal \} from "react-dom"/);
  assert.match(dossier, /function routePanelHost\(button: HTMLElement \| null\): Element \{\s*return button\?\.closest\("dialog"\) \?\? document\.body;/);
  assert.equal(field.split('className="route-dropdown-panel"').length - 1, 1, "one panel in the field's source");
  assert.match(field, /createPortal\(<div className="route-dropdown-panel"/, "and it is the portal's content, not a child of the field's markup");
  assert.match(field, /<\/div>, host\)\}/, "drawn into the chosen host");
  assert.match(field, /aria-controls=\{open \? panelId : undefined\}/);
  assert.match(field, /className="route-dropdown-panel" id=\{panelId\}/, "the button's aria-controls names the panel");
  assert.doesNotMatch(css.match(/\.route-dropdown-panel \{[^}]*\}/)?.[0] ?? "", /position: absolute|calc\(100% \+ 4px\)/, "nothing hangs on the field's box any more");
  assert.ok(!css.includes("[data-placement="), "the old up rule is gone");
  const z = Number(css.match(/\.route-dropdown-panel \{[^}]*z-index: (\d+)/)?.[1]);
  assert.ok(z > 950, "above the floating windows of the desktop (the format panel is 950)");
});

test("OWN-03 item 32: the panel stands at the end of its host, so Tab is carried: button to the first checkbox, first back to the button, last on past the button", () => {
  assert.match(field, /else if \(event\.key === "Tab" && open\) carryTab\(event\);/);
  assert.match(field, /if \(event\.target === button && !event\.shiftKey\) \{ event\.preventDefault\(\); stops\[0\]\.focus\(\); \}/);
  assert.match(field, /else if \(event\.target === stops\[0\] && event\.shiftKey\) \{ event\.preventDefault\(\); button\.focus\(\); \}/);
  assert.match(field, /else if \(event\.target === stops\[stops\.length - 1\] && !event\.shiftKey\) \{ event\.preventDefault\(\); setOpen\(false\); \(nextTabStop\(button, box, host\) \?\? button\)\.focus\(\); \}/);
  assert.match(dossier, /function nextTabStop\(button: HTMLElement, panel: HTMLElement, host: Element \| null\)/);
});

test("OWN-03 item 18: the compact panel — 320px wide, no taller than 280px or 45svh and scrolling inside, 4px from the button, up on request; 28px rows of 13px names", () => {
  assert.match(css, /\.route-dropdown-anchor \{[^}]*position: relative/, "the panel hangs on the button, not on the label above it");
  assert.match(css, /\.route-dropdown-list \{[^}]*max-height: min\(280px, 45svh\)/, "the rows stay compact; the foot stands under them");
  assert.match(css, /\.route-option \{[^}]*min-height: 28px/, "28px rows on a PC");
  assert.match(css, /\.route-option-text strong \{[^}]*font: 700 13px/);
  assert.match(css, /\.route-dropdown-foot \{[^}]*font: 11px/);
  assert.match(css, /@media \(max-width: 900px\) \{[^@]*\.route-option \{ min-height: var\(--tap-target\)/, "a phone-sized row");
  for (const rule of [".route-dropdown-list {", ".route-dropdown-foot {"]) {
    assert.ok(css.indexOf(rule) >= 0 && css.indexOf(rule) < css.indexOf("/* users-tab:start"), `${rule} stands before the users-tab block`);
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

test("owner 2026-11-22: in live mode a press in the routes panel reaches its checkbox and does not close the live popover", () => {
  const live = read("../components/portia-editor-live.tsx");
  const dossier = read("../components/portia-editor-dossier.tsx");
  assert.match(dossier, /className="route-dropdown-panel"[^>]*data-floating-layer=""/, "the portaled routes panel is marked as a floating layer");
  assert.match(live, /closest\("\[data-floating-layer\]"\)\) return;/, "LivePopover ignores a press inside a floating layer");
});
