import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const componentPath = join(repoRoot, "components", "portia-users-tab.tsx");
const component = readFileSync(new URL("../components/portia-users-tab.tsx", import.meta.url), "utf8");
const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");

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
