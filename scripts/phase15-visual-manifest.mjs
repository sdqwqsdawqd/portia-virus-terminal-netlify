import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspace = process.cwd();
const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: workspace, encoding: "utf8" }).trim();
const setId = process.env.PORTIA_VISUAL_SET_ID?.trim() || `phase15-current-${commit.slice(0, 12)}`;
const runRoot = path.resolve(workspace, "tests/e2e/visual-candidates/.runs", setId);
const evidencePath = path.resolve(workspace, ".planning/phases/PORTIA-15-baseline/evidence/15-VISUAL-CANDIDATES.md");
const frameMapPath = path.resolve(workspace, ".planning/phases/PORTIA-15-baseline/evidence/15-FRAME-TEST-MAP.md");
const approvalPath = path.resolve(workspace, ".planning/phases/PORTIA-15-baseline/evidence/15-VISUAL-APPROVAL.md");
const inventoryPath = path.resolve(workspace, ".planning/phases/PORTIA-15-baseline/evidence/15-STABLE-ROW-INVENTORY.json");
const snapshotRoot = path.resolve(workspace, "tests/e2e/visual/__screenshots__");
const args = new Set(process.argv.slice(2));

function fail(code, detail = "") {
  throw new Error(`[${code}]${detail ? ` ${detail}` : ""}`);
}

export const blockedRecoveryMatrix = Object.freeze({
  ISOLATED_AUTH_REQUIRED: 16,
  MOTION_CAPTURE_BOUNDARY_REQUIRED: 18,
  PHONE_WINDOW_CONTRACT: 18,
  ISOLATED_PROMOTION_DATA_REQUIRED: 19,
  PUBLIC_STATE_FIXTURE_REQUIRED: 20,
  PIXEL_AUTHORITY_NOT_SIGNED: 22,
});

function rowIdentity(row) {
  return `${row.project}:${row.id}`;
}

export function validateCandidateRows(rows, expectedInventory) {
  const identities = new Map();
  for (const row of rows) {
    if (!row.id) fail("PORTIA_CANDIDATE_FIELD_MISSING", `${row.state ?? "unknown"}:id`);
    const identity = rowIdentity(row);
    if (identities.has(identity)) fail("PORTIA_CANDIDATE_ROW_DUPLICATE", identity);
    identities.set(identity, row);

    if (row.status === "CAPTURED") {
      if (!row.candidateFile || !/^[a-f0-9]{64}$/.test(row.sha256 ?? "")) {
        fail("PORTIA_CAPTURED_EVIDENCE_MISSING", identity);
      }
      if (row.reason !== undefined || row.reasonCode !== undefined || row.recoveryPhase !== undefined) {
        fail("PORTIA_CAPTURED_BLOCKER_METADATA", identity);
      }
    } else if (row.status === "BLOCKED") {
      if (Object.hasOwn(row, "candidateFile") || Object.hasOwn(row, "sha256")) {
        fail("PORTIA_BLOCKED_HAS_EVIDENCE", identity);
      }
      if (!row.reason) fail("PORTIA_BLOCKED_REASON_MISSING", identity);
      const recoveryPhase = blockedRecoveryMatrix[row.reasonCode];
      if (recoveryPhase === undefined) fail("PORTIA_BLOCKED_REASON_CODE_INVALID", `${identity}:${row.reasonCode ?? "missing"}`);
      if (row.recoveryPhase !== recoveryPhase) {
        fail("PORTIA_BLOCKED_RECOVERY_INVALID", `${identity}:${row.recoveryPhase ?? "missing"}`);
      }
    } else {
      fail("PORTIA_CANDIDATE_STATUS_INVALID", `${identity}:${row.status}`);
    }
  }

  if (expectedInventory) {
    const expected = new Map();
    for (const entry of expectedInventory) {
      const identity = `${entry.project}:${entry.id}`;
      if (expected.has(identity)) fail("PORTIA_INVENTORY_ROW_DUPLICATE", identity);
      expected.set(identity, entry.status);
    }
    for (const [identity, status] of expected) {
      const row = identities.get(identity);
      if (!row) fail("PORTIA_CANDIDATE_ROW_MISSING", identity);
      if (row.status !== status) fail("PORTIA_CANDIDATE_STATUS_CHANGED", `${identity}:${status}->${row.status}`);
    }
    for (const identity of identities.keys()) {
      if (!expected.has(identity)) fail("PORTIA_CANDIDATE_ROW_UNEXPECTED", identity);
    }
  }
  return rows;
}

function stableInventory(rows) {
  return rows
    .map(({ project, id, status }) => ({ project, id, status }))
    .sort((left, right) => `${left.project}:${left.id}`.localeCompare(`${right.project}:${right.id}`));
}

function readStableInventory() {
  if (!existsSync(inventoryPath)) fail("PORTIA_STABLE_INVENTORY_MISSING");
  const parsed = JSON.parse(readFileSync(inventoryPath, "utf8"));
  if (parsed.schema !== "portia-phase15-stable-row-inventory-v1" || !Array.isArray(parsed.rows)) {
    fail("PORTIA_STABLE_INVENTORY_INVALID");
  }
  return parsed.rows;
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function approvalRows() {
  if (!existsSync(approvalPath)) fail("PORTIA_APPROVAL_LEDGER_MISSING");
  const rows = readFileSync(approvalPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => /^\| \*\*(APPROVED|REJECTED|PENDING)\*\* \|/.test(line))
    .map((line) => {
      const columns = line.split("|").map((column) => column.trim());
      const verdict = columns[1]?.replaceAll("*", "");
      const hash = columns[5]?.match(/[a-f0-9]{64}/)?.[0];
      const intendedSnapshot = columns[7]?.match(/`([^`]+)`/)?.[1];
      if (!verdict || !hash || !intendedSnapshot) fail("PORTIA_APPROVAL_ROW_INVALID", line);
      return { verdict, hash, intendedSnapshot };
    });
  if (!rows.length) fail("PORTIA_APPROVAL_ROWS_MISSING");
  return rows;
}

function snapshotFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? snapshotFiles(absolute) : [absolute];
  });
}

function validateApprovalRows(rows) {
  const pending = rows.filter((row) => row.verdict === "PENDING");
  if (pending.length) fail("PORTIA_APPROVAL_PENDING", String(pending.length));
  const approved = rows.filter((row) => row.verdict === "APPROVED");
  const approvedHashes = new Set(approved.map((row) => row.hash));
  const approvedDestinations = new Set(approved.map((row) => row.intendedSnapshot));
  if (approved.length !== approvedHashes.size) fail("PORTIA_APPROVAL_HASH_DUPLICATE");
  if (approved.length !== approvedDestinations.size) fail("PORTIA_APPROVAL_DESTINATION_DUPLICATE");
  return approved;
}

function promoteApproved() {
  const approved = validateApprovalRows(approvalRows());
  const candidates = collectRows().filter((row) => row.status === "CAPTURED");
  const byHash = new Map(candidates.map((row) => [row.sha256, row]));
  for (const approval of approved) {
    const candidate = byHash.get(approval.hash);
    if (!candidate) fail("PORTIA_APPROVED_CANDIDATE_MISSING", approval.hash);
    if (candidate.intendedSnapshot !== approval.intendedSnapshot) {
      fail("PORTIA_APPROVED_DESTINATION_MISMATCH", approval.intendedSnapshot);
    }
    const source = path.resolve(workspace, candidate.candidateFile);
    const destination = path.resolve(workspace, approval.intendedSnapshot);
    if (!destination.startsWith(`${snapshotRoot}${path.sep}`)) fail("PORTIA_PROMOTION_DESTINATION_REFUSED", destination);
    if (existsSync(destination) && sha256(destination) !== approval.hash) {
      fail("PORTIA_PROMOTION_WOULD_OVERWRITE", approval.intendedSnapshot);
    }
    mkdirSync(path.dirname(destination), { recursive: true });
    copyFileSync(source, destination);
    if (sha256(destination) !== approval.hash) fail("PORTIA_PROMOTION_COPY_MISMATCH", approval.intendedSnapshot);
  }
  process.stdout.write(`Promoted ${approved.length} owner-approved snapshots without transformation.\n`);
}

function verifyPromotion() {
  const rows = approvalRows();
  const approved = validateApprovalRows(rows);
  const approvedByDestination = new Map(approved.map((row) => [path.resolve(workspace, row.intendedSnapshot), row]));
  for (const row of approved) {
    const destination = path.resolve(workspace, row.intendedSnapshot);
    if (!destination.startsWith(`${snapshotRoot}${path.sep}`)) fail("PORTIA_PROMOTION_DESTINATION_REFUSED", destination);
    if (!existsSync(destination) || !statSync(destination).isFile()) fail("PORTIA_APPROVED_SNAPSHOT_MISSING", row.intendedSnapshot);
    if (sha256(destination) !== row.hash) fail("PORTIA_APPROVED_SNAPSHOT_HASH_MISMATCH", row.intendedSnapshot);
  }
  const trackedSnapshots = snapshotFiles(snapshotRoot).filter((file) => file.toLowerCase().endsWith(".png"));
  for (const snapshot of trackedSnapshots) {
    const approval = approvedByDestination.get(snapshot);
    if (!approval) fail("PORTIA_UNAPPROVED_SNAPSHOT_PRESENT", path.relative(workspace, snapshot));
    if (sha256(snapshot) !== approval.hash) fail("PORTIA_UNAPPROVED_SNAPSHOT_HASH", path.relative(workspace, snapshot));
  }
  if (trackedSnapshots.length !== approved.length) {
    fail("PORTIA_PROMOTION_COUNT_MISMATCH", `${trackedSnapshots.length}/${approved.length}`);
  }
  process.stdout.write(`Verified ${approved.length} exact owner-approved snapshot bytes; ${rows.length - approved.length} non-approved rows excluded.\n`);
}

function collectRows({ enforceInventory = false } = {}) {
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
    }
  }
  validateCandidateRows(rows, enforceInventory ? readStableInventory() : undefined);
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
  const rows = collectRows({ enforceInventory: true });
  for (const row of rows) {
    const identity = row.status === "CAPTURED" ? row.sha256 : `BLOCKED:${row.id ?? row.state}`;
    if (!map.includes(identity)) fail("PORTIA_FIGMA_MAP_ROW_MISSING", row.state);
  }
  process.stdout.write(`Verified Figma map for ${rows.length} candidate rows.\n`);
}

function runCli() {
if (args.has("--promote-approved")) {
  promoteApproved();
  verifyPromotion();
} else if (args.has("--verify-promotion")) {
  verifyPromotion();
} else if (args.has("--verify-figma-map")) {
  verifyFigmaMap();
} else if (args.has("--write-inventory")) {
  if (existsSync(inventoryPath)) fail("PORTIA_STABLE_INVENTORY_EXISTS");
  const rows = collectRows();
  writeFileSync(inventoryPath, `${JSON.stringify({
    schema: "portia-phase15-stable-row-inventory-v1",
    setId,
    sourceCommit: rows[0].sourceCommit,
    rows: stableInventory(rows),
  }, null, 2)}\n`);
  process.stdout.write(`Wrote stable inventory for ${rows.length} rows.\n`);
} else {
  const rows = collectRows({ enforceInventory: args.has("--verify") });
  mkdirSync(runRoot, { recursive: true });
  writeFileSync(path.join(runRoot, "manifest.json"), `${JSON.stringify({ schema: "portia-phase15-visual-manifest-v1", setId, sourceCommit: rows[0].sourceCommit, rows }, null, 2)}\n`);
  if (args.has("--verify")) {
    writeFileSync(evidencePath, markdown(rows));
    process.stdout.write(`Verified ${rows.length} rows (${rows.filter((row) => row.status === "CAPTURED").length} PNGs) for ${setId}.\n`);
  } else {
    process.stdout.write(`Wrote manifest for ${setId}.\n`);
  }
}
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}
