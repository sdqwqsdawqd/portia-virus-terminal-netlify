// Phase 25 (SEC-03, D-01 4б): offline check of the post-build content scan. Running the hook on Netlify is BLOCKED (A4).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { CONTENT_MARKERS, SKIP_DIRS, markerForms, scanTree } from "../scripts/phase25-build-scan.mjs";
import { assistantDefaults, classificationOptions } from "./portia-content.ts";
import { portiaContentFixture } from "./testing/portia-content-fixture.ts";

const scriptPath = fileURLToPath(new URL("../scripts/phase25-build-scan.mjs", import.meta.url));
const fixturePath = fileURLToPath(new URL("./testing/portia-content-fixture.ts", import.meta.url));
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

// "МОРОК" spelled with code points so this test file itself never carries the marker as a literal.
const MOROK = String.fromCharCode(0x41c, 0x41e, 0x420, 0x41e, 0x41a);
const MOROK_LOWER_ESCAPES = "\\u041c\\u041e\\u0420\\u041e\\u041a";
const MOROK_UPPER_ESCAPES = "\\u041C\\u041E\\u0420\\u041E\\u041A";

function makeTree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "phase25-build-scan-"));
  for (const [relative, content] of Object.entries(files)) {
    const path = join(root, relative);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  return root;
}

function withTree<T>(files: Record<string, string>, run: (root: string) => T): T {
  const root = makeTree(files);
  try {
    return run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function runCli(directory: string) {
  return spawnSync(process.execPath, [scriptPath, directory], { encoding: "utf8" });
}

test("scanTree: an empty directory has no findings", () => {
  withTree({}, (root) => assert.deepEqual(scanTree(root, [MOROK]), []));
});

test("scanTree: a literal marker in static/ is reported with a relative forward-slash path", () => {
  withTree({ "static/a.js": `var x="${MOROK}";` }, (root) => {
    assert.deepEqual(scanTree(root, [MOROK]), [{ file: "static/a.js", marker: MOROK }]);
  });
});

test("scanTree: a marker written only as \\u escapes is found, lower and upper case hex", () => {
  withTree(
    {
      "static/lower.js": `var x="${MOROK_LOWER_ESCAPES}";`,
      "server/chunks/upper.js": `var x="${MOROK_UPPER_ESCAPES}";`,
    },
    (root) => {
      const found = scanTree(root, [MOROK]).map((entry) => entry.file).sort();
      assert.deepEqual(found, ["server/chunks/upper.js", "static/lower.js"]);
    },
  );
});

test("scanTree: not-deployed directories and trace files are skipped", () => {
  withTree(
    {
      "cache/x.js": MOROK,
      "dev/x.js": MOROK,
      "diagnostics/x.json": MOROK,
      trace: MOROK,
      "trace-build": MOROK,
    },
    (root) => assert.deepEqual(scanTree(root, [MOROK]), []),
  );
  assert.deepEqual([...SKIP_DIRS].sort(), ["cache", "dev", "diagnostics"]);
});

test("scanTree: shipped directories are not skipped, only top-level cache/dev/diagnostics are", () => {
  withTree({ "server/app/cache/x.html": MOROK, "static/chunks/dev/y.js": MOROK }, (root) => {
    const found = scanTree(root, [MOROK]).map((entry) => entry.file).sort();
    assert.deepEqual(found, ["server/app/cache/x.html", "static/chunks/dev/y.js"]);
  });
});

test("scanTree: source maps and html and rsc and json are scanned", () => {
  withTree(
    {
      "static/chunks/a.js.map": MOROK,
      "server/app/index.html": MOROK,
      "server/app/index.rsc": MOROK,
      "server/app-paths-manifest.json": MOROK,
    },
    (root) => assert.equal(scanTree(root, [MOROK]).length, 4),
  );
});

test("scanTree: a marker split by a line break is not a finding (documented boundary)", () => {
  withTree({ "static/split.js": `${MOROK.slice(0, 2)}\n${MOROK.slice(2)}` }, (root) => {
    assert.deepEqual(scanTree(root, [MOROK]), []);
  });
});

test("markerForms: a non-ASCII marker has the literal and both hex cases; ASCII has the literal only", () => {
  const forms = markerForms("VIR-Δ17");
  assert.ok(forms.includes("VIR-Δ17"));
  assert.ok(forms.includes("VIR-\\u039417"));
  const upper = markerForms("VIR-Σ04");
  assert.ok(upper.includes("VIR-\\u03a304"));
  assert.ok(upper.includes("VIR-\\u03A304"));
  assert.deepEqual(markerForms("maryerrar"), ["maryerrar"]);
});

test("CLI: a finding exits 1 with the header and path: marker lines", () => {
  withTree({ "static/a.js": `var x="${MOROK}";` }, (root) => {
    const result = spawnSync(process.execPath, [scriptPath, root], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /build scan: content marker found/);
  });
});

test("CLI: a clean directory exits 0 and reports the file count", () => {
  withTree({ "static/a.js": "console.log(1)", "server/b.json": "{}" }, (root) => {
    const result = runCli(root);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /build scan: 0 markers in 2 files/);
  });
});

test("CLI: a missing directory exits 2 and is never reported as clean", () => {
  const result = runCli(join(tmpdir(), "phase25-build-scan-does-not-exist"));
  assert.equal(result.status, 2);
  assert.doesNotMatch(result.stdout, /0 markers/);
});

test("CLI: prints path and marker but never the surrounding content (canary)", () => {
  const canary = "CANARY_DO_NOT_PRINT_7f3a";
  const marker = CONTENT_MARKERS[0];
  withTree({ "static/a.js": `before ${canary} ${marker} ${canary} after` }, (root) => {
    const result = runCli(root);
    assert.equal(result.status, 1);
    const output = `${result.stdout}${result.stderr}`;
    assert.ok(output.includes("static/a.js"));
    assert.ok(output.includes(marker));
    assert.ok(!output.includes(canary), "the scan printed file content");
    assert.ok(!output.includes("before"), "the scan printed file content");
  });
});

test("CONTENT_MARKERS: every marker is still present in the content fixture (otherwise it is stale)", () => {
  const fixtureText = readFileSync(fixturePath, "utf8");
  const fixtureJson = JSON.stringify(portiaContentFixture);
  const stale = CONTENT_MARKERS.filter((marker) => !fixtureText.includes(marker) && !fixtureJson.includes(marker));
  assert.deepEqual(stale, [], `marker is stale (not in the fixture): ${stale.join(", ")}`);
});

test("CONTENT_MARKERS: no marker appears in any working file of app/, components/, lib/", () => {
  const roots = ["app", "components", "lib"];
  const extensions = [".ts", ".tsx", ".css", ".mjs"];
  function workingFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return entry.name === "testing" ? [] : workingFiles(path);
      if (!extensions.includes(extname(path)) || path.endsWith(".test.ts")) return [];
      return [path];
    });
  }
  let scanned = 0;
  const offenders = roots.flatMap((root) =>
    workingFiles(join(repoRoot, root)).flatMap((path) => {
      scanned += 1;
      const text = readFileSync(path, "utf8");
      return CONTENT_MARKERS.filter((marker) => text.includes(marker)).map((marker) => `${path}: ${marker}`);
    }));
  assert.ok(scanned > 0, "the drift scan found no working files");
  assert.deepEqual(offenders, [], `marker found in working code: ${offenders.join("; ")}`);
});

test("CONTENT_MARKERS: no interface label, classification option or assistant phrase is a marker", () => {
  const forbidden = new Set<string>(["VIRUS_ARCHIVE"]);
  const collect = (value: unknown) => {
    if (typeof value === "string") forbidden.add(value);
    else if (Array.isArray(value)) value.forEach(collect);
    else if (value && typeof value === "object") Object.values(value).forEach(collect);
  };
  collect(classificationOptions);
  collect(assistantDefaults);
  assert.ok(forbidden.size > 10, "the interface-text sets are unexpectedly small");
  const markersInForbidden = CONTENT_MARKERS.filter((marker) => forbidden.has(marker));
  assert.deepEqual(markersInForbidden, []);
  assert.ok(!CONTENT_MARKERS.includes("VIRUS_ARCHIVE"));
  assert.ok(CONTENT_MARKERS.length > 0);
  assert.equal(new Set(CONTENT_MARKERS).size, CONTENT_MARKERS.length, "duplicate marker");
});
