import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const workspace = process.cwd();
const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: workspace, encoding: "utf8" }).trim();
const setId = process.env.PORTIA_VISUAL_SET_ID?.trim() || `phase15-current-${commit.slice(0, 12)}`;
const runRoot = path.resolve(workspace, "tests/e2e/visual-candidates/.runs", setId);
const evidencePath = path.resolve(workspace, ".planning/phases/PORTIA-15-baseline/evidence/15-VISUAL-CANDIDATES.md");
const frameMapPath = path.resolve(workspace, ".planning/phases/PORTIA-15-baseline/evidence/15-FRAME-TEST-MAP.md");
const args = new Set(process.argv.slice(2));

function fail(code, detail = "") {
  throw new Error(`[${code}]${detail ? ` ${detail}` : ""}`);
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function collectRows() {
  if (!existsSync(runRoot)) fail("PORTIA_CANDIDATE_SET_MISSING", setId);
  const files = readdirSync(runRoot).filter((file) => file.endsWith(".candidate.json") || file.endsWith(".blocked.json"));
  if (!files.length) fail("PORTIA_CANDIDATE_ROWS_MISSING", setId);
  const rows = files.map((file) => JSON.parse(readFileSync(path.join(runRoot, file), "utf8")));
  const sourceCommits = [...new Set(rows.map((row) => row.sourceCommit))];
  if (sourceCommits.length !== 1) fail("PORTIA_CANDIDATE_SOURCE_DIVERGED", sourceCommits.join(","));
  if (!setId.endsWith(sourceCommits[0].slice(0, 12))) fail("PORTIA_CANDIDATE_SET_SOURCE_MISMATCH", setId);
  const required = [
    "schema", "setId", "status", "requirement", "surface", "actor", "state", "intendedSnapshot",
    "sourceCommit", "dirtyLedgerId", "fixtureRevision", "seed", "fixedTime", "tool", "browser", "project",
    "os", "viewport", "dpr", "locale", "timezone", "colorScheme", "settings", "resolvedMotion", "resolvedSpider",
  ];
  for (const row of rows) {
    for (const field of required) if (row[field] === undefined || row[field] === "") fail("PORTIA_CANDIDATE_FIELD_MISSING", `${row.state ?? "unknown"}:${field}`);
    if (row.setId !== setId) fail("PORTIA_CANDIDATE_SET_MISMATCH", row.setId);
    const destination = path.resolve(workspace, row.intendedSnapshot).replaceAll("\\", "/").toLowerCase();
    if (!destination.includes("/tests/e2e/visual/__screenshots__/")) fail("PORTIA_SNAPSHOT_DESTINATION_INVALID", row.intendedSnapshot);
    if (row.status === "CAPTURED") {
      const candidate = path.resolve(workspace, row.candidateFile);
      if (!existsSync(candidate) || !statSync(candidate).isFile()) fail("PORTIA_CANDIDATE_PNG_MISSING", row.candidateFile);
      if (sha256(candidate) !== row.sha256) fail("PORTIA_CANDIDATE_HASH_MISMATCH", row.candidateFile);
    } else if (row.status === "BLOCKED") {
      if (!row.reason) fail("PORTIA_BLOCKED_REASON_MISSING", row.state);
    } else {
      fail("PORTIA_CANDIDATE_STATUS_INVALID", row.status);
    }
  }
  return rows.sort((left, right) => `${left.surface}:${left.state}`.localeCompare(`${right.surface}:${right.state}`));
}

function markdown(rows) {
  const captured = rows.filter((row) => row.status === "CAPTURED");
  const blocked = rows.filter((row) => row.status === "BLOCKED");
  const lines = [
    "# Phase 15 Visual Candidates",
    "",
    `- Candidate set: \`${setId}\``,
    `- Source commit: \`${rows[0].sourceCommit}\``,
    `- Status: **PENDING OWNER APPROVAL**`,
    `- Captured PNGs: ${captured.length}`,
    `- Explicit BLOCKED rows: ${blocked.length}`,
    "- Authority: candidate evidence only; no row is an approved golden.",
    "",
    "## Captured",
    "",
    "| Requirement | Surface | Actor / state | Project | PNG SHA-256 | Intended snapshot |",
    "|---|---|---|---|---|---|",
    ...captured.map((row) => `| ${row.requirement} | ${row.surface} | ${row.actor} — ${row.state} | ${row.project} | \`${row.sha256}\` | \`${row.intendedSnapshot}\` |`),
    "",
    "## Blocked",
    "",
    "| Requirement | Surface | Actor / state | Project | Reason |",
    "|---|---|---|---|---|",
    ...blocked.map((row) => `| ${row.requirement} | ${row.surface} | ${row.actor} — ${row.state} | ${row.project} | ${row.reason} |`),
    "",
    "## Environment Contract",
    "",
    `All rows carry dirty ledger \`${rows[0].dirtyLedgerId}\`, fixture \`${rows[0].fixtureRevision}\`, seed \`${rows[0].seed}\`, fixed time \`${rows[0].fixedTime}\`, exact browser/OS, viewport/DPR, locale/timezone and effective desktop settings in the run manifest.`,
    "",
    `Ignored run manifest: \`tests/e2e/visual-candidates/.runs/${setId}/manifest.json\`.`,
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function verifyFigmaMap() {
  if (!existsSync(frameMapPath)) fail("PORTIA_FIGMA_MAP_MISSING", "Task 3 has not created the map.");
  const map = readFileSync(frameMapPath, "utf8");
  const rows = collectRows();
  for (const row of rows) {
    const identity = row.status === "CAPTURED" ? row.sha256 : `BLOCKED:${row.id ?? row.state}`;
    if (!map.includes(identity)) fail("PORTIA_FIGMA_MAP_ROW_MISSING", row.state);
  }
  process.stdout.write(`Verified Figma map for ${rows.length} candidate rows.\n`);
}

if (args.has("--verify-figma-map")) {
  verifyFigmaMap();
} else {
  const rows = collectRows();
  mkdirSync(runRoot, { recursive: true });
  writeFileSync(path.join(runRoot, "manifest.json"), `${JSON.stringify({ schema: "portia-phase15-visual-manifest-v1", setId, sourceCommit: rows[0].sourceCommit, rows }, null, 2)}\n`);
  if (args.has("--verify")) {
    writeFileSync(evidencePath, markdown(rows));
    process.stdout.write(`Verified ${rows.length} rows (${rows.filter((row) => row.status === "CAPTURED").length} PNGs) for ${setId}.\n`);
  } else {
    process.stdout.write(`Wrote manifest for ${setId}.\n`);
  }
}
