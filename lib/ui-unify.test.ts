import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { lf } from "./component-source.ts";

// Phase 26 (UI-03, D-02): the shared families of buttons, plaques, fields, tabs and list rows are one marked block at the end
// of app/portia.css. The contract is read through the cascade: the last rule whose selector list names the selector decides.
// Specificity is not modelled; every selector below is a single selector that either has no higher-specificity competitor
// or whose competitor was rewritten in place in the same plan.
const portiaCss = lf(readFileSync(new URL("../app/portia.css", import.meta.url), "utf8"));
const promotionCss = lf(readFileSync(new URL("../app/portia-promotion-editor.css", import.meta.url), "utf8"));
// Stylesheet order of app/layout.tsx: portia.css, then portia-promotion-editor.css.
const cascadeCss = `${portiaCss}\n${promotionCss}`;

const PHONE = "max-width: 900px";

type Rule = { selectors: string[]; body: string; context: string | null };

function blank(text: string) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
}

function closingBrace(text: string, open: number) {
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === "{") depth += 1;
    else if (text[index] === "}" && --depth === 0) return index;
  }
  throw new Error("unbalanced braces");
}

function parseRules(text: string, context: string | null = null): Rule[] {
  const rules: Rule[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const open = text.indexOf("{", cursor);
    if (open < 0) break;
    const close = closingBrace(text, open);
    const prelude = text.slice(cursor, open).trim();
    const body = text.slice(open + 1, close);
    if (prelude.startsWith("@media")) rules.push(...parseRules(body, prelude.slice(6).trim()));
    else if (!prelude.startsWith("@")) {
      rules.push({ selectors: prelude.split(",").map((selector) => selector.replace(/\s+/g, " ").trim()), body, context });
    }
    cursor = close + 1;
  }
  return rules;
}

function declarations(body: string) {
  const found: [string, string][] = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  const flush = (end: number) => {
    const part = body.slice(start, end);
    const colon = part.indexOf(":");
    if (colon > 0) found.push([part.slice(0, colon).trim().toLowerCase(), part.slice(colon + 1).replace(/\s+/g, " ").trim()]);
  };
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (quote) {
      if (char === quote) quote = "";
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    else if (char === ";" && depth === 0) {
      flush(index);
      start = index + 1;
    }
  }
  flush(body.length);
  return found;
}

const parsedCache = new Map<string, Rule[]>();
function rulesOf(css: string) {
  let rules = parsedCache.get(css);
  if (!rules) {
    rules = parseRules(blank(css));
    parsedCache.set(css, rules);
  }
  return rules;
}

/**
 * The value the last rule naming `selector` (as one entry of its selector list) gives `property`. With a `context`
 * (for example "max-width: 900px") the media rules of that query count too, in source order, as on a matching viewport.
 */
function lastDeclaration(css: string, selector: string, property: string, context?: string): string | undefined {
  let value: string | undefined;
  for (const rule of rulesOf(css)) {
    if (!rule.selectors.includes(selector)) continue;
    if (rule.context !== null && !(context && rule.context.includes(context))) continue;
    for (const [name, declared] of declarations(rule.body)) if (name === property) value = declared.replace(/\s*!important$/, "");
  }
  return value;
}

/** Index of the last rule that names `selector` and declares `property` (source order across the cascade). */
function lastRuleIndex(css: string, selector: string, property: string) {
  let found = -1;
  rulesOf(css).forEach((rule, index) => {
    if (rule.selectors.includes(selector) && declarations(rule.body).some(([name]) => name === property)) found = index;
  });
  return found;
}

function unifyBlock(css: string) {
  const start = css.indexOf("/* ui-unify:start");
  assert.ok(start > 0, "the ui-unify block must exist");
  assert.equal(css.indexOf("/* ui-unify:start", start + 1), -1, "there must be one ui-unify block");
  assert.equal(css.split("/* ui-unify:end */").length, 2, "there must be one ui-unify end marker");
  return { start, text: css.slice(start) };
}

// Members of the button family (D-02: never stretched). Variants keep their own colours.
const BUTTON_FAMILY = [
  ".primary-control",
  ".secondary-control",
  ".danger-control",
  ".app-state-action",
  ".info-next button",
  ".promotion-action",
  ".promotion-preview-actions > button",
  ".promotion-device-reset button",
];
// Other buttons that were stretched before Phase 26 and are audited by the same ban (D-02): they are not members of the
// geometry family (they keep their own dense or compact size) but they may not fill a row either.
const STRETCH_AUDITED_EXTRA = [
  ".format-choice-row > button",
  ".content-control-actions button",
  ".content-control-actions a",
  ".archive-document-bar button",
  ".promotion-bank-workflow-tabs button",
  ".promotion-preview li button",
  ".users-pending-head button",
];
// A3 (UI-SPEC): a stacked list of actions inside a container narrower than 480px (the dialog is 420px at most) fills it;
// that is stacking, not stretching. Named one by one: nothing else may stretch a button.
const NARROW_STACK_EXCEPTIONS = [
  ".users-action-dialog-body .portia-dialog-actions button",
  ".users-action-dialog-body .users-row-actions button",
];
// Rows of lists are rows, not buttons: they fill their cell (UI-SPEC "List rows").
const ROW_SELECTORS = [".editor-record-list button", ".users-row", ".global-result", ".personnel-list > button"];

function stretchViolations(css: string, audited: string[], exceptions: string[]) {
  const found: string[] = [];
  for (const rule of rulesOf(css)) {
    const members = rule.selectors.filter((selector) => audited.includes(selector));
    if (!members.length || members.every((selector) => exceptions.includes(selector))) continue;
    for (const [name, value] of declarations(rule.body)) {
      const stretches =
        (name === "width" && /^100%/.test(value)) ||
        (name === "flex" && /^[1-9]/.test(value)) ||
        (name === "flex-grow" && /^[1-9]/.test(value)) ||
        (name === "flex-basis" && /^100%/.test(value));
      if (stretches) found.push(`${rule.selectors.join(", ")} { ${name}: ${value} }`);
    }
  }
  return found;
}

test("UI-03: the helper reads the cascade, media contexts and selector lists", () => {
  const css = ".a, .b { padding: 1px; min-height: 40px }\n.a { padding: 2px }\n@media (max-width: 900px) { .a { min-height: 44px } }\n@keyframes k { from { padding: 9px } }";
  assert.equal(lastDeclaration(css, ".a", "padding"), "2px");
  assert.equal(lastDeclaration(css, ".b", "padding"), "1px");
  assert.equal(lastDeclaration(css, ".a", "min-height"), "40px");
  assert.equal(lastDeclaration(css, ".a", "min-height", PHONE), "44px");
  assert.equal(lastDeclaration(css, ".c", "padding"), undefined);
  assert.deepEqual(declarations('background: url("data:image/svg+xml;utf8,<svg/>"); color: red'), [
    ["background", 'url("data:image/svg+xml;utf8,<svg/>")'],
    ["color", "red"],
  ]);
});

test("UI-03: the ui-unify block is the last block of portia.css, after users-tab", () => {
  const { start, text } = unifyBlock(portiaCss);
  assert.ok(portiaCss.trimEnd().endsWith("/* ui-unify:end */"), "ui-unify must end the file");
  assert.ok(portiaCss.lastIndexOf("/* users-tab:end */") < start, "ui-unify comes after the users-tab block");
  assert.ok(portiaCss.lastIndexOf("/* access-levels:end */") < start, "ui-unify comes after the access-levels block");
  assert.doesNotMatch(text, /var\(--muted\)/u);
  assert.doesNotMatch(text, /#[0-9a-f]{3,8}\b/iu, "no hex neutrals: use the oklch form of the existing tokens");
  assert.doesNotMatch(text, /@keyframes|(?:^|[;\s{])(animation|transition)\s*:/u);
});

test("UI-03: every button of the family has one geometry and one corner role", () => {
  for (const selector of BUTTON_FAMILY) {
    assert.equal(lastDeclaration(cascadeCss, selector, "min-height"), "var(--control-height)", `${selector} min-height`);
    assert.equal(lastDeclaration(cascadeCss, selector, "padding"), "0 16px", `${selector} padding`);
    assert.equal(lastDeclaration(cascadeCss, selector, "border-radius"), "var(--radius-control)", `${selector} radius`);
    assert.equal(lastDeclaration(cascadeCss, selector, "width"), "auto", `${selector} width`);
    assert.equal(lastDeclaration(cascadeCss, selector, "flex"), "0 0 auto", `${selector} flex`);
    // UI-08 retired the phone back arrow (.info-phone-back), the one icon-glyph member; every member now reads 11px.
    assert.equal(lastDeclaration(cascadeCss, selector, "font-size"), "11px", `${selector} font-size`);
    assert.equal(lastDeclaration(cascadeCss, selector, "font-weight"), "700", `${selector} font-weight`);
    // T-26-06: the touch target on a phone.
    assert.equal(lastDeclaration(cascadeCss, selector, "min-height", PHONE), "var(--tap-target)", `${selector} phone min-height`);
  }
});

test("UI-03: button variants keep their own colours (T-26-05)", () => {
  const { text } = unifyBlock(portiaCss);
  for (const rule of rulesOf(text)) {
    if (!rule.selectors.some((selector) => BUTTON_FAMILY.includes(selector))) continue;
    for (const [name] of declarations(rule.body)) {
      assert.ok(!["background", "background-color", "color", "border-color", "border"].includes(name), `${rule.selectors.join(", ")} must not recolour a variant (${name})`);
    }
  }
  assert.match(lastDeclaration(portiaCss, ".danger-control", "color") ?? "", /#df8a81/u);
  assert.match(lastDeclaration(portiaCss, ".danger-control", "border-color") ?? "", /#79453f/u);
  assert.equal(lastDeclaration(portiaCss, ".primary-control", "color"), "var(--teal)");
});

test("UI-03 / D-02: no button of the family is stretched, in either stylesheet", () => {
  const audited = [...BUTTON_FAMILY, ...STRETCH_AUDITED_EXTRA, ...NARROW_STACK_EXCEPTIONS];
  assert.deepEqual(stretchViolations(portiaCss, audited, NARROW_STACK_EXCEPTIONS), []);
  assert.deepEqual(stretchViolations(promotionCss, audited, NARROW_STACK_EXCEPTIONS), []);
  assert.doesNotMatch(promotionCss, /flex:\s*1 1 (?:140|150|160)px/u);
});

test("UI-03 / D-02: the narrow-stack exceptions are named, real and only inside the 420px dialog", () => {
  for (const selector of NARROW_STACK_EXCEPTIONS) {
    assert.equal(lastDeclaration(portiaCss, selector, "width", PHONE), "100%", `${selector} is the stacked-action exception`);
    assert.equal(lastDeclaration(portiaCss, selector, "width"), undefined, `${selector} stacks on a phone only`);
    assert.ok(selector.startsWith(".users-action-dialog-body"), "the exception stays inside the action dialog");
  }
  assert.match(lastDeclaration(portiaCss, ".portia-dialog", "width") ?? "", /^min\(420px,/u, "the dialog that holds the stack is narrower than 480px");
  // Rows of lists are rows, not buttons: they may fill the cell, and they are not audited as buttons.
  for (const row of [".editor-record-list button", ".global-result", ".personnel-list > button"]) {
    assert.equal(lastDeclaration(portiaCss, row, "width"), "100%", row);
    assert.ok(!BUTTON_FAMILY.includes(row) && !STRETCH_AUDITED_EXTRA.includes(row));
  }
});

// Plaques: one box for every label, status and count. Font families and colours stay with each member.
const PLAQUES = [
  ".quest-badge",
  ".manual-mark",
  "small.manual-mark",
  ".personnel-list > button > .manual-mark",
  ".personnel-profile-identity > small.manual-mark",
  ".users-plaque",
  ".users-table-mark",
  ".promotion-step-badge",
  ".info-sub-marker",
  ".global-result-mark",
  ".search-recommendations button",
];
// The count pill: the same family with `padding: 0 8px; min-width: 24px`.
const COUNT_PILLS = [".tab-count", ".promotion-editor-branches button span", ".promotion-queue-filters button span"];

test("UI-03: every plaque is one pill box", () => {
  for (const selector of [...PLAQUES, ...COUNT_PILLS]) {
    assert.equal(lastDeclaration(cascadeCss, selector, "border-radius"), "var(--radius-plaque)", `${selector} radius`);
    assert.equal(lastDeclaration(cascadeCss, selector, "font-size"), "11px", `${selector} font-size`);
    assert.equal(lastDeclaration(cascadeCss, selector, "font-weight"), "700", `${selector} font-weight`);
    assert.equal(lastDeclaration(cascadeCss, selector, "letter-spacing"), ".09em", `${selector} letter-spacing`);
    assert.equal(lastDeclaration(cascadeCss, selector, "line-height"), "1.35", `${selector} line-height`);
    assert.equal(lastDeclaration(cascadeCss, selector, "white-space"), "nowrap", `${selector} white-space`);
    assert.match(lastDeclaration(cascadeCss, selector, "border") ?? lastDeclaration(cascadeCss, selector, "border-width") ?? "", /^1px/u, `${selector} has a 1px border`);
  }
  for (const selector of PLAQUES) assert.equal(lastDeclaration(cascadeCss, selector, "padding"), "4px 8px", `${selector} padding`);
  for (const selector of COUNT_PILLS) {
    assert.equal(lastDeclaration(cascadeCss, selector, "padding"), "0 8px", `${selector} padding`);
    assert.equal(lastDeclaration(cascadeCss, selector, "min-width"), "24px", `${selector} min-width`);
  }
  // Dots stay round.
  for (const selector of [".tab-dot", ".status-dot"]) assert.equal(lastDeclaration(cascadeCss, selector, "border-radius"), "var(--radius-round)");
});

// Fields: single-line controls share one box; textareas fill their column.
const SINGLE_LINE_FIELDS = [
  ".editor-field input",
  ".editor-field select",
  ".global-search-box",
  ".search-box",
  ".promotion-device-reset input",
  ".promotion-final-decision input",
  ".promotion-bank-settings input",
  ".promotion-bank-editor > label > input",
  ".promotion-bank-editor select",
  ".promotion-preview select",
  ".promotion-question-list-heading input",
];

test("UI-03: single-line fields share one box and a phone touch target", () => {
  for (const selector of SINGLE_LINE_FIELDS) {
    assert.equal(lastDeclaration(cascadeCss, selector, "min-height"), "var(--control-height)", `${selector} min-height`);
    assert.equal(lastDeclaration(cascadeCss, selector, "padding"), "8px 16px", `${selector} padding`);
    assert.equal(lastDeclaration(cascadeCss, selector, "border-radius"), "var(--radius-field)", `${selector} radius`);
    assert.match(lastDeclaration(cascadeCss, selector, "min-height", PHONE) ?? "", /^(?:44px|var\(--tap-target\))$/u, `${selector} phone min-height`);
  }
  assert.equal(lastDeclaration(cascadeCss, ".editor-field textarea", "padding"), "8px 16px");
  assert.equal(lastDeclaration(cascadeCss, ".editor-field textarea", "border-radius"), "var(--radius-field)");
  assert.equal(lastDeclaration(cascadeCss, ".editor-field input", "max-width"), "var(--field-max)");
  assert.equal(lastDeclaration(cascadeCss, ".editor-field select", "max-width"), "var(--field-max)");
  // iOS keeps a 16px field on a phone (existing rule, Heading size).
  assert.equal(lastDeclaration(cascadeCss, ".editor-field input", "font-size", PHONE), "16px");
  assert.equal(lastDeclaration(cascadeCss, ".editor-field input", "font-size"), "13px");
});

// Tabs: one strip look, an active line that does not rely on colour alone, an error line that outranks it.
const TABS = [
  ".editor-tabs button",
  ".editor-section-tabs nav button",
  ".users-sections button",
  ".promotion-editor-branches button",
  ".promotion-queue-filters button",
  ".promotion-bank-workflow-tabs button",
];
const ACTIVE_TABS = [
  ".editor-tabs button.active",
  '.editor-section-tabs nav button[aria-current="true"]',
  '.users-sections button[aria-current="true"]',
  ".promotion-editor-branches button.active",
  ".promotion-queue-filters button.active",
  ".promotion-bank-workflow-tabs button.active",
];

test("UI-03: tabs share one box and the active tab carries a 3px line at every width", () => {
  for (const selector of TABS) {
    assert.equal(lastDeclaration(cascadeCss, selector, "min-height"), "40px", `${selector} min-height`);
    assert.match(lastDeclaration(cascadeCss, selector, "min-height", PHONE) ?? "", /^(?:44px|var\(--tap-target\))$/u, `${selector} phone min-height`);
    assert.equal(lastDeclaration(cascadeCss, selector, "padding"), "0 16px", `${selector} padding`);
    assert.equal(lastDeclaration(cascadeCss, selector, "border-radius"), "var(--radius-tab)", `${selector} radius`);
    assert.equal(lastDeclaration(cascadeCss, selector, "font-size"), "11px", `${selector} font-size`);
    assert.equal(lastDeclaration(cascadeCss, selector, "font-weight"), "700", `${selector} font-weight`);
  }
  // No context argument: the line is declared outside any media query, so it holds on every width.
  for (const selector of ACTIVE_TABS) {
    assert.match(lastDeclaration(cascadeCss, selector, "box-shadow") ?? "", /inset 0 -3px 0 var\(--teal\)/u, `${selector} active line`);
  }
  // 26-07 moved the section tabs to aria-current; the old aria-pressed selector matched nothing and is gone (26-09).
  assert.doesNotMatch(portiaCss, /\.editor-section-tabs nav button\[aria-pressed="true"\]/u);
});

test("UI-03: the save-error line of a tab outranks the active line", () => {
  for (const selector of [".editor-tabs button[data-save-error]", ".editor-tabs button.active[data-save-error]"]) {
    assert.match(lastDeclaration(cascadeCss, selector, "box-shadow") ?? "", /inset 0 -2px 0 var\(--danger\)/u, selector);
  }
  assert.ok(
    lastRuleIndex(cascadeCss, ".editor-tabs button.active[data-save-error]", "box-shadow") > lastRuleIndex(cascadeCss, ".editor-tabs button.active", "box-shadow"),
    "the error line comes after the active line",
  );
});

test("UI-03: list rows share one card box, one title size and one caption size", () => {
  for (const selector of ROW_SELECTORS) {
    assert.equal(lastDeclaration(cascadeCss, selector, "border-radius"), "var(--radius-card)", `${selector} radius`);
    assert.equal(lastDeclaration(cascadeCss, selector, "padding"), "8px 16px", `${selector} padding`);
  }
  assert.equal(lastDeclaration(cascadeCss, ".editor-record-list", "gap"), "8px");
  for (const title of [".editor-record-list strong", ".users-nickname", ".users-row-main strong", ".personnel-list > button > strong", ".global-result-heading strong"]) {
    assert.equal(lastDeclaration(cascadeCss, title, "font-size"), "13px", `${title} title size`);
    assert.equal(lastDeclaration(cascadeCss, title, "font-weight"), "700", `${title} title weight`);
  }
  for (const caption of [".editor-record-list small", ".personnel-list > button > small"]) {
    assert.equal(lastDeclaration(cascadeCss, caption, "font-size"), "11px", `${caption} caption size`);
  }
});

test("UI-03: the block changes no colour, font family or animation; the access screens take only geometry from it", () => {
  const { text } = unifyBlock(portiaCss);
  for (const rule of rulesOf(text)) {
    for (const [name, value] of declarations(rule.body)) {
      assert.ok(!["color", "background", "background-color", "font-family", "font"].includes(name), `${rule.selectors.join(", ")} sets ${name}`);
      assert.doesNotMatch(value, /var\(--(?:sans|mono|doc|display|serif)\)/u, `${rule.selectors.join(", ")} sets a font family`);
    }
  }
});

// Phase 26 (UI-03, D-11 step 4): the request card and the owner login use the dialog corner, the field box (44px kept) and the
// shared soft primary instead of a solid fill; the secondary owner action is the shared secondary. Width, radios, copy stay.
const ACCESS_SUBMIT = ".access-card button:not(.access-close)";

function borderColour(selector: string) {
  return lastDeclaration(portiaCss, selector, "border-color") ?? lastDeclaration(portiaCss, selector, "border") ?? "";
}

test("UI-03 (D-11 step 4): the request card and the owner login have the dialog corner and the field box", () => {
  for (const card of [".access-card", ".owner-login-card"]) {
    assert.equal(lastDeclaration(portiaCss, card, "border-radius"), "var(--radius-dialog)", `${card} corner`);
    assert.equal(lastDeclaration(portiaCss, card, "width"), "min(440px, 100%)", `${card} keeps its width`);
  }
  for (const field of [".access-card input:not([type=radio])", ".owner-login-card input"]) {
    assert.equal(lastDeclaration(portiaCss, field, "border-radius"), "var(--radius-field)", `${field} radius`);
    assert.equal(lastDeclaration(portiaCss, field, "min-height"), "44px", `${field} height`);
  }
  // The fieldset radios stay as they were.
  assert.equal(lastDeclaration(portiaCss, ".access-card fieldset input", "width"), "18px");
  assert.equal(lastDeclaration(portiaCss, ".access-card fieldset input", "height"), "18px");
  assert.equal(lastDeclaration(portiaCss, ".access-card fieldset input", "accent-color"), "var(--teal)");
});

test("UI-03 (D-11 step 4): the submit buttons are the soft primary, 44px; the second owner action is the secondary", () => {
  for (const button of [ACCESS_SUBMIT, ".owner-login-card button"]) {
    assert.equal(lastDeclaration(portiaCss, button, "background"), "var(--teal-soft)", `${button}: no solid fill`);
    assert.match(borderColour(button), /var\(--teal-dim\)/u, `${button} border`);
    assert.equal(lastDeclaration(portiaCss, button, "color"), "var(--teal)", `${button} text`);
    assert.equal(lastDeclaration(portiaCss, button, "min-height"), "44px", `${button} height`);
    assert.equal(lastDeclaration(portiaCss, button, "border-radius"), "var(--radius-control)", `${button} corner`);
  }
  // The reopen button floats over the desktop: the same soft fill over an opaque panel, so it stays readable.
  assert.match(lastDeclaration(portiaCss, ".access-reopen", "background") ?? "", /var\(--teal-soft\)[\s\S]*var\(--panel\)/u);
  assert.match(borderColour(".access-reopen"), /var\(--teal-dim\)/u);
  assert.equal(lastDeclaration(portiaCss, ".access-reopen", "color"), "var(--teal)");
  assert.equal(lastDeclaration(portiaCss, `${ACCESS_SUBMIT}:hover:not(:disabled)`, "border-color"), "var(--teal)", "hover strengthens the border");
  assert.doesNotMatch(portiaCss, /background:\s*var\(--teal\);\s*color:\s*var\(--desktop-base\)/u, "the solid accent fill is gone");
  assert.equal(lastDeclaration(portiaCss, ".owner-login-actions button:last-child", "background"), "transparent");
  assert.equal(lastDeclaration(portiaCss, ".owner-login-actions button:last-child", "color"), lastDeclaration(portiaCss, ".secondary-control", "color"), "the shared secondary text");
});

// Phase 26 (UI-05, D-22): the close cross of a window sits in the extreme top-right corner. The controls fill the right end
// of the title bar (46x46, the height of the PC bar; recorded as a legacy exception to the 44px minimum, A10), render above
// the resize edges and keep their markup: three buttons, close last, none on a locked window.
const windowSource = lf(readFileSync(new URL("../components/portia-desktop-window.tsx", import.meta.url), "utf8"));
const WINDOW_BUTTON = ".window-controls button";

test("UI-05: the window controls sit flush in the top-right corner of the title bar, 46x46, above the resize edges", () => {
  assert.equal(lastDeclaration(portiaCss, ".window-titlebar", "padding-right"), "0");
  assert.ok(
    lastRuleIndex(portiaCss, ".window-titlebar", "padding-right") > lastRuleIndex(portiaCss, ".window-titlebar", "padding"),
    "no later padding shorthand gives the bar a right padding back",
  );
  assert.equal(lastDeclaration(portiaCss, ".window-titlebar", "height"), "46px");
  assert.equal(lastDeclaration(portiaCss, ".window-controls", "gap"), "0");
  assert.equal(lastDeclaration(portiaCss, ".window-controls", "position"), "relative");
  assert.equal(lastDeclaration(portiaCss, ".window-controls", "align-self"), "stretch");
  assert.equal(lastDeclaration(portiaCss, ".window-controls", "align-items"), "flex-start");
  const controlsZ = Number(lastDeclaration(portiaCss, ".window-controls", "z-index"));
  const edgeZ = Number(lastDeclaration(portiaCss, ".window-edge", "z-index"));
  assert.equal(controlsZ, 10);
  assert.ok(controlsZ > edgeZ, "the controls render above the resize edges, so the NE corner is inert under them");
  assert.equal(lastDeclaration(portiaCss, WINDOW_BUTTON, "width"), "46px");
  assert.equal(lastDeclaration(portiaCss, WINDOW_BUTTON, "height"), "46px");
  assert.equal(lastDeclaration(portiaCss, WINDOW_BUTTON, "border-radius"), "var(--radius-control)");
  assert.equal(lastDeclaration(portiaCss, WINDOW_BUTTON, "background"), "transparent");
  assert.equal(lastDeclaration(portiaCss, WINDOW_BUTTON, "border"), "0");
  assert.equal(lastDeclaration(portiaCss, WINDOW_BUTTON, "border-left"), "1px solid var(--line)");
  const dividerRule = lastRuleIndex(portiaCss, WINDOW_BUTTON, "border-left");
  const resetRule = lastRuleIndex(portiaCss, WINDOW_BUTTON, "border");
  const order = declarations(rulesOf(portiaCss)[dividerRule].body).map(([name]) => name);
  assert.ok(
    dividerRule > resetRule || (dividerRule === resetRule && order.lastIndexOf("border-left") > order.lastIndexOf("border")),
    "the divider survives the border reset",
  );
  assert.equal(lastDeclaration(portiaCss, '.window-controls button[data-window-action="close"]', "font-size"), "18px");
  // Hover keeps the existing neutral and danger colours.
  assert.match(lastDeclaration(portiaCss, ".window-controls button:hover", "background") ?? "", /^oklch\(\.31 /u);
  assert.equal(lastDeclaration(portiaCss, ".window-controls button:last-child:hover", "background"), "#5d2d29");
  assert.equal(lastDeclaration(portiaCss, ".window-controls button:last-child:hover", "border-color"), "#a65750");
  // N and E edges still resize; the NE corner stays in place under the controls.
  assert.equal(lastDeclaration(portiaCss, ".window-edge-n", "top"), "0");
  assert.equal(lastDeclaration(portiaCss, ".window-edge-e", "right"), "0");
  assert.equal(lastDeclaration(portiaCss, ".window-edge-ne", "cursor"), "nesw-resize");
});

// UAT 2026-11-16 gap 2: the 1px frame of the window used to lie between the 46x46 close button and the window edge (the border sat
// outside the overflow clip), so the top and right strip, and the radius step (inner 9px against outer 10px), belonged to the window.
// Now the frame is a non-interactive overlay and the button reaches the outer edge; the radius 10px clips it to the window outline.
test("UI-05 (UAT 2026-11-16): the window frame is a non-interactive overlay, so the close button owns the corner", () => {
  const ACTIVE_BORDER = "oklch(.536 calc(.043 * var(--accent-chroma)) var(--accent-hue))";
  assert.equal(lastDeclaration(cascadeCss, ".app-window", "border"), "0", "the window box itself has no border");
  assert.equal(lastDeclaration(cascadeCss, ".app-window", "border", PHONE), "0", "the phone rules do not give the border back");
  for (const property of ["border-width", "border-top", "border-right", "border-top-width", "border-right-width"]) {
    assert.equal(lastDeclaration(cascadeCss, ".app-window", property, PHONE), undefined, `.app-window has no ${property}`);
  }
  const frame = ".app-window::after";
  assert.equal(lastDeclaration(cascadeCss, frame, "content"), '""');
  assert.equal(lastDeclaration(cascadeCss, frame, "position"), "absolute");
  assert.equal(lastDeclaration(cascadeCss, frame, "inset"), "0");
  assert.equal(lastDeclaration(cascadeCss, frame, "border"), "1px solid var(--line-bright)");
  // Not `inherit`: style-tokens (UI-02) allows only role tokens; every window has the radius var(--radius-window), phone included.
  assert.equal(lastDeclaration(cascadeCss, frame, "border-radius"), "var(--radius-window)");
  assert.equal(lastDeclaration(cascadeCss, frame, "pointer-events"), "none", "the frame never takes a click from the controls (T-26-35)");
  assert.equal(lastDeclaration(cascadeCss, frame, "background"), undefined, "the frame draws a line only, no fill (T-26-35)");
  const frameZ = Number(lastDeclaration(cascadeCss, frame, "z-index"));
  assert.ok(Number.isInteger(frameZ) && frameZ > Number(lastDeclaration(portiaCss, ".window-controls", "z-index")), "the frame is above the controls");
  assert.equal(lastDeclaration(cascadeCss, ".app-window.is-active::after", "border-color"), ACTIVE_BORDER, "the active frame colour is the old one");
  assert.equal(lastDeclaration(cascadeCss, ".app-window.is-active", "border-color"), ACTIVE_BORDER, "the old active rule stays as history");
  // D-03: the window radius of a normal window does not change. The 8px gap of the maximized window is gone at the owner's
  // request of 2026-11-17 (quick 261117-bi1 R1): a maximized window is flush with the work area, so the close button owns the corner.
  assert.equal(lastDeclaration(cascadeCss, ".app-window", "border-radius"), "var(--radius-window)");
  assert.equal(lastDeclaration(cascadeCss, ".app-window.is-maximized", "inset"), "0");
  // The overlay lives in the ui-unify block, after the rules it overrides.
  assert.ok(unifyBlock(portiaCss).text.includes(".app-window::after"), "the frame rule is inside the ui-unify block");
  assert.ok(lastRuleIndex(portiaCss, ".app-window", "border") > lastRuleIndex(portiaCss, ".app-window.is-active", "border-color"));
});

test("UI-05 / D-22: on a phone the window controls are 46x46 too, flush in the corner, without a drawn frame", () => {
  assert.equal(lastDeclaration(portiaCss, WINDOW_BUTTON, "width", PHONE), "46px");
  assert.equal(lastDeclaration(portiaCss, WINDOW_BUTTON, "height", PHONE), "46px");
  assert.equal(lastDeclaration(portiaCss, WINDOW_BUTTON, "background", PHONE), "transparent");
  assert.equal(lastDeclaration(portiaCss, ".window-controls", "gap", PHONE), "0");
  assert.equal(lastDeclaration(portiaCss, ".window-titlebar", "padding-right", PHONE), "0");
  // The sticky offsets of phone windows (top: 48px) rest on this height.
  assert.equal(lastDeclaration(portiaCss, ".window-titlebar", "height", PHONE), "48px");
  assert.equal(lastDeclaration(portiaCss, '.window-controls button[data-window-action="maximize"]', "display", PHONE), "none");
  // No frame drawn inside the hit area any more, and the phone hover is the desktop hover.
  for (const rule of rulesOf(portiaCss)) {
    for (const selector of rule.selectors) {
      if (!selector.startsWith(WINDOW_BUTTON) || !selector.includes("::before")) continue;
      assert.ok(!declarations(rule.body).some(([name]) => name === "content"), `${selector} must not draw a frame`);
    }
  }
  assert.doesNotMatch(lastDeclaration(portiaCss, WINDOW_BUTTON, "isolation", PHONE) ?? "", /isolate/u);
  assert.equal(lastDeclaration(portiaCss, ".window-controls button:last-child:hover", "background", PHONE), "#5d2d29");
  assert.match(lastDeclaration(portiaCss, ".window-controls button:hover", "background", PHONE) ?? "", /^oklch\(\.31 /u);
});

test("UI-05: the window markup keeps three controls with close last and none on a locked window", () => {
  const start = windowSource.indexOf('{!locked && <div className="window-controls">');
  assert.ok(start > 0, "the controls render only on an unlocked window");
  const controls = windowSource.slice(start, windowSource.indexOf("</div>}", start));
  assert.deepEqual([...controls.matchAll(/data-window-action="([a-z]+)"/gu)].map((match) => match[1]), ["minimize", "maximize", "close"]);
  assert.match(controls, /aria-label=\{`Закрыть \$\{appMeta\[app\]\.label\}`\}>×<\/button>$/u);
});

// Phase 26 (UI-05): every layer with a cross closes through one corner button, `.corner-close` (44x44, flush top: 0;
// right: 0, sharp, a 20px glyph). Two headers keep their own button rules with a higher specificity
// (`.custom-color-picker-head button`, `.floating-text-format > header button`), so the corner rule names them too.
const CORNER_SELECTORS = [".corner-close", ".custom-color-picker-head .corner-close", ".floating-text-format > header .corner-close"];
// The five crosses under guard: the request card, the two notification toasts, the colour picker, the format panel.
const cornerCrossSites = [
  { file: "components/portia-access-gate.tsx", label: "Закрыть заявку", count: 1, keep: "access-close" },
  { file: "components/portia-access-gate.tsx", label: "Закрыть уведомление", count: 1, keep: "quest-toast-close" },
  { file: "components/portia-desktop.tsx", label: "Закрыть уведомление", count: 2, keep: "quest-toast-close" },
  { file: "components/custom-color-picker.tsx", label: "Закрыть выбор цвета", count: 1, keep: null },
  { file: "components/portia-editor-rich-text.tsx", label: "Закрыть панель оформления", count: 1, keep: null },
] as const;
// The layer that anchors the cross, and the heading row that leaves 44px on the right so nothing slides under it.
const CORNER_LAYERS = [".access-card", ".quest-toast", ".custom-color-picker", ".floating-text-format"];
const CORNER_HEADS = [".quest-toast-head", ".custom-color-picker-head", ".floating-text-format > header"];

function buttonTags(source: string, label: string) {
  const tags: string[] = [];
  for (let at = source.indexOf(`aria-label="${label}"`); at >= 0; at = source.indexOf(`aria-label="${label}"`, at + 1)) {
    tags.push(source.slice(source.lastIndexOf("<button", at), source.indexOf("</button>", at)));
  }
  return tags;
}

test("UI-05: the shared corner cross is 44x44, flush in the corner, sharp, with a 20px glyph", () => {
  for (const selector of CORNER_SELECTORS) {
    for (const context of [undefined, PHONE]) {
      const at = `${selector}${context ? " (phone)" : ""}`;
      assert.equal(lastDeclaration(portiaCss, selector, "width", context), "44px", `${at} width`);
      assert.equal(lastDeclaration(portiaCss, selector, "height", context), "44px", `${at} height`);
      assert.equal(lastDeclaration(portiaCss, selector, "position", context), "absolute", `${at} position`);
      assert.equal(lastDeclaration(portiaCss, selector, "top", context), "0", `${at} top`);
      assert.equal(lastDeclaration(portiaCss, selector, "right", context), "0", `${at} right`);
      assert.equal(lastDeclaration(portiaCss, selector, "border-radius", context), "var(--radius-control)", `${at} radius`);
      assert.equal(lastDeclaration(portiaCss, selector, "font-size", context), "20px", `${at} glyph`);
      assert.equal(lastDeclaration(portiaCss, selector, "border", context), "0", `${at} border`);
      assert.equal(lastDeclaration(portiaCss, selector, "background", context), "transparent", `${at} background`);
      assert.equal(lastDeclaration(portiaCss, selector, "color", context), "inherit", `${at} colour`);
    }
    assert.equal(lastDeclaration(portiaCss, `${selector}:hover`, "background"), "#5d2d29", `${selector} danger hover`);
  }
  // The old offsets of the request card cross are gone from the cascade.
  assert.equal(lastDeclaration(portiaCss, ".access-close", "right"), "12px", "the old rule stays as history, overridden below");
  assert.ok(lastRuleIndex(portiaCss, ".corner-close", "right") > lastRuleIndex(portiaCss, ".access-close", "right"));
  assert.ok(lastRuleIndex(portiaCss, ".corner-close", "min-height") > lastRuleIndex(portiaCss, ".quest-toast-close", "min-height"));
  // The raised selectors are needed: the headers really have their own button rules.
  assert.equal(lastDeclaration(portiaCss, ".custom-color-picker-head button", "width"), "24px");
  assert.equal(lastDeclaration(portiaCss, ".floating-text-format > header button", "width"), "28px");
});

test("UI-05 / T-26-07: the cross is anchored to its layer and the heading row leaves it 44px", () => {
  for (const layer of CORNER_LAYERS) {
    for (const context of [undefined, PHONE]) {
      assert.match(lastDeclaration(portiaCss, layer, "position", context) ?? "", /^(?:relative|fixed|absolute)$/u, `${layer} anchors the cross`);
    }
  }
  assert.equal(lastDeclaration(portiaCss, ".custom-color-picker", "position"), "relative");
  for (const head of CORNER_HEADS) {
    for (const context of [undefined, PHONE]) {
      assert.equal(lastDeclaration(portiaCss, head, "padding-right", context), "44px", `${head} padding-right`);
      assert.equal(lastDeclaration(portiaCss, head, "min-height", context), "44px", `${head} min-height`);
    }
    assert.ok(lastRuleIndex(portiaCss, head, "padding-right") > lastRuleIndex(portiaCss, head, "padding"), `${head}: no later padding shorthand`);
  }
  // The heading rows of the toast and the picker touch the top of their layer, so the 44px row is the 44px cross.
  assert.equal(lastDeclaration(portiaCss, ".quest-toast > div", "padding-top"), "0");
  assert.equal(lastDeclaration(portiaCss, ".custom-color-picker", "padding-top"), "0");
  assert.ok(lastRuleIndex(portiaCss, ".custom-color-picker", "padding-top") > lastRuleIndex(portiaCss, ".custom-color-picker", "padding"));
  assert.ok(lastRuleIndex(portiaCss, ".quest-toast > div", "padding-top") > lastRuleIndex(portiaCss, ".quest-toast > div", "padding"));
});

test("UI-05: the five crosses carry corner-close and keep their old classes and labels", () => {
  for (const site of cornerCrossSites) {
    const source = lf(readFileSync(new URL(`../${site.file}`, import.meta.url), "utf8"));
    const tags = buttonTags(source, site.label);
    assert.equal(tags.length, site.count, `${site.file}: ${site.label}`);
    for (const tag of tags) {
      const classes = (tag.match(/className="([^"]*)"/u)?.[1] ?? "").split(/\s+/u);
      assert.ok(classes.includes("corner-close"), `${site.file}: ${site.label} carries corner-close`);
      if (site.keep) assert.ok(classes.includes(site.keep), `${site.file}: ${site.label} keeps ${site.keep}`);
      assert.match(tag, /type="button"/u);
      assert.ok(tag.endsWith(">×"), `${site.file}: ${site.label} keeps the × glyph`);
    }
  }
});

// Phase 26 (UI-06, D-01 … D-04, D-19): a maximized window differs from a normal one only in layout. The only hook is
// `.app-window.is-maximized` (inset 0 and square corners since quick 261117-bi1); every new rule under it sits in the desktop query, so the
// normal window and the phone keep their layouts. No container queries on the window (they re-anchor fixed elements).
const globalsCss = lf(readFileSync(new URL("../app/globals.css", import.meta.url), "utf8"));
const ALL_STYLESHEETS = [
  ["app/portia.css", portiaCss],
  ["app/portia-promotion-editor.css", promotionCss],
  ["app/globals.css", globalsCss],
] as const;
const MAXIMIZED = ".app-window.is-maximized";
const DESKTOP = "width > 900px";
// R1 (UI-SPEC): 360px minimum card, at most four columns, 2–4 on 1366–2560px screens.
const R1_COLUMNS = "repeat(auto-fill, minmax(max(var(--card-min), calc((100% - 24px) / 4)), 1fr))";
// The two rules that predate Phase 26 and hold on every width: the inset and the hidden resize edges.
const HISTORIC_MAXIMIZED = [MAXIMIZED, `${MAXIMIZED} .window-edge`];
const desktopSource = lf(readFileSync(new URL("../components/portia-desktop.tsx", import.meta.url), "utf8"));
const searchIndexSource = lf(readFileSync(new URL("./search-index.ts", import.meta.url), "utf8"));

test("UI-06 / D-01: «Доступные записи» are a card grid in a maximized search window and one column otherwise", () => {
  const results = `${MAXIMIZED} .global-search-results`;
  assert.equal(lastDeclaration(portiaCss, results, "display", DESKTOP), "grid");
  assert.equal(lastDeclaration(portiaCss, results, "gap", DESKTOP), "8px");
  assert.equal(lastDeclaration(portiaCss, results, "grid-template-columns", DESKTOP), R1_COLUMNS);
  // A normal-size window and the phone keep the single column: the list itself sets no columns at any width.
  assert.equal(lastDeclaration(portiaCss, ".global-search-results", "grid-template-columns", DESKTOP), undefined);
  assert.equal(lastDeclaration(portiaCss, ".global-search-results", "grid-template-columns", PHONE), undefined);
  assert.equal(lastDeclaration(portiaCss, results, "grid-template-columns", PHONE), undefined, "the phone is not touched");
  // Cards stay row cards that fill their cell; the title ends in an ellipsis.
  assert.equal(lastDeclaration(portiaCss, ".global-result", "width"), "100%");
  assert.equal(lastDeclaration(portiaCss, `${MAXIMIZED} .global-result`, "min-width", DESKTOP), "0");
  assert.equal(lastDeclaration(portiaCss, ".global-result-heading strong", "text-overflow"), "ellipsis");
  // The empty state spans the grid and stays centred in the pane.
  assert.equal(lastDeclaration(portiaCss, `${MAXIMIZED} .global-search-empty`, "grid-column", DESKTOP), "1 / -1");
  assert.equal(lastDeclaration(portiaCss, `${MAXIMIZED} .global-search-empty`, "justify-self", DESKTOP), "stretch");
  assert.equal(lastDeclaration(portiaCss, ".global-search-empty", "text-align"), "center");
  assert.equal(lastDeclaration(portiaCss, ".global-search-empty", "align-items"), "center");
  assert.match(desktopSource, /<div className="global-search-results"[^>]*>[\s\S]*?\{!searchRows\.length && <div className="global-search-empty/u, "the empty state lives inside the result grid");
});

test("UI-06 / D-02 (R2): the search box and the header of a maximized search window stop at 640px", () => {
  for (const selector of [`${MAXIMIZED} .global-search-box`, `${MAXIMIZED} .global-search-header`]) {
    assert.equal(lastDeclaration(portiaCss, selector, "max-width", DESKTOP), "var(--field-max)", selector);
  }
  assert.match(portiaCss, /--field-max: 640px;/u);
  assert.match(portiaCss, /--card-min: 360px;/u);
});

test("UI-06: keyboard order over the result grid stays the DOM order (Up/Down only, no Left/Right)", () => {
  assert.match(searchIndexSource, /key === "ArrowDown"/u);
  assert.match(searchIndexSource, /key === "ArrowUp"/u);
  assert.doesNotMatch(searchIndexSource, /ArrowLeft|ArrowRight/u);
  const handlerStart = desktopSource.indexOf("const onSearchKeyDown");
  assert.ok(handlerStart > 0);
  assert.doesNotMatch(desktopSource.slice(handlerStart, desktopSource.indexOf("\n  };", handlerStart)), /ArrowLeft|ArrowRight/u);
});

test("UI-06 / D-03: the maximized hook is unchanged, the only one, and never a container", () => {
  // quick 261117-bi1 R1 (owner, 2026-11-17): the inset is 0 and the corners are square, on a PC only; a normal window keeps its radius.
  assert.equal(lastDeclaration(portiaCss, MAXIMIZED, "inset"), "0");
  assert.equal(lastDeclaration(portiaCss, MAXIMIZED, "transform"), "none");
  assert.equal(lastDeclaration(portiaCss, ".app-window", "border-radius"), "var(--radius-window)");
  assert.equal(lastDeclaration(portiaCss, MAXIMIZED, "border-radius"), undefined, "no top-level radius on the maximized window");
  assert.equal(lastDeclaration(portiaCss, MAXIMIZED, "border-radius", DESKTOP), "0", "square corners in the desktop query");
  for (const [file, css] of ALL_STYLESHEETS) {
    for (const rule of rulesOf(css)) {
      const containerHost = rule.selectors.some((selector) => /\.app-window|\.workspace\b/u.test(selector));
      if (containerHost) {
        for (const [name] of declarations(rule.body)) {
          assert.ok(name !== "container-type" && name !== "container", `${file}: ${rule.selectors.join(", ")} must not be a container`);
        }
      }
      for (const selector of rule.selectors) {
        if (!selector.includes("is-maximized")) continue;
        assert.ok(selector.startsWith(MAXIMIZED), `${file}: ${selector} must start with ${MAXIMIZED}`);
        if (HISTORIC_MAXIMIZED.includes(selector)) continue;
        assert.ok(/(?:width > 900|min-width: 1281)px/u.test(rule.context ?? ""), `${file}: ${selector} must sit in a desktop @media (min-width) so the phone is not touched`);
      }
    }
  }
});

// quick 261117-bi1 (R1): the owner could not hit the close button in the very corner of a maximized window: the window sat 8px inside the
// work area. The hit area cannot grow outside the window (`overflow: hidden` clips clicks), so the window moves: inset 0, square corners.
test("quick 261117-bi1 R1 fix: the title bar has exactly two tracks, so no empty track and gap push the controls off the right edge", () => {
  // The bar holds two children (identity, controls). A third empty `auto` track still takes the 18px column gap,
  // which left a dead strip right of the close cross (owner screenshot 2026-11-17).
  const children = windowSource.slice(windowSource.indexOf('<div className="window-titlebar"'), windowSource.indexOf("{children}"));
  assert.ok(!children.includes("window-meta"), "the bar renders no third (meta) child");
  assert.equal(lastDeclaration(portiaCss, ".window-titlebar", "grid-template-columns"), "1fr auto");
});

test("quick 261117-bi1 R1: a maximized window is flush with the work area and square; a normal window keeps its frame", () => {
  assert.equal(lastDeclaration(cascadeCss, MAXIMIZED, "inset"), "0");
  assert.equal(lastDeclaration(cascadeCss, MAXIMIZED, "border-radius", DESKTOP), "0", "the window clips with square corners, so no corner pixel of the button falls through");
  assert.equal(lastDeclaration(cascadeCss, `${MAXIMIZED}::after`, "border-radius", DESKTOP), "0", "the frame layer is square too");
  assert.equal(lastDeclaration(cascadeCss, ".app-window", "border-radius"), "var(--radius-window)");
  assert.equal(lastDeclaration(cascadeCss, ".app-window::after", "border-radius"), "var(--radius-window)");
  assert.equal(lastDeclaration(cascadeCss, ".window-titlebar", "padding-right"), "0", "the controls reach the right edge");
  assert.equal(lastDeclaration(cascadeCss, ".window-controls button", "width"), "46px");
  assert.equal(lastDeclaration(cascadeCss, ".window-controls button", "height"), "46px");
  assert.equal(lastDeclaration(cascadeCss, ".app-window::after", "pointer-events"), "none", "the frame never takes the click");
  assert.equal(lastDeclaration(cascadeCss, MAXIMIZED, "width"), "auto");
  assert.equal(lastDeclaration(cascadeCss, MAXIMIZED, "height"), "auto");
});

// quick 261117-bi1 (R3): only in a maximized editor window on a PC, the list column of the page-scrolling list/detail tabs is a sticky column
// as tall as the visible area, under a bar of one row. The 218px is the sum of the stylesheet's own heights, proved below.
const ONE_ROW_BAR = ".content-editor:not(:has(.etab-draft-label)):not(:has(.etab-banner)):not(:has(.editor-section-create:not([hidden])))";
const FULL_LISTS = [
  `${MAXIMIZED} ${ONE_ROW_BAR} > .etab-body:not(.employee-editor-layout) > .etab-list`,
  `${MAXIMIZED} ${ONE_ROW_BAR} > .users-tab > .etab-body > .etab-list`,
];
const px = (value: string | undefined) => Number.parseFloat(value ?? "NaN");

test("quick 261117-bi1 R3: the maximized editor list column is sticky and calc(100svh - 218px) tall, 218 derived from the stylesheet", () => {
  const systemBar = px(lastDeclaration(portiaCss, ".system-bar", "height"));
  const taskbar = px(lastDeclaration(portiaCss, ".taskbar", "height"));
  const titlebar = px(lastDeclaration(portiaCss, ".window-titlebar", "height"));
  const barHeight = px(lastDeclaration(cascadeCss, ".etab-bar", "min-height"));
  const barGap = px((lastDeclaration(cascadeCss, ".etab-bar", "margin") ?? "").split(" ")[2]);
  const padding = px(lastDeclaration(portiaCss, ".content-editor", "padding"));
  assert.deepEqual([systemBar, taskbar, titlebar, barHeight, barGap, padding], [44, 44, 46, 48, 8, 28], "the heights the 218px is made of");
  const stickyTop = barHeight + barGap;
  const total = systemBar + taskbar + titlebar + stickyTop + padding;
  assert.equal(total, 218);
  assert.equal(lastDeclaration(cascadeCss, ".workspace", "min-height"), "calc(100svh - 88px)", "the work area is the viewport less the two 44px bars");
  assert.equal(lastDeclaration(cascadeCss, ".content-editor", "height"), "calc(100% - 46px)", "the editor is the window less its 46px title bar");
  for (const selector of FULL_LISTS) {
    assert.equal(lastDeclaration(portiaCss, selector, "position", DESKTOP), "sticky", selector);
    assert.equal(lastDeclaration(portiaCss, selector, "top", DESKTOP), `${stickyTop}px`, "it sticks under the bar");
    assert.equal(lastDeclaration(portiaCss, selector, "align-self", DESKTOP), "start");
    assert.equal(lastDeclaration(portiaCss, selector, "overflow-y", DESKTOP), "auto");
    assert.equal(lastDeclaration(portiaCss, selector, "max-height", DESKTOP), `calc(100svh - ${total}px)`);
    assert.equal(lastDeclaration(portiaCss, selector, "max-height"), undefined, "nothing outside the desktop query");
    assert.ok(selector.startsWith(MAXIMIZED), "only a maximized window");
    assert.ok(selector.includes(":not(.employee-editor-layout)") || selector.includes("> .users-tab >"), "never the «Сотрудники» body");
    assert.doesNotMatch(selector, /promotion/u, "never «Повышение»");
    assert.ok(!selector.includes(","), "no comma inside the selector (the parsers split on it)");
  }
  for (const selector of FULL_LISTS.map((list) => `${list} .editor-toc ol`)) {
    assert.equal(lastDeclaration(portiaCss, selector, "max-height", DESKTOP), "none", "the TOC list uses the column height");
  }
  // The old lists stay as they were.
  assert.equal(lastDeclaration(portiaCss, ".editor-record-list", "max-height"), "min(62svh, 620px)");
  assert.equal(lastDeclaration(portiaCss, ".editor-record-list", "position"), "static");
  assert.equal(lastDeclaration(portiaCss, ".editor-toc ol", "max-height"), "40svh");
  assert.equal(lastDeclaration(portiaCss, ".content-editor > .employee-editor-layout", "flex", DESKTOP), "1 1 0", "«Сотрудники» keeps its own full-height layout");
});

// D-04: every window is checked maximized against the UI-SPEC recipes. Each entry names its outcome; the checks below
// hold the evidence (selectors in the cascade, never "looks fine"). Pixel lanes at 1366/1920/2560 are BLOCKED (ENV).
const R3 = "min-width: 1281px";
const R3_COLUMNS = "repeat(2, minmax(0, 1fr))";
const LIST_COLUMN = "clamp(270px, 24%, 340px) minmax(0, 1fr)";
const EDITOR_CARD_COLUMNS = "repeat(auto-fill, minmax(min(100%, var(--editor-card-width)), var(--editor-card-width)))";
const documentsSource = lf(readFileSync(new URL("../components/portia-desktop-documents.tsx", import.meta.url), "utf8"));
const at = (selector: string) => `${MAXIMIZED} ${selector}`;

/** R5: the pane of a window fills it under the 46px title bar and scrolls inside (no band below the content). */
function assertFillsWindow(selector: string) {
  assert.equal(lastDeclaration(portiaCss, selector, "height", DESKTOP), "calc(100% - 46px)", `${selector} fills the window`);
}

/**
 * UAT 2026-11-16 gap 3 — владелец: маленькая карточка «Повышения» посреди развёрнутого окна. Вход — всё окно (знак слева, шапка
 * справа, форма и пояснения рядом в две колонки), статус — шапка и карточки заявок на всю ширину, карточки в 2 колонки.
 */
function assertPromotionFillsWindow() {
  for (const host of [at(".promotion-gate"), at(".promotion-shell")]) {
    assert.equal(lastDeclaration(portiaCss, host, "width", DESKTOP), "auto", `${host} no longer a 680px column`);
    assert.equal(lastDeclaration(portiaCss, host, "margin", DESKTOP), "0", `${host} is not centred`);
  }
  const gate = at(".promotion-gate");
  assert.equal(lastDeclaration(portiaCss, gate, "align-content", DESKTOP), "start");
  assert.equal(lastDeclaration(portiaCss, gate, "grid-template-columns", DESKTOP), "72px minmax(0, 1fr) minmax(0, 1fr)");
  assert.equal(lastDeclaration(portiaCss, at(".promotion-gate > header"), "grid-column", DESKTOP), "2 / -1");
  assert.equal(lastDeclaration(portiaCss, at(".promotion-gate > form"), "grid-column", DESKTOP), "2");
  assert.equal(lastDeclaration(portiaCss, at(".promotion-gate:has(> form) > p"), "grid-column", DESKTOP), "3");
  assert.equal(lastDeclaration(portiaCss, at(".promotion-gate:not(:has(> form)) > p"), "grid-column", DESKTOP), "2 / -1");
  const flow = at(".promotion-flow-list");
  assert.equal(lastDeclaration(portiaCss, flow, "display", DESKTOP), "grid");
  assert.equal(lastDeclaration(portiaCss, flow, "gap", DESKTOP), "24px");
  assert.equal(lastDeclaration(portiaCss, flow, "grid-template-columns", DESKTOP), "repeat(auto-fill, minmax(max(var(--card-min), calc((100% - 24px) / 2)), 1fr))");
  // R2: the nickname field still stops at 640px.
  assert.equal(lastDeclaration(portiaCss, at(".promotion-gate input"), "max-width", DESKTOP), "var(--field-max)");
}

const MAXIMIZED_WINDOWS: { app: string; outcome: "fixed" | "already conformant"; check: () => void }[] = [
  { app: "search", outcome: "fixed", check: () => {
    // «Доступные записи» — все при развёрнутом окне (план 26-15, UAT 2026-11-16 gap 3).
    assert.equal(lastDeclaration(portiaCss, at(".global-search-results"), "grid-template-columns", DESKTOP), R1_COLUMNS);
    assert.equal(lastDeclaration(portiaCss, at(".global-search-box"), "max-width", DESKTOP), "var(--field-max)");
    assertFillsWindow(".global-search-app");
  } },
  { app: "archive", outcome: "fixed", check: () => {
    assert.equal(lastDeclaration(portiaCss, at(".archive-grid"), "grid-template-columns", DESKTOP), LIST_COLUMN);
    assertFillsWindow(".archive-grid");
    // UAT 2026-11-16 gap 3 — владелец: запись и документ учёного в узкой колонке. In a maximized window the record and the
    // scientist document take the whole pane; the 1060px paper of a normal window and of the template builder (D-55) and the
    // 820px paper stay as they are.
    assert.equal(lastDeclaration(portiaCss, ".record-document", "width"), "min(1060px, 100%)");
    assert.equal(lastDeclaration(portiaCss, ".archive-document-paper", "width"), "min(820px, calc(100% - 42px))");
    assert.equal(lastDeclaration(portiaCss, at(".archive-grid .record-document"), "width", DESKTOP), "auto");
    assert.equal(lastDeclaration(portiaCss, at(".archive-document-paper"), "width", DESKTOP), "calc(100% - 42px)");
    for (const rule of rulesOf(cascadeCss)) {
      for (const selector of rule.selectors) assert.ok(!(selector.includes("is-maximized") && selector.includes("template-card-preview")), selector);
    }
  } },
  { app: "employees", outcome: "fixed", check: () => {
    assert.equal(lastDeclaration(portiaCss, at(".personnel-app"), "grid-template-columns", DESKTOP), LIST_COLUMN);
    const body = at(".personnel-profile-body");
    assert.equal(lastDeclaration(portiaCss, body, "display", R3), "grid");
    assert.equal(lastDeclaration(portiaCss, body, "grid-template-columns", R3), R3_COLUMNS);
    assert.equal(lastDeclaration(portiaCss, body, "gap", R3), "24px");
    assert.equal(lastDeclaration(portiaCss, body, "max-width", R3), "1320px");
    for (const whole of [".personnel-profile-head", ".personnel-biography", ".personnel-stats:only-of-type"]) {
      assert.equal(lastDeclaration(portiaCss, at(`.personnel-profile-body > ${whole}`), "grid-column", R3), "1 / -1", whole);
    }
    assertFillsWindow(".personnel-app");
  } },
  { app: "info", outcome: "fixed", check: () => {
    // The index column stays as it is; the document is a reading column.
    assert.equal(lastDeclaration(portiaCss, ".info-library", "grid-template-columns", DESKTOP), "minmax(210px, 28%) minmax(0, 1fr)");
    assert.equal(lastDeclaration(portiaCss, at(".info-library"), "grid-template-columns", DESKTOP), undefined);
    assert.equal(lastDeclaration(portiaCss, at(".info-document > .content-fade"), "max-width", DESKTOP), "820px");
    assertFillsWindow(".info-library");
  } },
  { app: "guide", outcome: "fixed", check: () => {
    // Owner 2026-11-18 (round 2) replaces the UAT 2026-11-16 stretched grid and full-pane article: a maximized «Справочник» is built like
    // «Информация» — a sections index column (the columns of .info-library), compact fixed tiles that do not grow, the open card in an 820px reading column.
    assert.equal(lastDeclaration(portiaCss, ".guide-index", "display"), "none", "the index is hidden outside a maximized window");
    assert.equal(lastDeclaration(portiaCss, at(".guide-index"), "display", DESKTOP), "block");
    assert.equal(lastDeclaration(portiaCss, at(".guide-layout"), "display", DESKTOP), "grid");
    assert.equal(lastDeclaration(portiaCss, at(".guide-layout"), "grid-template-columns", DESKTOP), lastDeclaration(portiaCss, ".info-library", "grid-template-columns", DESKTOP));
    assert.equal(lastDeclaration(portiaCss, at(".guide-layout"), "grid-template-columns", DESKTOP), "minmax(210px, 28%) minmax(0, 1fr)");
    assert.equal(lastDeclaration(portiaCss, at(".guide-layout"), "height", DESKTOP), "calc(100% - 46px)");
    assert.equal(lastDeclaration(portiaCss, at(".guide-app"), "height", DESKTOP), "100%");
    assert.equal(lastDeclaration(portiaCss, at(".guide-grid"), "grid-template-columns", DESKTOP), undefined, "the tiles keep their 176px");
    assert.equal(lastDeclaration(portiaCss, ".guide-grid", "grid-template-columns", DESKTOP), "repeat(auto-fill, minmax(min(100%, 176px), 176px))");
    assert.equal(lastDeclaration(portiaCss, ".guide-page", "max-width"), "820px");
    assert.equal(lastDeclaration(portiaCss, at(".guide-page"), "max-width", DESKTOP), undefined, "the card keeps the 820px column");
    assertFillsWindow(".guide-app");
  } },
  { app: "promotion", outcome: "fixed", check: () => {
    // UAT 2026-11-16 — владелец: маленькая карточка посреди развёрнутого окна. The 680px column stays in a normal window only;
    // a maximized window shows the gate and the status over its whole width. The reviewer workbench lives in the editor's «Повышение» tab.
    assert.equal(lastDeclaration(portiaCss, ".promotion-shell", "width"), "min(680px, 100%)");
    assertPromotionFillsWindow();
    assert.equal(lastDeclaration(cascadeCss, at(".promotion-editor-workbench"), "grid-template-columns", DESKTOP), "280px minmax(0, 1fr)");
    assert.equal(lastDeclaration(cascadeCss, at(".promotion-bank-workflow .promotion-bank-layout"), "grid-template-columns", DESKTOP), "280px minmax(0, 1fr)");
    for (const cards of [".promotion-bank-items", ".promotion-request-detail dl"]) {
      assert.equal(lastDeclaration(cascadeCss, at(cards), "grid-template-columns", DESKTOP), R1_COLUMNS, cards);
      assert.equal(lastDeclaration(cascadeCss, at(cards), "gap", DESKTOP), "8px", cards);
    }
    assertFillsWindow(".promotion-app");
  } },
  { app: "settings", outcome: "fixed", check: () => {
    // UAT 2026-11-16 gap 3 — владелец: пустая правая треть «Настроек». The groups are a grid of up to 3 columns over the whole
    // pane (it carries the background, so the background and the scroll bar reach the window edge); the old 2 x 648px is gone.
    assert.equal(lastDeclaration(portiaCss, at(".settings-app"), "display", DESKTOP), "grid");
    assert.equal(lastDeclaration(portiaCss, at(".settings-app"), "grid-template-columns", DESKTOP), "repeat(auto-fill, minmax(max(var(--card-min), calc((100% - 48px) / 3)), 1fr))");
    assert.equal(lastDeclaration(portiaCss, at(".settings-app"), "column-gap", DESKTOP), "24px");
    assert.equal(lastDeclaration(portiaCss, at(".settings-app"), "align-content", DESKTOP), "start");
    for (const whole of ["header", ".content-control-entry", ".settings-footer"]) {
      assert.equal(lastDeclaration(portiaCss, at(`.settings-app > ${whole}`), "grid-column", DESKTOP), "1 / -1", whole);
    }
    assert.equal(lastDeclaration(portiaCss, at(".settings-app"), "grid-template-columns", R3), undefined, "no R3 rule is left on the settings pane");
    assert.doesNotMatch(portiaCss, /minmax\(0, 648px\)/u);
    assert.equal(lastDeclaration(portiaCss, ".settings-app", "grid-template-columns", PHONE), undefined, "the phone is not touched");
    assertFillsWindow(".settings-app");
  } },
  { app: "broadcasts", outcome: "fixed", check: () => {
    assert.equal(lastDeclaration(portiaCss, at(".broadcast-grid"), "grid-template-columns", DESKTOP), R1_COLUMNS);
    assert.equal(lastDeclaration(portiaCss, at(".broadcast-grid"), "gap", DESKTOP), "8px");
    assert.equal(lastDeclaration(portiaCss, ".broadcast-grid > .broadcast-empty", "grid-column", DESKTOP), "1 / -1");
    assertFillsWindow(".broadcasts-app");
  } },
  { app: "trash", outcome: "already conformant", check: () => {
    // A table list with a column header is not turned into cards: its columns are fr tracks that already fill the width;
    // the read-only viewer covers the list and its documents are 760/800px measures.
    assert.match(lastDeclaration(portiaCss, ".trash-list-head", "grid-template-columns") ?? "", /fr\) minmax\(220px, 1fr\)/u);
    assert.equal(lastDeclaration(portiaCss, ".trash-viewer", "inset"), "0");
    assert.equal(lastDeclaration(portiaCss, ".trash-text-document", "width"), "min(760px, 100%)");
    assert.equal(lastDeclaration(portiaCss, ".trash-image-document", "width"), "min(800px, 100%)");
    assertFillsWindow(".trash-app");
  } },
  // Owner 2026-11-18: «Шаблон» is its own window; maximized, the builder takes the whole width instead of a centred 1240px column.
  { app: "template", outcome: "fixed", check: () => {
    assert.equal(lastDeclaration(portiaCss, `${MAXIMIZED} .template-shell`, "width", DESKTOP), "auto");
    assert.equal(lastDeclaration(portiaCss, `${MAXIMIZED} .template-shell`, "margin", DESKTOP), "0");
  } },
  { app: "sheet", outcome: "already conformant", check: () => {
    assertFillsWindow(".document-app");
    assert.equal(lastDeclaration(portiaCss, ".document-app-viewport", "inset"), "0");
    // The frame is sized inline from the zoom (100% at 100%); a CSS width would break the zoom.
    assert.match(documentsSource, /style=\{\{ width: `\$\{100 \/ zoom\}%`, height: `\$\{100 \/ zoom\}%`/u);
  } },
  { app: "charter", outcome: "fixed", check: () => {
    assertFillsWindow(".document-app");
    // A closed charter replaces the frame with the redacted block, centred in the whole window below the title bar.
    const block = `${MAXIMIZED} > .access-redacted-block`;
    assert.equal(lastDeclaration(portiaCss, block, "height", DESKTOP), "calc(100% - 46px)");
    assert.equal(lastDeclaration(portiaCss, block, "max-height", DESKTOP), "none");
    assert.equal(lastDeclaration(portiaCss, ".access-redacted-block", "justify-content"), "center");
    assert.equal(lastDeclaration(portiaCss, ".access-redacted-block", "align-items"), "center");
  } },
  { app: "editor", outcome: "fixed", check: () => {
    // D-19: card forms only gain more 340px columns; flat forms (the virus form, the employee form) follow R3.
    for (const columns of [".editor-card-columns", ".editor-section-columns"]) {
      assert.equal(lastDeclaration(portiaCss, at(columns), "grid-template-columns", DESKTOP), EDITOR_CARD_COLUMNS, columns);
    }
    const virus = at(".virus-editor-form");
    assert.equal(lastDeclaration(portiaCss, virus, "display", R3), "grid");
    assert.equal(lastDeclaration(portiaCss, virus, "grid-template-columns", R3), R3_COLUMNS);
    assert.equal(lastDeclaration(portiaCss, virus, "gap", R3), "24px");
    assert.equal(lastDeclaration(portiaCss, virus, "max-width", R3), "1320px");
    for (const whole of [":not(.editor-group)", ".editor-group.stack"]) {
      assert.equal(lastDeclaration(portiaCss, at(`.virus-editor-form > ${whole}`), "grid-column", R3), "1 / -1", whole);
    }
    // The employee form has one group whose fields are already two columns: R3 caps it at 1320px.
    assert.equal(lastDeclaration(portiaCss, at(".employee-profile-editor"), "max-width", R3), "1320px");
    assertFillsWindow(".content-editor");
  } },
];

test("UI-06 / D-04: the audit list names every window of the desktop once", () => {
  const start = windowSource.indexOf("export const appMeta");
  const ids = [...windowSource.slice(start, windowSource.indexOf("};", start)).matchAll(/^ {2}([a-z]+): \{/gmu)].map((match) => match[1]);
  assert.equal(ids.length, 13);
  assert.deepEqual(MAXIMIZED_WINDOWS.map((entry) => entry.app).sort(), [...ids].sort());
});

for (const entry of MAXIMIZED_WINDOWS) {
  test(`UI-06 / D-04: maximized ${entry.app} follows the UI-SPEC recipe (${entry.outcome})`, () => entry.check());
}

test("UI-06 / D-19: two columns only for flat forms; editor cards keep their 340px width and never stretch", () => {
  assert.match(portiaCss, /--editor-card-width: 340px;/u);
  const r3Hosts: string[] = [];
  for (const [file, css] of ALL_STYLESHEETS) {
    for (const rule of rulesOf(css)) {
      if (!rule.selectors.some((selector) => selector.includes("is-maximized"))) continue;
      for (const [name, value] of declarations(rule.body)) {
        if (name === "grid-template-columns" && value === R3_COLUMNS) r3Hosts.push(...rule.selectors);
        if (rule.selectors.some((selector) => /editor-(?:card|section)-columns/u.test(selector)) && name === "grid-template-columns") {
          assert.doesNotMatch(value, /1fr/u, `${file}: ${rule.selectors.join(", ")} must not stretch editor cards`);
        }
      }
    }
  }
  assert.deepEqual(r3Hosts.sort(), [at(".personnel-profile-body"), at(".virus-editor-form")].sort(), "R3 only on flat forms (D-19)");
  for (const host of r3Hosts) {
    assert.ok(rulesOf(portiaCss).some((rule) => rule.selectors.includes(host) && rule.context?.includes(R3)), `${host} waits for 1281px`);
  }
});

test("UI-06 / D-02: no maximized rule stretches a control and the caps are 640/820/1320px", () => {
  for (const [file, css] of ALL_STYLESHEETS) {
    for (const rule of rulesOf(css)) {
      if (!rule.selectors.some((selector) => selector.includes("is-maximized"))) continue;
      for (const [name, value] of declarations(rule.body)) {
        const stretches = (name === "width" && /^100%/u.test(value)) || (/^flex(?:-grow)?$/u.test(name) && /^[1-9]/u.test(value));
        assert.ok(!stretches, `${file}: ${rule.selectors.join(", ")} { ${name}: ${value} }`);
        // Owner 2026-11-18 (round 2): the guide article exception is withdrawn, no maximized rule releases a cap any more.
        if (name === "max-width") assert.match(value, /^(?:var\(--field-max\)|820px|1320px)$/u, `${file}: ${rule.selectors.join(", ")} cap`);
      }
    }
  }
});

// UAT 2026-11-16 gap 9: the native <dialog> opened by showModal() is centred by the browser through `margin: auto`, but the Tailwind 4
// preflight resets margin on every element, so the confirmation dialog stuck to the top-left corner of the screen. `.image-framing-dialog`
// already restored it; the shared class `.portia-dialog` did not.
test("UI-03 (UAT 2026-11-16): native confirm dialogs sit in the centre of the screen", () => {
  assert.equal(lastDeclaration(cascadeCss, ".portia-dialog", "margin"), "auto");
  const DIALOG_ROOTS = [".portia-dialog", ".users-bulk-dialog", ".users-action-dialog", ".image-framing-dialog"];
  for (const rule of rulesOf(cascadeCss)) {
    for (const selector of rule.selectors.filter((entry) => DIALOG_ROOTS.includes(entry))) {
      for (const [name, value] of declarations(rule.body)) {
        if (name === "margin" || name.startsWith("margin-")) assert.equal(value, "auto", `${selector} { ${name}: ${value} } would move the dialog off the centre`);
      }
    }
  }
  // Every native dialog of the components carries the shared class, so the one rule centres all of them.
  const componentsDir = new URL("../components/", import.meta.url);
  let dialogs = 0;
  for (const file of readdirSync(componentsDir).filter((name) => name.endsWith(".tsx"))) {
    const source = lf(readFileSync(new URL(file, componentsDir), "utf8")).replace(/\/\*[\s\S]*?\*\//gu, "").replace(/^\s*\/\/.*$/gmu, "");
    for (const match of source.matchAll(/<dialog\b([^>]*)>/gu)) {
      dialogs += 1;
      assert.match(match[1], /className="[^"]*\bportia-dialog\b[^"]*"/u, `${file}: a <dialog> without the portia-dialog class`);
    }
  }
  assert.ok(dialogs >= 4, `the scan found ${dialogs} native dialogs, expected at least 4`);
});

// UAT 2026-11-16 gap 8: «Заявка ожидает решения…» is a plain paragraph, but the grid of the gate is `72px minmax(0, 1fr)` and the paragraph
// set no column, so it fell into the 72px column of the mark and broke into one word per line. Every paragraph of the gate spans the grid.
test("UI-03 (UAT 2026-11-16 gap 8): every paragraph of the promotion gate spans the whole grid", () => {
  for (const context of [undefined, PHONE, "max-width: 520px"]) {
    assert.equal(lastDeclaration(cascadeCss, ".promotion-gate > p", "grid-column", context), "1 / -1", `context ${String(context)}`);
  }
  const promotionSource = lf(readFileSync(new URL("../components/portia-promotion.tsx", import.meta.url), "utf8"));
  const start = promotionSource.indexOf("export function PromotionIdentityGate");
  const gate = promotionSource.slice(start, promotionSource.indexOf("function activeCopy", start));
  assert.ok(start > 0 && gate.length > 0, "PromotionIdentityGate is found");
  assert.match(gate, /<\/form> : <p className="promotion-binding-note">/u, "the binding note of a participant is a direct child of the gate");
  assert.match(gate, /^ {4}\{accessState === "pending" && <p className="promotion-next-note" role="status">/mu, "the pending note is a direct child of the gate");
  assert.match(gate, /^ {4}\{error && <p className="promotion-error" role="alert">/mu, "the error is a direct child of the gate");
  assert.match(promotionSource, /<div className="promotion-gate" role="status"><p>Проверяем доступ к повышению…<\/p><\/div>/u, "the loading paragraph is a direct child of the gate");
});

test("UI-06 (UAT 2026-11-16 gap 3): the promotion gate and status fill a maximized window", () => {
  assertPromotionFillsWindow();
  // A normal window and the phone keep the 680px column and the 72px/48px mark column.
  assert.equal(lastDeclaration(portiaCss, ".promotion-shell", "width"), "min(680px, 100%)");
  assert.equal(lastDeclaration(portiaCss, ".promotion-gate", "grid-template-columns"), "72px minmax(0, 1fr)");
  assert.equal(lastDeclaration(portiaCss, ".promotion-flow-list", "grid-template-columns"), undefined);
  assert.equal(lastDeclaration(portiaCss, at(".promotion-gate"), "grid-template-columns", PHONE), undefined, "the phone is not touched");
  // The template card keeps the 1060px file width (D-55): no maximized rule reaches it.
  for (const rule of rulesOf(cascadeCss)) {
    for (const selector of rule.selectors) assert.ok(!(selector.includes("is-maximized") && selector.includes("template-card-preview")), selector);
  }
});
