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
];
// A3 (UI-SPEC): a stacked list of actions inside a container narrower than 480px (the dialog is 420px at most) fills it;
// that is stacking, not stretching. Named one by one: nothing else may stretch a button.
const NARROW_STACK_EXCEPTIONS: string[] = [];

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
  assert.deepEqual(stretchViolations(portiaCss, BUTTON_FAMILY, NARROW_STACK_EXCEPTIONS), []);
  assert.deepEqual(stretchViolations(promotionCss, BUTTON_FAMILY, NARROW_STACK_EXCEPTIONS), []);
});
