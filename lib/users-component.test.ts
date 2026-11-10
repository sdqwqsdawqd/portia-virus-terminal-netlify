import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const componentPath = join(repoRoot, "components", "portia-users-tab.tsx");
const component = readFileSync(new URL("../components/portia-users-tab.tsx", import.meta.url), "utf8");
const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/portia.css", import.meta.url), "utf8").replace(/\r\n/gu, "\n");

function dependencyClosure(path: string, seen = new Set<string>()): Set<string> {
  const resolved = normalize(path);
  if (seen.has(resolved)) return seen;
  seen.add(resolved);
  const source = readFileSync(resolved, "utf8");
  for (const match of source.matchAll(/from\s+["']([^"']+)["']/gu)) {
    const specifier = match[1];
    let child: string | null = null;
    if (specifier.startsWith("@/lib/")) child = join(repoRoot, "lib", `${specifier.slice(6).replace(/\.ts$/u, "")}.ts`);
    if (specifier.startsWith("./")) child = join(dirname(resolved), specifier.replace(/\.ts$/u, "") + ".ts");
    if (child && existsSync(child)) dependencyClosure(child, seen);
  }
  return seen;
}

test("users component exposes the accessible live badge contract", () => {
  assert.equal(component.split(/\r?\n/u)[0], '"use client";');
  assert.match(component, /pendingBadgeText/u);
  assert.match(component, /className="tab-count" aria-hidden="true"/u);
  assert.match(component, /className="sr-only"/u);
  assert.match(component, /role="status" aria-live="polite"/u);
  assert.match(component, /30_000/u);
  assert.match(component, /10_000/u);
  assert.match(component, /document\.visibilityState/u);
  assert.doesNotMatch(component, /(?:\p{Script=Cyrillic}+[\s,.:;—-]+){6}\p{Script=Cyrillic}+/u);
});

test("users component keeps access internals behind its API route", () => {
  for (const literal of component.matchAll(/["'`](\/api\/[^"'`]*)["'`]/gu)) {
    assert.ok(literal[1].startsWith("/api/users"), literal[1]);
  }
  assert.doesNotMatch(component, /portia_access_|access-store|access-session|users-api|users-roster/u);
  assert.match(component, /AppDeniedPanel/u);
  assert.match(component, /AppSkeleton shape="employees"/u);
  const forbidden = /access-store\.ts$|access-session\.ts$|users-api\.ts$|users-roster\.ts$|portia-promotion-sheet\.ts$/u;
  for (const path of dependencyClosure(componentPath)) {
    assert.doesNotMatch(path.replaceAll("\\", "/"), forbidden, path);
    assert.doesNotMatch(readFileSync(path, "utf8"), /from\s+["']node:/u, path);
  }
});

test("proxy refreshes the editor session for users polling", () => {
  assert.match(proxy, /"\/api\/users"/u);
});

test("full users component has search, closed details, accessible phone dialog and stale refresh", () => {
  assert.match(component, /type="search"/u);
  assert.match(component, /maxLength=\{20\}/u);
  assert.match(component, /autoComplete="off"/u);
  assert.match(component, /autoCapitalize="off"/u);
  assert.match(component, /spellCheck=\{false\}/u);
  assert.match(component, /300/u);
  assert.match(component, /<details/u);
  assert.doesNotMatch(component, /<details[^>]*\sopen/u);
  assert.match(component, /aria-haspopup="dialog"/u);
  assert.match(component, /<dialog[\s\S]*className="portia-dialog"/u);
  assert.match(component, /target="_blank"/u);
  assert.match(component, /rel="noopener noreferrer"/u);
  assert.match(component, /<time dateTime=/u);
  assert.match(component, /AppStaleBanner/u);
  assert.doesNotMatch(component, /toLocaleString|Intl\./u);
});

test("users CSS is one sharp marked block at the end", () => {
  const start = css.lastIndexOf("/* users-tab:start");
  assert.ok(start > 0, "users-tab CSS block must exist");
  const block = css.slice(start);
  assert.ok(css.trimEnd().endsWith("/* users-tab:end */"));
  assert.match(block, /\.tab-count/u);
  assert.match(block, /padding:\s*0 8px/u);
  assert.match(block, /min-width:\s*24px/u);
  assert.match(block, /margin-left:\s*8px/u);
  assert.match(block, /var\(--mono\)/u);
  assert.match(block, /var\(--warning\)/u);
  assert.doesNotMatch(block, /border-radius|@keyframes|(?:^|[;\s])(animation|transition)\s*:|--muted|oklch\(\.559/u);
});

test("request decisions use the shared confirmation dialog and honest busy states", () => {
  assert.match(component, /ConfirmDialog/u);
  assert.match(component, /usersCopy\.approveAria/u);
  assert.match(component, /aria-busy=/u);
  assert.match(component, /role="status"/u);
  assert.match(component, /method:\s*"POST"/u);
  assert.match(component, /"content-type":\s*"application\/json"/u);
  assert.match(component, /cache:\s*"no-store"/u);
  assert.doesNotMatch(component, /window\.confirm/u);
  assert.match(component, /usersCopy\.approving/u);
  assert.match(component, /usersCopy\.rejecting/u);
  assert.match(component, /tone:\s*"danger"/u);
  assert.match(component, /tone:\s*"secondary"[\s\S]*autoFocus:\s*true/u);
});

test("person and cooldown actions are available on PC and in the phone action window", () => {
  assert.match(component, /usersCopy\.setLevel/u);
  assert.match(component, /usersCopy\.revoke/u);
  assert.match(component, /usersCopy\.clearCooldown/u);
  assert.match(component, /usersCopy\.saving/u);
  assert.match(component, /usersCopy\.revoking/u);
  assert.match(component, /expectedLevel/u);
  assert.match(component, /callerIsOwner/u);
  assert.match(component, /disabled=\{[^}]*level[^}]*===/u);
  assert.match(component, /usersCopy\.revokeDialog/u);
  const block = css.slice(css.lastIndexOf("/* users-tab:start"));
  assert.match(block, /\.users-row-actions[^}]*gap:\s*8px/u);
  assert.match(block, /\.users-action-note/u);
  assert.match(block, /@media \(max-width: 900px\)[\s\S]*\.users-action-dialog-body \.users-row-actions[\s\S]*min-height:\s*44px/u);
});

test("history stays open across list refresh and reloads by nicknameKey", () => {
  assert.match(component, /parseUsersHistory/u);
  assert.match(component, /view=history&key=/u);
  assert.match(component, /openHistoryKeys/u);
  assert.match(component, /setOpenHistoryKeys/u);
  assert.match(component, /\[\.\.\.openHistoryKeys\][\s\S]*loadHistory/u);
  assert.match(component, /row\.source\.nicknameKey/u);
  assert.doesNotMatch(component, /setOpenHistoryKeys\(new Set\(\)\)/u, "list refresh must not close history panels");
});

test("history is accessible inline on PC and always present in the phone action window", () => {
  assert.match(component, /aria-expanded=/u);
  assert.match(component, /aria-controls=/u);
  assert.match(component, /<ol/u);
  assert.match(component, /usersCopy\.historyHeading/u);
  assert.match(component, /usersCopy\.historyEmpty/u);
  assert.match(component, /usersCopy\.hideHistory/u);
  assert.match(component, /phoneHistory/u);
  assert.doesNotMatch(component, /Показать ещё/iu);
  const block = css.slice(css.lastIndexOf("/* users-tab:start"));
  assert.match(block, /\.users-history-list[^}]*gap:\s*4px/u);
  assert.match(block, /\.users-history-list[^}]*font:\s*400 11px/u);
  assert.doesNotMatch(block, /border-radius|@keyframes|(?:^|[;\s])(animation|transition)\s*:/u);
});
