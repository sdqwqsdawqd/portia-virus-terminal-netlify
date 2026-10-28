import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

test("root body tolerates attributes injected by browser extensions before hydration", () => {
  assert.match(source, /<body\s+suppressHydrationWarning>/);
});
