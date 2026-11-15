// SEC-03: the build must not carry site content; prints paths and markers only, never file contents.
// Runs as the npm "postbuild" hook (and by hand): walks .next, exits 1 on a marker, 2 when the directory is missing.
// Plain ESM with no TypeScript import: Netlify builds on Node 22.13.0 without the strip-types flag.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Texts from the former starting content that appear nowhere else in working code (virus names and codes, their ids,
// article titles, one unique phrase, nicknames from the document). The test lib/phase25-build-scan.test.ts keeps this
// list in step with lib/testing/portia-content-fixture.ts and with the working code. Interface labels, the
// classification vocabulary and the assistant phrases (assistantDefaults, assumption A1) are interface text, not markers.
export const CONTENT_MARKERS = [
  "МОРОК",
  "АРАХНА",
  "КАЛЛИСТО",
  "VIR-Δ17",
  "VIR-Θ04",
  "VIR-Σ12",
  "vir-d17",
  "vir-t04",
  "vir-s12",
  "Что такое вирусы?",
  "Способы распространения вирусов",
  "Документация и утверждение",
  "maryerrar",
  "anuargovni1",
  "wewewewestrelok",
  "Всем вирусам присваивается по три класса",
];

// Top-level .next directories that are not deployed.
export const SKIP_DIRS = new Set(["cache", "dev", "diagnostics"]);

function hex4(code) {
  return code.toString(16).padStart(4, "0");
}

// The literal (UTF-8) form plus the \uXXXX form with lower and upper case hex; an ASCII marker has the literal only.
export function markerForms(marker) {
  const forms = [marker];
  if (/[^\x00-\x7f]/.test(marker)) {
    let lower = "";
    for (let index = 0; index < marker.length; index += 1) {
      const code = marker.charCodeAt(index);
      lower += code > 0x7f ? `\\u${hex4(code)}` : marker[index];
    }
    forms.push(lower);
    const upper = lower.replace(/\\u([0-9a-f]{4})/g, (_, digits) => `\\u${digits.toUpperCase()}`);
    if (upper !== lower) forms.push(upper);
  }
  return forms;
}

// Yields absolute file paths under dir; skips SKIP_DIRS at the top level only and any file whose name starts with "trace".
export function* walk(dir, top = true) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (top && SKIP_DIRS.has(entry.name)) continue;
      yield* walk(path, false);
    } else if (entry.isFile() && !entry.name.startsWith("trace")) {
      yield path;
    }
  }
}

function relativePath(root, path) {
  return path.slice(root.length).replace(/^[\\/]+/, "").replace(/\\/g, "/");
}

// Findings plus the number of scanned files; a marker split by a line break is not found (a minifier does not split literals).
export function scanTreeDetailed(dir, markers = CONTENT_MARKERS) {
  const root = resolve(dir);
  const forms = markers.map((marker) => ({ marker, forms: markerForms(marker) }));
  const findings = [];
  let files = 0;
  for (const path of walk(root)) {
    files += 1;
    const text = readFileSync(path, "utf8");
    for (const entry of forms) {
      if (entry.forms.some((form) => text.includes(form))) findings.push({ file: relativePath(root, path), marker: entry.marker });
    }
  }
  return { findings, files };
}

export function scanTree(dir, markers = CONTENT_MARKERS) {
  return scanTreeDetailed(dir, markers).findings;
}

function main(argv) {
  const target = argv[0] ? resolve(argv[0]) : fileURLToPath(new URL("../.next", import.meta.url));
  if (!existsSync(target) || !statSync(target).isDirectory()) {
    process.stderr.write(`build scan: ${target} not found; run the build first\n`);
    return 2;
  }
  const { findings, files } = scanTreeDetailed(target);
  if (findings.length > 0) {
    process.stderr.write("build scan: content marker found\n");
    for (const finding of findings) process.stderr.write(`${finding.file}: ${finding.marker}\n`);
    return 1;
  }
  process.stdout.write(`build scan: 0 markers in ${files} files\n`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
