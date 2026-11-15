// Phase 25 (SEC-03, D-01 4б, D-16): offline check of the content fixture text. The build scan is plan 25-09.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { cloneFixtureContent, portiaContentFixture } from "./testing/portia-content-fixture.ts";

// sha256 of JSON.stringify(portiaContentFixture), computed from the former seed on the commit that moved it.
const fixtureSha256 = "6de93dd9bf50a5d999a2fa1aff7e07ede6a33f0a16ffbfc3370c2f72e2a42fe7";

const productionRoots = ["app", "components", "lib"];

function productionSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "testing" ? [] : productionSourceFiles(path);
    if (![".ts", ".tsx"].includes(extname(path)) || path.endsWith(".test.ts")) return [];
    return [path];
  });
}

test("the fixture is a verbatim copy of the former seed (sha256 pin)", () => {
  const digest = createHash("sha256").update(JSON.stringify(portiaContentFixture)).digest("hex");
  assert.equal(digest, fixtureSha256);
});

test("cloneFixtureContent returns an independent deep copy", () => {
  const first = cloneFixtureContent();
  const second = cloneFixtureContent();
  assert.notEqual(first, second);
  assert.deepEqual(first, second);
  assert.deepEqual(first, portiaContentFixture);
  first.viruses[0].name = "CHANGED";
  assert.notEqual(portiaContentFixture.viruses[0].name, "CHANGED");
  assert.notEqual(second.viruses[0].name, "CHANGED");
});

test("production source never imports the content fixture", () => {
  let scanned = 0;
  const offenders = productionRoots.flatMap((root) =>
    productionSourceFiles(fileURLToPath(new URL(`../${root}`, import.meta.url))).filter((path) => {
      scanned += 1;
      return /testing[\\/]portia-content-fixture/.test(readFileSync(path, "utf8"));
    }));
  assert.ok(scanned > 0, "the boundary scan found no production files");
  assert.deepEqual(offenders, [], `production imports the content fixture: ${offenders.join(", ")}`);
});
