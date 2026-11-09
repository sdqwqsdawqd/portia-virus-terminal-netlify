import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";

const workspace = process.cwd();
const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: workspace, encoding: "utf8" }).trim();
const setId = process.env.PORTIA_VISUAL_SET_ID?.trim() || `phase15-current-${commit.slice(0, 12)}`;
const v13Phases = ".planning/milestones/v1.3-phases";
const phase15Evidence = path.resolve(workspace, v13Phases, "PORTIA-15-baseline", "evidence");
const evidencePath = path.join(phase15Evidence, "15-VISUAL-CANDIDATES.md");
const frameMapPath = path.join(phase15Evidence, "15-FRAME-TEST-MAP.md");
const localContractPath = path.join(phase15Evidence, "15-LOCAL-UI-CONTRACT.md");
const approvalPath = path.join(phase15Evidence, "15-VISUAL-APPROVAL.md");
const inventoryPath = path.join(phase15Evidence, "15-STABLE-ROW-INVENTORY.json");
const candidateIndexPath = path.join(phase15Evidence, "15-CANDIDATE-INDEX.json");
const candidateIndexSchema = "portia-phase15-candidate-index-v1";
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
  return parsed;
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
      const reason = columns[8] ?? "";
      if (!verdict || !hash || !intendedSnapshot) fail("PORTIA_APPROVAL_ROW_INVALID", line);
      return { verdict, hash, intendedSnapshot, reason };
    });
  if (!rows.length) fail("PORTIA_APPROVAL_ROWS_MISSING");
  return rows;
}

function extractExactlyOne(text, pattern, missingCode, duplicateCode) {
  const matches = [...text.matchAll(pattern)].map((match) => match[1]);
  if (!matches.length) fail(missingCode);
  if (matches.length !== 1) fail(duplicateCode, String(matches.length));
  return matches[0];
}

export function parseAuthorityMetadata(text, artifact) {
  return {
    candidateSet: extractExactlyOne(
      text,
      /Candidate set:\*{0,2}\s*`([^`]+)`/gi,
      `PORTIA_${artifact}_CANDIDATE_SET_MISSING`,
      `PORTIA_${artifact}_CANDIDATE_SET_DUPLICATE`,
    ),
    sourceCommit: extractExactlyOne(
      text,
      /Source commit:\*{0,2}\s*`([a-f0-9]{40})`/gi,
      `PORTIA_${artifact}_SOURCE_COMMIT_MISSING`,
      `PORTIA_${artifact}_SOURCE_COMMIT_DUPLICATE`,
    ),
    localContractDigest: extractExactlyOne(
      text,
      /Local contract SHA-256:\*{0,2}\s*`([a-f0-9]{64})`/gi,
      `PORTIA_${artifact}_LOCAL_CONTRACT_DIGEST_MISSING`,
      `PORTIA_${artifact}_LOCAL_CONTRACT_DIGEST_DUPLICATE`,
    ),
  };
}

export function validateAuthorityMetadata(artifacts) {
  return compareAuthority(Object.entries(artifacts).map(([artifact, text]) => ({
    artifact,
    ...parseAuthorityMetadata(text, artifact.toUpperCase()),
  })));
}

function compareAuthority(parsed) {
  for (const field of ["candidateSet", "sourceCommit", "localContractDigest"]) {
    const values = new Set(parsed.map((entry) => entry[field]));
    if (values.size !== 1) {
      fail(`PORTIA_AUTHORITY_${field.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}_MISMATCH`,
        parsed.map((entry) => `${entry.artifact}=${entry[field]}`).join(","));
    }
  }
  return parsed[0];
}

// The contract is the digest source, so its tuple uses the digest of its own LF-normalized bytes.
function verifyAuthority() {
  for (const [file, code] of [[approvalPath, "PORTIA_APPROVAL_LEDGER_MISSING"], [frameMapPath, "PORTIA_UI_MAP_MISSING"], [localContractPath, "PORTIA_LOCAL_UI_CONTRACT_MISSING"]]) {
    if (!existsSync(file)) fail(code);
  }
  const contract = readFileSync(localContractPath, "utf8");
  const contractAuthority = {
    artifact: "contract",
    candidateSet: extractExactlyOne(contract, /Candidate set:\*{0,2}\s*`([^`]+)`/gi,
      "PORTIA_CONTRACT_CANDIDATE_SET_MISSING", "PORTIA_CONTRACT_CANDIDATE_SET_DUPLICATE"),
    sourceCommit: extractExactlyOne(contract, /Source commit:\*{0,2}\s*`([a-f0-9]{40})`/gi,
      "PORTIA_CONTRACT_SOURCE_COMMIT_MISSING", "PORTIA_CONTRACT_SOURCE_COMMIT_DUPLICATE"),
    localContractDigest: createHash("sha256").update(contract.replaceAll("\r\n", "\n"), "utf8").digest("hex"),
  };
  const inventory = readStableInventory();
  return compareAuthority([
    { artifact: "approval", ...parseAuthorityMetadata(readFileSync(approvalPath, "utf8"), "APPROVAL") },
    contractAuthority,
    { artifact: "frameMap", ...parseAuthorityMetadata(readFileSync(frameMapPath, "utf8"), "FRAME_MAP") },
    { artifact: "inventory", candidateSet: inventory.setId, sourceCommit: inventory.sourceCommit, localContractDigest: contractAuthority.localContractDigest },
  ]);
}

export function parseUiMapRows(text) {
  const block = text.match(/<!-- UI-MAP:START -->\s*```jsonl\s*([\s\S]*?)\s*```\s*<!-- UI-MAP:END -->/);
  if (!block) fail("PORTIA_UI_MAP_BLOCK_MISSING");
  return block[1].split(/\r?\n/).filter(Boolean).map((line) => {
    try {
      return JSON.parse(line);
    } catch {
      fail("PORTIA_UI_MAP_ROW_INVALID", line);
    }
  });
}

export function validateUiMapRows(candidateRows, mapRows) {
  const candidates = new Map(candidateRows.map((row) => [rowIdentity(row), row]));
  const mapped = new Map();
  const currentSections = new Set([
    "00 Evidence", "02 Desktop CURRENT", "03 Applications CURRENT",
    "04 Editor CURRENT", "05 Promotion CURRENT", "06 Motion CURRENT",
  ]);

  for (const row of mapRows) {
    const identity = `${row.project}:${row.id}`;
    if (mapped.has(identity)) fail("PORTIA_UI_MAP_ROW_DUPLICATE", identity);
    mapped.set(identity, row);
    const candidate = candidates.get(identity);
    if (!candidate) fail("PORTIA_UI_MAP_ROW_UNEXPECTED", identity);
    if (row.status !== candidate.status) fail("PORTIA_UI_MAP_STATUS_MISMATCH", identity);
    if (!currentSections.has(row.section)) fail("PORTIA_UI_MAP_CURRENT_SECTION_INVALID", `${identity}:${row.section ?? "missing"}`);
    if (row.intendedSnapshot !== candidate.intendedSnapshot) fail("PORTIA_UI_MAP_DESTINATION_MISMATCH", identity);
    if (row.status === "CAPTURED") {
      if (row.sha256 !== candidate.sha256) fail("PORTIA_UI_MAP_HASH_MISMATCH", identity);
      if (row.candidateFile !== candidate.candidateFile) fail("PORTIA_UI_MAP_PNG_MISMATCH", identity);
      if (row.reasonCode !== undefined || row.recoveryPhase !== undefined) fail("PORTIA_UI_MAP_CAPTURED_BLOCKER", identity);
    } else {
      if (row.reasonCode !== candidate.reasonCode) fail("PORTIA_UI_MAP_BLOCKER_MISMATCH", identity);
      if (row.recoveryPhase !== candidate.recoveryPhase) fail("PORTIA_UI_MAP_RECOVERY_MISMATCH", identity);
      if (row.sha256 !== undefined || row.candidateFile !== undefined) fail("PORTIA_UI_MAP_BLOCKED_EVIDENCE", identity);
    }
  }
  for (const identity of candidates.keys()) {
    if (!mapped.has(identity)) fail("PORTIA_UI_MAP_ROW_MISSING", identity);
  }
  return mapRows;
}

/**
 * @param {Array<Record<string, unknown>>} candidateRows
 * @param {Array<Record<string, unknown>>} verdictRows
 * @param {(row: Record<string, unknown>) => boolean} [isHistoricalVerdict]
 */
export function validateApprovalCoverage(candidateRows, verdictRows, isHistoricalVerdict) {
  const historicalVerdict = isHistoricalVerdict ?? (() => false);
  const captured = candidateRows.filter((row) => row.status === "CAPTURED");
  const blockedDestinations = new Set(candidateRows
    .filter((row) => row.status === "BLOCKED")
    .map((row) => row.intendedSnapshot));
  const verdicts = new Map();

  for (const row of verdictRows) {
    if (row.verdict === "PENDING") fail("PORTIA_APPROVAL_PENDING");
    if (!(["APPROVED", "REJECTED"].includes(row.verdict))) fail("PORTIA_APPROVAL_VERDICT_INVALID", row.verdict);
    if (blockedDestinations.has(row.intendedSnapshot)) fail("PORTIA_BLOCKED_VERDICT_REFUSED", row.intendedSnapshot);
    if (row.verdict === "REJECTED" && (!row.reason || row.reason === "—")) {
      fail("PORTIA_REJECTION_REASON_MISSING", row.intendedSnapshot);
    }
    const identity = `${row.hash}:${row.intendedSnapshot}`;
    if (verdicts.has(identity)) fail("PORTIA_APPROVAL_VERDICT_DUPLICATE", identity);
    verdicts.set(identity, row);
  }

  for (const row of captured) {
    const identity = `${row.sha256}:${row.intendedSnapshot}`;
    if (!verdicts.has(identity)) fail("PORTIA_APPROVAL_VERDICT_MISSING", identity);
  }
  for (const [identity, row] of verdicts) {
    const current = captured.some((candidate) =>
      candidate.sha256 === row.hash && candidate.intendedSnapshot === row.intendedSnapshot);
    if (!current && !historicalVerdict(row)) fail("PORTIA_APPROVAL_VERDICT_UNKNOWN", identity);
  }
  return verdictRows;
}

function runRootFor(candidateSetId) {
  return path.resolve(workspace, "tests/e2e/visual-candidates/.runs", candidateSetId);
}

// Where --verify-ui-map / --verify-approval read rows from; the raw capture wins when present.
function sourceLabel(candidateSetId) {
  return existsSync(runRootFor(candidateSetId))
    ? "Source: capture."
    : "Source: tracked index (candidate PNG bytes not re-hashed).";
}

function readCandidateIndex(candidateSetId, setMismatchCode) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(candidateIndexPath, "utf8"));
  } catch {
    fail("PORTIA_CANDIDATE_INDEX_INVALID", "unreadable");
  }
  if (parsed?.schema !== candidateIndexSchema) fail("PORTIA_CANDIDATE_INDEX_INVALID", "schema");
  if (parsed.setId !== candidateSetId) fail(setMismatchCode, `setId=${parsed.setId}`);
  if (!Array.isArray(parsed.rows) || !parsed.rows.length) fail("PORTIA_CANDIDATE_INDEX_INVALID", "rows");
  return parsed;
}

/**
 * @param {Array<Record<string, unknown>>} indexRows
 * @param {Array<Record<string, unknown>>} captureRows
 */
export function assertCandidateIndexMatches(indexRows, captureRows) {
  const keyed = (rows) => new Map(rows.map((row) => [rowIdentity(row), row]));
  const indexed = keyed(indexRows);
  const captured = keyed(captureRows);
  for (const [identity, row] of captured) {
    if (!indexed.has(identity) || !isDeepStrictEqual(indexed.get(identity), row)) fail("PORTIA_CANDIDATE_INDEX_DRIFT", identity);
  }
  for (const identity of indexed.keys()) {
    if (!captured.has(identity)) fail("PORTIA_CANDIDATE_INDEX_DRIFT", identity);
  }
  if (indexRows.length !== captureRows.length) fail("PORTIA_CANDIDATE_INDEX_DRIFT", "row-count");
}

function verifyApproval() {
  const authority = verifyAuthority();
  const candidates = collectRows({ enforceInventory: true, candidateSetId: authority.candidateSet, allowIndex: true });
  const verdicts = approvalRows();
  validateApprovalCoverage(candidates, verdicts, (row) => {
    const destination = path.resolve(workspace, row.intendedSnapshot);
    return destination.startsWith(`${snapshotRoot}${path.sep}`)
      && existsSync(destination)
      && statSync(destination).isFile()
      && sha256(destination) === row.hash;
  });
  process.stdout.write(`Verified owner verdict coverage for ${candidates.filter((row) => row.status === "CAPTURED").length} captured rows; ${candidates.filter((row) => row.status === "BLOCKED").length} blocked rows excluded. ${sourceLabel(authority.candidateSet)}\n`);
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
  const approvedDestinations = new Set(approved.map((row) => row.intendedSnapshot));
  if (approved.length !== approvedDestinations.size) fail("PORTIA_APPROVAL_DESTINATION_DUPLICATE");
  return approved;
}

function promoteApproved() {
  verifyAuthority();
  const approved = validateApprovalRows(approvalRows());
  const candidates = collectRows().filter((row) => row.status === "CAPTURED");
  const byHashAndDestination = new Map(candidates.map((row) => [
    `${row.sha256}:${row.intendedSnapshot}`,
    row,
  ]));
  for (const approval of approved) {
    const candidate = byHashAndDestination.get(`${approval.hash}:${approval.intendedSnapshot}`);
    if (!candidate) fail("PORTIA_APPROVED_CANDIDATE_MISSING", `${approval.hash}:${approval.intendedSnapshot}`);
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

const phase20RegisterPath = path.resolve(workspace, "tests/e2e/visual/phase20-baselines.json");
const phase20RegisterSchema = "portia-phase20-baselines-v1";
// The register names the owner verdict by its pre-archive path: that is its signed identity and it is compared verbatim.
// The file itself is read from the v1.3 archive.
const phase20VerdictSource = ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-58-SUMMARY.md";
const phase20VerdictFile = path.resolve(workspace, v13Phases, "PORTIA-20-security-accessibility-i-priemka-reliza", "20-58-SUMMARY.md");
const phase20SnapshotDir = "tests/e2e/visual/__screenshots__/";

function frontmatterValue(text, key) {
  const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1];
  if (block === undefined) return undefined;
  const line = block.split(/\r?\n/).find((entry) => entry.startsWith(`${key}:`));
  return line === undefined ? undefined : line.slice(key.length + 1).trim();
}

// D-68: the Phase 20 baselines do not pass through 15-VISUAL-APPROVAL.md. Their bytes are tied to the owner's overall verdict in 20-58-SUMMARY.md
// (owner_verdict: accepted on the commit named there) and to the register tests/e2e/visual/phase20-baselines.json, so --verify-promotion can tell
// a Phase 20 baseline, or a Phase 15 baseline replaced on purpose, from a stray PNG. The function is pure: it gets the parsed Phase 15 approvals,
// the parsed register, the text of 20-58-SUMMARY.md and the SHA-256 of every file on disk (a Map from the workspace-relative path; a missing file is absent),
// and returns the list of { code, detail } problems (empty means the register is accepted).
export function validatePhase20Register({ approvedRows, register, summaryText, fileHashes }) {
  const problems = [];
  const add = (code, detail = "") => problems.push({ code, detail });
  if (
    !register
    || register.schema !== phase20RegisterSchema
    || !Array.isArray(register.rows)
    || register.ownerVerdict?.source !== phase20VerdictSource
  ) {
    add("PORTIA_PHASE20_REGISTER_INVALID", "schema, rows or verdict source");
    return problems;
  }
  const verdict = frontmatterValue(summaryText ?? "", "owner_verdict");
  const verdictCommit = frontmatterValue(summaryText ?? "", "owner_verdict_commit");
  if (verdict !== "accepted" || !/^[0-9a-f]{40}$/.test(verdictCommit ?? "") || verdictCommit !== register.ownerVerdict.commit) {
    add("PORTIA_PHASE20_OWNER_VERDICT_MISSING", `owner_verdict=${verdict ?? "missing"} commit=${verdictCommit ?? "missing"}`);
  }
  const approvedByPath = new Map(approvedRows.map((row) => [row.intendedSnapshot, row.hash]));
  const seen = new Set();
  for (const row of register.rows) {
    const snapshot = row?.snapshot;
    if (typeof snapshot !== "string" || !/^[a-f0-9]{64}$/.test(row.sha256 ?? "")) {
      add("PORTIA_PHASE20_REGISTER_INVALID", `row ${String(snapshot)}`);
      continue;
    }
    if (!snapshot.startsWith(phase20SnapshotDir) || !snapshot.endsWith(".png") || path.posix.normalize(snapshot) !== snapshot) {
      add("PORTIA_PHASE20_DESTINATION_INVALID", snapshot);
      continue;
    }
    if (seen.has(snapshot)) {
      add("PORTIA_PHASE20_DUPLICATE", snapshot);
      continue;
    }
    seen.add(snapshot);
    if (fileHashes.get(snapshot) !== row.sha256) add("PORTIA_PHASE20_SNAPSHOT_HASH_MISMATCH", snapshot);
    const approvedHash = approvedByPath.get(snapshot);
    if (approvedHash !== undefined ? row.supersedes !== approvedHash : row.supersedes !== null) {
      add("PORTIA_PHASE20_SUPERSEDE_INVALID", snapshot);
    }
  }
  return problems;
}

function readPhase20Register() {
  if (!existsSync(phase20RegisterPath)) return undefined;
  try {
    return JSON.parse(readFileSync(phase20RegisterPath, "utf8"));
  } catch {
    return null;
  }
}

function verifyPromotion() {
  verifyAuthority();
  const rows = approvalRows();
  const approved = validateApprovalRows(rows);
  const approvedByDestination = new Map(approved.map((row) => [path.resolve(workspace, row.intendedSnapshot), row]));
  // Without the register everything below is the Phase 15 behaviour; with it, listed paths take the register's bytes.
  const registered = new Map();
  const register = readPhase20Register();
  if (register !== undefined) {
    const fileHashes = new Map();
    for (const row of Array.isArray(register?.rows) ? register.rows : []) {
      const destination = typeof row?.snapshot === "string" ? path.resolve(workspace, row.snapshot) : "";
      if (destination && existsSync(destination) && statSync(destination).isFile()) fileHashes.set(row.snapshot, sha256(destination));
    }
    const summaryFile = phase20VerdictFile;
    const problems = validatePhase20Register({
      approvedRows: approved,
      register,
      summaryText: existsSync(summaryFile) ? readFileSync(summaryFile, "utf8") : "",
      fileHashes,
    });
    if (problems.length) {
      throw new Error(problems.map((problem) => `[${problem.code}]${problem.detail ? ` ${problem.detail}` : ""}`).join("\n"));
    }
    for (const row of register.rows) registered.set(path.resolve(workspace, row.snapshot), row.sha256);
  }
  for (const row of approved) {
    const destination = path.resolve(workspace, row.intendedSnapshot);
    if (!destination.startsWith(`${snapshotRoot}${path.sep}`)) fail("PORTIA_PROMOTION_DESTINATION_REFUSED", destination);
    if (registered.has(destination)) continue;
    if (!existsSync(destination) || !statSync(destination).isFile()) fail("PORTIA_APPROVED_SNAPSHOT_MISSING", row.intendedSnapshot);
    if (sha256(destination) !== row.hash) fail("PORTIA_APPROVED_SNAPSHOT_HASH_MISMATCH", row.intendedSnapshot);
  }
  const trackedSnapshots = snapshotFiles(snapshotRoot).filter((file) => file.toLowerCase().endsWith(".png"));
  for (const snapshot of trackedSnapshots) {
    const expectedHash = registered.get(snapshot) ?? approvedByDestination.get(snapshot)?.hash;
    if (expectedHash === undefined) fail("PORTIA_UNAPPROVED_SNAPSHOT_PRESENT", path.relative(workspace, snapshot));
    if (sha256(snapshot) !== expectedHash) fail("PORTIA_UNAPPROVED_SNAPSHOT_HASH", path.relative(workspace, snapshot));
  }
  const expectedCount = new Set([...approvedByDestination.keys(), ...registered.keys()]).size;
  if (trackedSnapshots.length !== expectedCount) {
    fail("PORTIA_PROMOTION_COUNT_MISMATCH", `${trackedSnapshots.length}/${expectedCount}`);
  }
  process.stdout.write(`Verified ${expectedCount} exact owner-approved snapshot bytes; ${rows.length - approved.length} non-approved rows excluded.\n`);
}

function collectRows({ enforceInventory = false, candidateSetId, allowIndex = false } = {}) {
  const inventory = enforceInventory ? readStableInventory() : undefined;
  const effectiveSetId = candidateSetId ?? inventory?.setId ?? setId;
  const effectiveRunRoot = runRootFor(effectiveSetId);
  const fromCapture = existsSync(effectiveRunRoot);
  const index = allowIndex && existsSync(candidateIndexPath) ? readCandidateIndex(effectiveSetId, fromCapture ? "PORTIA_CANDIDATE_INDEX_DRIFT" : "PORTIA_CANDIDATE_INDEX_INVALID") : undefined;
  if (!fromCapture && !index) fail("PORTIA_CANDIDATE_SET_MISSING", effectiveSetId);
  let rows;
  if (fromCapture) {
    const files = readdirSync(effectiveRunRoot).filter((file) => file.endsWith(".candidate.json") || file.endsWith(".blocked.json"));
    if (!files.length) fail("PORTIA_CANDIDATE_ROWS_MISSING", effectiveSetId);
    rows = files.map((file) => JSON.parse(readFileSync(path.join(effectiveRunRoot, file), "utf8")));
  } else {
    rows = index.rows;
  }
  const sourceCommits = [...new Set(rows.map((row) => row.sourceCommit))];
  if (sourceCommits.length !== 1) fail("PORTIA_CANDIDATE_SOURCE_DIVERGED", sourceCommits.join(","));
  if (!effectiveSetId.endsWith(sourceCommits[0].slice(0, 12))) fail("PORTIA_CANDIDATE_SET_SOURCE_MISMATCH", effectiveSetId);
  if (inventory && (inventory.setId !== effectiveSetId || inventory.sourceCommit !== sourceCommits[0])) {
    fail("PORTIA_STABLE_INVENTORY_AUTHORITY_MISMATCH", effectiveSetId);
  }
  const required = [
    "schema", "setId", "status", "requirement", "surface", "actor", "state", "intendedSnapshot",
    "sourceCommit", "dirtyLedgerId", "fixtureRevision", "seed", "fixedTime", "tool", "browser", "project",
    "os", "viewport", "dpr", "locale", "timezone", "colorScheme", "settings", "resolvedMotion", "resolvedSpider",
  ];
  for (const row of rows) {
    for (const field of required) if (row[field] === undefined || row[field] === "") fail("PORTIA_CANDIDATE_FIELD_MISSING", `${row.state ?? "unknown"}:${field}`);
    if (row.setId !== effectiveSetId) fail("PORTIA_CANDIDATE_SET_MISMATCH", row.setId);
    const destination = path.resolve(workspace, row.intendedSnapshot).replaceAll("\\", "/").toLowerCase();
    if (!destination.includes("/tests/e2e/visual/__screenshots__/")) fail("PORTIA_SNAPSHOT_DESTINATION_INVALID", row.intendedSnapshot);
    // Candidate PNGs live in the gitignored run directory; index mode cannot re-hash them.
    if (fromCapture && row.status === "CAPTURED") {
      const candidate = path.resolve(workspace, row.candidateFile);
      if (!existsSync(candidate) || !statSync(candidate).isFile()) fail("PORTIA_CANDIDATE_PNG_MISSING", row.candidateFile);
      if (sha256(candidate) !== row.sha256) fail("PORTIA_CANDIDATE_HASH_MISMATCH", row.candidateFile);
    }
  }
  validateCandidateRows(rows, inventory?.rows);
  if (index) {
    if (index.sourceCommit !== sourceCommits[0]) {
      fail(fromCapture ? "PORTIA_CANDIDATE_INDEX_DRIFT" : "PORTIA_CANDIDATE_INDEX_INVALID", `sourceCommit=${index.sourceCommit}`);
    }
    if (fromCapture) assertCandidateIndexMatches(index.rows, rows);
  }
  return rows.sort((left, right) => `${left.surface}:${left.state}`.localeCompare(`${right.surface}:${right.state}`));
}

function markdown(rows) {
  const captured = rows.filter((row) => row.status === "CAPTURED");
  const blocked = rows.filter((row) => row.status === "BLOCKED");
  const lines = [
    "# Phase 15 Visual Candidates",
    "",
    `- Candidate set: \`${rows[0].setId}\``,
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
    `Ignored run manifest: \`tests/e2e/visual-candidates/.runs/${rows[0].setId}/manifest.json\`.`,
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function verifyUiMap() {
  const authority = verifyAuthority();
  const map = readFileSync(frameMapPath, "utf8");
  const rows = collectRows({ enforceInventory: true, candidateSetId: authority.candidateSet, allowIndex: true });
  const mapRows = parseUiMapRows(map);
  validateUiMapRows(rows, mapRows);
  process.stdout.write(`Verified repository UI map for ${rows.length} rows (${rows.filter((row) => row.status === "CAPTURED").length} captured, ${rows.filter((row) => row.status === "BLOCKED").length} blocked). ${sourceLabel(authority.candidateSet)}\n`);
}

function runCli() {
  if (args.has("--promote-approved")) {
    promoteApproved();
    verifyPromotion();
  } else if (args.has("--verify-promotion")) {
    verifyPromotion();
  } else if (args.has("--verify-approval")) {
    verifyApproval();
  } else if (args.has("--verify-ui-map")) {
    verifyUiMap();
  } else if (args.has("--write-candidate-index")) {
    if (existsSync(candidateIndexPath)) fail("PORTIA_CANDIDATE_INDEX_EXISTS");
    const authority = verifyAuthority();
    const rows = collectRows({ enforceInventory: true, candidateSetId: authority.candidateSet });
    // Plain string comparison keeps the committed order locale-independent.
    rows.sort((left, right) => (rowIdentity(left) < rowIdentity(right) ? -1 : rowIdentity(left) > rowIdentity(right) ? 1 : 0));
    writeFileSync(candidateIndexPath, `${JSON.stringify({
      schema: candidateIndexSchema,
      setId: authority.candidateSet,
      sourceCommit: rows[0].sourceCommit,
      rows,
    }, null, 2)}\n`);
    process.stdout.write(`Wrote candidate index for ${rows.length} rows.\n`);
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
    // Rows carry the authoritative set; the HEAD-derived default must never name a verified manifest.
    const manifestSetId = rows[0].setId;
    const manifestRoot = path.resolve(workspace, "tests/e2e/visual-candidates/.runs", manifestSetId);
    mkdirSync(manifestRoot, { recursive: true });
    writeFileSync(path.join(manifestRoot, "manifest.json"), `${JSON.stringify({ schema: "portia-phase15-visual-manifest-v1", setId: manifestSetId, sourceCommit: rows[0].sourceCommit, rows }, null, 2)}\n`);
    if (args.has("--verify")) {
      writeFileSync(evidencePath, markdown(rows));
      process.stdout.write(`Verified ${rows.length} rows (${rows.filter((row) => row.status === "CAPTURED").length} PNGs) for ${manifestSetId}.\n`);
    } else {
      process.stdout.write(`Wrote manifest for ${manifestSetId}.\n`);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli();
}
