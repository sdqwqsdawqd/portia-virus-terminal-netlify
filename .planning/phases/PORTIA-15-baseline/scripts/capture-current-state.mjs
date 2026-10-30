import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { arch, platform, release } from "node:os";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(SCRIPT_DIR, "../../../..");
const PHASE_DIR = resolve(ROOT, ".planning/phases/PORTIA-15-baseline");
const EVIDENCE_DIR = resolve(PHASE_DIR, "evidence");
const CURRENT_LEDGER = resolve(EVIDENCE_DIR, "15-CURRENT-STATE-LEDGER.md");
const ENVIRONMENT_LEDGER = resolve(EVIDENCE_DIR, "15-ENVIRONMENT.md");
const OWNERSHIP_LEDGER = resolve(EVIDENCE_DIR, "15-DIRTY-OWNERSHIP.md");
const LIMITATIONS_LEDGER = resolve(EVIDENCE_DIR, "15-ACCEPTED-LIMITATIONS.md");

const GENERATED_PREFIXES = [
  ".planning/phases/PORTIA-15-baseline/scripts/",
  ".planning/phases/PORTIA-15-baseline/evidence/",
];
const ORCHESTRATOR_PATHS = new Set([
  ".planning/STATE.md",
  ".planning/ROADMAP.md",
  ".planning/REQUIREMENTS.md",
  ".planning/config.json",
]);
const ENVIRONMENT_NAMES = [
  "CI",
  "NODE_ENV",
  "TZ",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "PORTIA_PROMOTION_LIVE",
  "PORTIA_SUPABASE_PROJECT_REF",
  "PORTIA_ISOLATED_TEST_PROJECT",
];

function run(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      cwd: ROOT,
      encoding: options.encoding ?? "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
  } catch (error) {
    if (options.optional) return "";
    const detail = error?.stderr?.toString?.().trim() || error.message;
    throw new Error(`${command} ${args.join(" ")} failed: ${detail}`);
  }
}

function git(args, options = {}) {
  return run("git", args, options);
}

function normalizePath(value) {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}

function isGeneratedOrOrchestratorPath(value) {
  const path = normalizePath(value);
  return (
    ORCHESTRATOR_PATHS.has(path) ||
    GENERATED_PREFIXES.some((prefix) => path.startsWith(prefix))
  );
}

function pathspecArgs() {
  return [
    ".",
    ...GENERATED_PREFIXES.map((prefix) => `:(exclude)${prefix}**`),
    ...[...ORCHESTRATOR_PATHS].map((path) => `:(exclude)${path}`),
  ];
}

function nulList(output) {
  return output
    .split("\0")
    .map(normalizePath)
    .filter(Boolean)
    .filter((path) => !isGeneratedOrOrchestratorPath(path))
    .sort((a, b) => a.localeCompare(b, "en"));
}

function sha256File(path) {
  const hash = createHash("sha256");
  hash.update(readFileSync(path));
  return hash.digest("hex");
}

function sha256Text(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function safeHeadBlob(path) {
  return git(["rev-parse", `HEAD:${path}`], { optional: true }).trim() || null;
}

function fileRecord(path, sets) {
  const absolute = resolve(ROOT, path);
  const flags = [];
  if (sets.untracked.has(path)) flags.push("untracked");
  if (sets.staged.has(path)) flags.push("staged");
  if (sets.modified.has(path)) flags.push("modified");
  if (sets.deleted.has(path)) flags.push("deleted");
  const present = existsSync(absolute) && statSync(absolute).isFile();
  return {
    path,
    state: flags.join("+") || "unknown",
    headBlob: sets.untracked.has(path) ? null : safeHeadBlob(path),
    worktreeSha256: present ? sha256File(absolute) : null,
    sizeBytes: present ? statSync(absolute).size : null,
  };
}

function version(command, args = ["--version"]) {
  return run(command, args, { optional: true }).trim() || "UNAVAILABLE";
}

function npmVersion() {
  if (platform() !== "win32") return version("npm");
  return version("cmd.exe", ["/d", "/s", "/c", "npm.cmd --version"]);
}

function capture() {
  const specs = pathspecArgs();
  const modified = new Set(
    nulList(git(["diff", "--name-only", "-z", "--", ...specs])),
  );
  const staged = new Set(
    nulList(git(["diff", "--cached", "--name-only", "-z", "--", ...specs])),
  );
  const deleted = new Set(
    nulList(git(["ls-files", "--deleted", "-z", "--", ...specs])),
  );
  const untracked = new Set(
    nulList(git(["ls-files", "--others", "--exclude-standard", "-z", "--", ...specs])),
  );
  const allPaths = [...new Set([...modified, ...staged, ...deleted, ...untracked])].sort(
    (a, b) => a.localeCompare(b, "en"),
  );
  const head = git(["rev-parse", "HEAD"]).trim();
  const upstream = git(
    ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
    { optional: true },
  ).trim();
  const aheadBehind = upstream
    ? git(["rev-list", "--left-right", "--count", `${upstream}...HEAD`]).trim()
    : null;
  const status = git([
    "status",
    "--porcelain=v2",
    "--branch",
    "--untracked-files=all",
    "--",
    ...specs,
  ]).replaceAll("\r\n", "\n").trimEnd();
  const numstat = git(["diff", "--numstat", "--", ...specs])
    .replaceAll("\r\n", "\n")
    .trimEnd();
  const stagedNumstat = git(["diff", "--cached", "--numstat", "--", ...specs])
    .replaceAll("\r\n", "\n")
    .trimEnd();
  const files = allPaths.map((path) =>
    fileRecord(path, { modified, staged, deleted, untracked }),
  );

  return {
    schema: "portia-phase15-current-state-v1",
    source: {
      head,
      headCommitTime: git(["show", "-s", "--format=%cI", "HEAD"]).trim(),
      branch: git(["branch", "--show-current"]).trim(),
      upstream: upstream || null,
      aheadBehind,
    },
    status,
    diffMetadata: {
      numstat,
      stagedNumstat,
      binaryPaths: [...numstat.split("\n"), ...stagedNumstat.split("\n")]
        .filter((line) => line.startsWith("-\t-\t"))
        .map((line) => normalizePath(line.split("\t").slice(2).join("\t")))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "en")),
    },
    files,
    environment: {
      os: `${platform()} ${release()} ${arch()}`,
      node: process.version,
      npm: npmVersion(),
      git: version("git"),
      variables: Object.fromEntries(
        ENVIRONMENT_NAMES.map((name) => [name, Object.hasOwn(process.env, name)]),
      ),
    },
    exclusions: {
      generatedPrefixes: GENERATED_PREFIXES,
      orchestratorPaths: [...ORCHESTRATOR_PATHS].sort(),
      reason:
        "Phase 15 evidence/script outputs and GSD single-writer tracking files are excluded so the captured pre-existing worktree remains stable.",
    },
  };
}

function markdownCell(value) {
  if (value === null || value === "") return "—";
  return String(value).replaceAll("|", "\\|").replaceAll("\n", "<br>");
}

function renderCurrentLedger(snapshot) {
  const digest = sha256Text(JSON.stringify(snapshot));
  const rows = snapshot.files.length
    ? snapshot.files
        .map(
          (file) =>
            `| \`${markdownCell(file.path)}\` | ${markdownCell(file.state)} | ${markdownCell(file.headBlob)} | ${markdownCell(file.worktreeSha256)} | ${markdownCell(file.sizeBytes)} |`,
        )
        .join("\n")
    : "| — | clean | — | — | — |";
  return `# Phase 15 Current-State Ledger

**Status:** CAPTURED  
**Schema:** \`${snapshot.schema}\`  
**Snapshot SHA-256:** \`${digest}\`  
**Source commit:** \`${snapshot.source.head}\`  
**Source commit time:** ${snapshot.source.headCommitTime}

## Git Identity

| Field | Value |
|---|---|
| Branch | \`${snapshot.source.branch}\` |
| Upstream | ${snapshot.source.upstream ? `\`${snapshot.source.upstream}\`` : "—"} |
| Behind / ahead | ${snapshot.source.aheadBehind ? `\`${snapshot.source.aheadBehind}\`` : "—"} |

## Stable Dirty Inventory

| Path | State | HEAD blob | Worktree SHA-256 | Bytes |
|---|---|---|---|---:|
${rows}

## Porcelain v2

\`\`\`text
${snapshot.status || "# clean"}
\`\`\`

## Tracked Diff Metadata

Unstaged \`git diff --numstat\`:

\`\`\`text
${snapshot.diffMetadata.numstat || "# none"}
\`\`\`

Staged \`git diff --cached --numstat\`:

\`\`\`text
${snapshot.diffMetadata.stagedNumstat || "# none"}
\`\`\`

Binary paths: ${snapshot.diffMetadata.binaryPaths.length ? snapshot.diffMetadata.binaryPaths.map((path) => `\`${path}\``).join(", ") : "none"}.

## Capture Boundary

The inventory excludes only Phase 15 generated evidence/script paths and GSD-owned tracking files: ${snapshot.exclusions.orchestratorPaths.map((path) => `\`${path}\``).join(", ")}. This prevents the capture process itself from changing the snapshot. No reset, checkout, clean, stash, move or delete command is used.
`;
}

function renderEnvironment(snapshot) {
  const variableRows = Object.entries(snapshot.environment.variables)
    .map(([name, present]) => `| \`${name}\` | ${present ? "present" : "absent"} |`)
    .join("\n");
  return `# Phase 15 Environment

**Status:** CAPTURED  
**Source commit:** \`${snapshot.source.head}\`

| Tool | Captured value |
|---|---|
| OS | \`${snapshot.environment.os}\` |
| Node.js | \`${snapshot.environment.node}\` |
| npm | \`${snapshot.environment.npm}\` |
| Git | \`${snapshot.environment.git}\` |

## Environment-variable Presence

Values are intentionally never read into this artifact; only name/presence is recorded.

| Variable | Presence |
|---|---|
${variableRows}

## Required Phase 15 Runtime

- Package and browser work is blocked until Node \`22.13.x\` is active.
- The current host value above is evidence only and does not authorize package installation.
- A dedicated non-production Supabase target, role accounts, Figma authority and representative phone remain separate owner gates.
`;
}

function ensureEvidenceTarget(path) {
  const rel = relative(EVIDENCE_DIR, resolve(path));
  if (rel.startsWith("..") || rel === ".." || rel.startsWith(`..${sep}`)) {
    throw new Error(`Refusing write outside Phase 15 evidence directory: ${path}`);
  }
}

function writeEvidence(path, content) {
  ensureEvidenceTarget(path);
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  writeFileSync(path, content.replaceAll("\r\n", "\n"), "utf8");
}

function ownershipKeys(snapshot) {
  const knownGroups = [
    ".planning/forensics/",
    ".planning/milestones/v1.2-incomplete-research/",
    ".planning/quick/261028-c9g-portia-promotion-1-8/",
    ".planning/ui-reviews/",
  ];
  const keys = [];
  const grouped = new Set();
  for (const group of knownGroups) {
    const members = snapshot.files.filter((file) => file.path.startsWith(group));
    if (members.length) {
      keys.push(group);
      members.forEach((file) => grouped.add(file.path));
    }
  }
  for (const file of snapshot.files) {
    if (!grouped.has(file.path)) keys.push(file.path);
  }
  return keys.sort((a, b) => a.localeCompare(b, "en"));
}

function verifyLedgers(snapshot) {
  if (!existsSync(OWNERSHIP_LEDGER)) {
    throw new Error("Missing 15-DIRTY-OWNERSHIP.md");
  }
  if (!existsSync(LIMITATIONS_LEDGER)) {
    throw new Error("Missing 15-ACCEPTED-LIMITATIONS.md");
  }
  const ownership = readFileSync(OWNERSHIP_LEDGER, "utf8");
  const limitations = readFileSync(LIMITATIONS_LEDGER, "utf8");
  const expected = ownershipKeys(snapshot);
  const found = [...ownership.matchAll(/<!-- inventory-key: (.+?) -->/g)].map(
    (match) => match[1],
  );
  const missing = expected.filter((key) => !found.includes(key));
  const duplicates = [...new Set(found.filter((key, index) => found.indexOf(key) !== index))];
  const unexpected = found.filter((key) => !expected.includes(key));
  const requiredHeaders = [
    "Status",
    "Hash / blob evidence",
    "Likely origin",
    "Proposed owner",
    "Disposition",
    "Phase 15 touch",
    "Recovery artifact",
    "Blocker",
  ];
  const missingHeaders = requiredHeaders.filter((header) => !ownership.includes(header));
  if (missing.length || duplicates.length || unexpected.length || missingHeaders.length) {
    throw new Error(
      `Ownership verification failed: missing=${missing.join(",") || "none"}; duplicates=${duplicates.join(",") || "none"}; unexpected=${unexpected.join(",") || "none"}; headers=${missingHeaders.join(",") || "none"}`,
    );
  }
  if (!limitations.includes(`SOURCE-COMMIT: ${snapshot.source.head}`)) {
    throw new Error("Accepted limitations ledger has no matching SOURCE-COMMIT");
  }
  for (const requiredRef of [".planning/PROJECT.md", ".planning/REQUIREMENTS.md"]) {
    if (!limitations.includes(requiredRef)) {
      throw new Error(`Accepted limitations ledger is missing ${requiredRef}`);
    }
  }
  process.stdout.write(
    `Ledger verification OK: ${expected.length} ownership rows, zero missing/duplicate paths, canonical limitation references present.\n`,
  );
}

function main() {
  const mode = process.argv[2] || "--check";
  const first = capture();
  if (mode === "--verify-ledgers") {
    verifyLedgers(first);
    return;
  }
  if (mode !== "--check") {
    throw new Error(`Unknown option: ${mode}`);
  }
  const second = capture();
  if (JSON.stringify(first) !== JSON.stringify(second)) {
    throw new Error("Current-state capture is not deterministic across consecutive reads");
  }
  writeEvidence(CURRENT_LEDGER, renderCurrentLedger(first));
  writeEvidence(ENVIRONMENT_LEDGER, renderEnvironment(first));
  const third = capture();
  if (JSON.stringify(first) !== JSON.stringify(third)) {
    throw new Error("Writing evidence changed the captured pre-existing worktree state");
  }
  if (readFileSync(CURRENT_LEDGER, "utf8") !== renderCurrentLedger(third)) {
    throw new Error("Current-state ledger does not match normalized capture");
  }
  if (readFileSync(ENVIRONMENT_LEDGER, "utf8") !== renderEnvironment(third)) {
    throw new Error("Environment ledger does not match normalized capture");
  }
  process.stdout.write(
    `Capture OK: ${first.files.length} dirty paths, snapshot ${sha256Text(JSON.stringify(first))}.\n`,
  );
}

main();
