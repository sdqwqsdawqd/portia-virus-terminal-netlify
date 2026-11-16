import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
  ".info-phone-back",
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
    // The back arrow is an icon glyph (20px), not label text; it is retired later in the phase (UI-08).
    assert.equal(lastDeclaration(cascadeCss, selector, "font-size"), selector === ".info-phone-back" ? "20px" : "11px", `${selector} font-size`);
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
  ".promotion-editor-branches button",
  ".promotion-queue-filters button",
  ".promotion-bank-workflow-tabs button",
];
const ACTIVE_TABS = [
  ".editor-tabs button.active",
  '.editor-section-tabs nav button[aria-pressed="true"]',
  '.editor-section-tabs nav button[aria-current="true"]',
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

test("UI-03: the block changes no colour, font family or animation; the access screens wait for step 4", () => {
  const { text } = unifyBlock(portiaCss);
  for (const rule of rulesOf(text)) {
    for (const [name, value] of declarations(rule.body)) {
      assert.ok(!["color", "background", "background-color", "font-family", "font"].includes(name), `${rule.selectors.join(", ")} sets ${name}`);
      assert.doesNotMatch(value, /var\(--(?:sans|mono|doc|display|serif)\)/u, `${rule.selectors.join(", ")} sets a font family`);
    }
  }
  assert.doesNotMatch(text, /\.access-card|\.owner-login-card/u, "26-09 restyles the access card and the owner login");
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
