import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("../components/portia-users-tab.tsx", import.meta.url), "utf8");
const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");

test("users component exposes the accessible live badge contract", () => {
  assert.equal(component.split(/\r?\n/u)[0], '"use client";');
  assert.match(component, /pendingBadgeText/u);
  assert.match(component, /className="tab-count" aria-hidden="true"/u);
  assert.match(component, /className="sr-only"/u);
  assert.match(component, /role="status" aria-live="polite"/u);
  assert.match(component, /30_000/u);
  assert.match(component, /10_000/u);
  assert.match(component, /document\.visibilityState/u);
});

test("users component keeps access internals behind its API route", () => {
  for (const literal of component.matchAll(/["'`](\/api\/[^"'`]*)["'`]/gu)) {
    assert.ok(literal[1].startsWith("/api/users"), literal[1]);
  }
  assert.doesNotMatch(component, /portia_access_|access-store|access-session|users-api|users-roster/u);
  assert.match(component, /AppDeniedPanel/u);
  assert.match(component, /AppSkeleton shape="employees"/u);
});

test("proxy refreshes the editor session for users polling", () => {
  assert.match(proxy, /"\/api\/users"/u);
});
