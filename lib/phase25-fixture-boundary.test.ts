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

test("production source declares no seed: no former seed or clone name, no import from lib/testing", () => {
  const offenders = productionRoots.flatMap((root) =>
    productionSourceFiles(fileURLToPath(new URL(`../${root}`, import.meta.url))).flatMap((path) => {
      const text = readFileSync(path, "utf8");
      const found: string[] = [];
      if (/(defaultPortiaContent|cloneDefaultContent)/.test(text)) found.push(`${path}: former seed name`);
      if (/export\s+const\s+\w*(seed|fixture)\w*\s*[:=]/i.test(text)) found.push(`${path}: seed-like export`);
      if (/from\s+["'][^"']*\/testing\//.test(text) || /import\(\s*["'][^"']*\/testing\//.test(text)) found.push(`${path}: imports lib/testing`);
      return found;
    }));
  assert.deepEqual(offenders, []);
});

test("the working module keeps the empty structure and the assistant defaults, and no record of the former seed", () => {
  const contentModule = readFileSync(fileURLToPath(new URL("./portia-content.ts", import.meta.url)), "utf8");
  assert.ok(contentModule.includes("export const emptyPortiaContent"));
  assert.ok(contentModule.includes("export const assistantDefaults"));
  assert.ok(!contentModule.includes("МОРОК") && !contentModule.includes("АРАХНА") && !contentModule.includes("КАЛЛИСТО"), "no record of the former seed in the working module");
});
