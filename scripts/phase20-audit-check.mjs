import { createHash } from "node:crypto";
import * as nodeFs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Phase 20 dependency audit evidence (20-10). Two modes, no network except `npm audit` itself:
//   --capture  runs `npm audit --omit=dev --json` and `npm audit --json` on one commit and stores the normalized result;
//   --verify   fail-closed comparison of that JSON, 20-DEPENDENCY-AUDIT.md and the current tree.
// No environment file is read and nothing is installed. A lockfile change is out of scope for both modes.

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PHASE_DIR = ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza";
export const REPORT_JSON = `${PHASE_DIR}/20-DEPENDENCY-AUDIT.json`;
export const REPORT_MD = `${PHASE_DIR}/20-DEPENDENCY-AUDIT.md`;
export const SCHEMA = "phase20-dependency-audit/1";
export const DISPOSITIONS = new Set(["accepted", "fixed", "reassessed", "blocker"]);

const PRODUCTION_ARGS = ["audit", "--omit=dev", "--json"];
const FULL_ARGS = ["audit", "--json"];
const COMMAND_PATTERN = { production: /^npm(?:\.cmd)? audit --omit=dev --json$/, full: /^npm(?:\.cmd)? audit --json$/ };
const SEVERITIES = new Set(["info", "low", "moderate", "high", "critical"]);
const HIGH = new Set(["high", "critical"]);

export class AuditError extends Error {
  constructor(code, detail = "") {
    super(`[PORTIA_AUDIT:${code}]${detail ? ` ${detail}` : ""}`);
    this.code = code;
  }
}

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

/** Shortest chain from a direct dependency down to the vulnerable package, following npm's `effects` edges backwards. */
function dependencyPath(name, vulnerabilities) {
  const parents = new Map();
  for (const [from, node] of Object.entries(vulnerabilities)) {
    for (const effect of node.effects ?? []) {
      if (typeof effect === "string") parents.set(effect, [...(parents.get(effect) ?? []), from]);
    }
  }
  // Breadth first from the vulnerable package up through the packages it affects until a direct dependency.
  const queue = [[name]];
  const seen = new Set([name]);
  while (queue.length) {
    const chain = queue.shift();
    const head = chain[chain.length - 1];
    if (vulnerabilities[head]?.isDirect) return [...chain].reverse().join(" > ");
    for (const next of vulnerabilities[head]?.effects ?? []) {
      if (typeof next === "string" && !seen.has(next)) { seen.add(next); queue.push([...chain, next]); }
    }
  }
  return name;
}

function advisoryId(advisory) {
  const fromUrl = typeof advisory.url === "string" ? advisory.url.match(/(GHSA-[a-z0-9-]+)/i)?.[1] : undefined;
  return fromUrl ?? `npm-advisory-${advisory.source}`;
}

/** One finding per own advisory of a package, or `via:<package>` for a package that is only affected through others. */
export function normalizeAudit(json) {
  if (!json || typeof json !== "object" || json.error) throw new AuditError("audit-error", "npm audit did not return a report");
  const vulnerabilities = json.vulnerabilities;
  if (!vulnerabilities || typeof vulnerabilities !== "object") throw new AuditError("audit-shape", "no vulnerabilities object");
  const findings = [];
  for (const name of Object.keys(vulnerabilities).sort()) {
    const node = vulnerabilities[name];
    const own = (node.via ?? []).filter((entry) => entry && typeof entry === "object");
    const base = {
      package: name,
      severity: node.severity,
      isDirect: Boolean(node.isDirect),
      via: (node.via ?? []).map((entry) => (typeof entry === "string" ? entry : advisoryId(entry))),
      effects: [...(node.effects ?? [])].sort(),
      nodes: [...(node.nodes ?? [])].sort(),
      path: dependencyPath(name, vulnerabilities),
      range: node.range ?? "",
      fix: node.fixAvailable && typeof node.fixAvailable === "object"
        ? `${node.fixAvailable.name}@${node.fixAvailable.version}${node.fixAvailable.isSemVerMajor ? " (semver-major)" : ""}`
        : String(node.fixAvailable ?? false),
    };
    if (own.length === 0) findings.push({ id: `via:${name}`, ...base, advisory: null });
    for (const advisory of own) {
      findings.push({
        id: advisoryId(advisory),
        ...base,
        severity: advisory.severity ?? node.severity,
        advisory: { source: advisory.source, title: advisory.title ?? "", url: advisory.url ?? "", range: advisory.range ?? "", cwe: advisory.cwe ?? [] },
      });
    }
  }
  return findings;
}

const countsOf = (json) => ({ ...(json?.metadata?.vulnerabilities ?? {}) });

/** A markdown table row to trimmed cells. */
const cells = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());

/** Rows of the `## Dev disposition` table: id, package, severity, disposition, rationale, owner. */
export function parseDevDispositions(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex((line) => line.startsWith("## ") && line.slice(3).trim().startsWith("Dev disposition"));
  if (start === -1) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  const table = (end === -1 ? rest : rest.slice(0, end)).filter((line) => line.trimStart().startsWith("|"));
  return table.slice(2).map((line) => {
    const [id, pkg, severity, disposition, rationale, owner] = cells(line);
    return { id: id?.replace(/`/g, ""), package: pkg, severity, disposition, rationale, owner };
  });
}

export function markdownCommit(markdown) {
  return markdown.match(/^Commit:\s*`?([0-9a-f]{40})`?\s*$/m)?.[1] ?? null;
}

/**
 * Every problem found when comparing the stored report, the disposition ledger and the current tree.
 * `current` = { isAncestor(commit) => boolean, lockfileSha256, packageJsonSha256 }.
 */
export function verifyAuditReport({ report, markdown, current }) {
  const problems = [];
  if (!report || typeof report !== "object") return ["audit report json is missing or not an object"];
  if (typeof markdown !== "string" || markdown.trim() === "") return ["audit report markdown is missing or empty"];
  if (report.schema !== SCHEMA) problems.push(`unexpected schema "${report.schema}"`);

  const commit = typeof report.commit === "string" && /^[0-9a-f]{40}$/.test(report.commit) ? report.commit : null;
  if (!commit) problems.push("report commit is missing or not a full sha");
  else if (!current.isAncestor(commit)) problems.push(`stale report: commit ${commit.slice(0, 7)} is not an ancestor of HEAD`);
  if (report.lockfileSha256 !== current.lockfileSha256) problems.push("stale report: package-lock.json changed after the audit was captured");
  if (report.packageJsonSha256 !== current.packageJsonSha256) problems.push("stale report: package.json changed after the audit was captured");
  const mdCommit = markdownCommit(markdown);
  if (!mdCommit) problems.push("markdown has no `Commit:` line");
  else if (commit && mdCommit !== commit) problems.push(`stale markdown: Commit ${mdCommit.slice(0, 7)} differs from json commit ${commit.slice(0, 7)}`);

  const audits = report.audits ?? {};
  for (const kind of ["production", "full"]) {
    const audit = audits[kind];
    if (!audit || typeof audit !== "object") { problems.push(`${kind} audit is missing from the json report`); continue; }
    if (typeof audit.command !== "string" || !COMMAND_PATTERN[kind].test(audit.command)) problems.push(`${kind} audit command is not the exact npm audit command: "${audit.command}"`);
    if (!Number.isInteger(audit.exitCode)) problems.push(`${kind} audit exit code is not recorded`);
    if (!Array.isArray(audit.findings)) problems.push(`${kind} audit findings are not a list`);
  }
  if (problems.some((problem) => /audit is missing|not a list/.test(problem))) return problems;

  const production = audits.production;
  const full = audits.full;
  if (production.exitCode !== 0) problems.push(`production audit exit code is ${production.exitCode}, expected 0`);
  if (production.findings.length > 0) problems.push(`production audit has ${production.findings.length} finding(s): ${production.findings.map((finding) => finding.id).join(", ")}`);
  if (full.exitCode === 0 && full.findings.length > 0) problems.push("full audit exit code 0 contradicts its recorded findings");

  const productionIds = new Set(production.findings.map((finding) => finding.id));
  const dev = full.findings.filter((finding) => !productionIds.has(finding.id));
  const devIds = dev.map((finding) => finding.id);
  if (new Set(devIds).size !== devIds.length) problems.push("json report lists the same dev finding id twice");
  for (const finding of dev) {
    if (!SEVERITIES.has(finding.severity)) problems.push(`${finding.id}: unknown severity "${finding.severity}" in json`);
  }

  const rows = parseDevDispositions(markdown);
  const byId = new Map();
  for (const row of rows) byId.set(row.id, [...(byId.get(row.id) ?? []), row]);
  for (const [id, group] of byId) if (group.length > 1) problems.push(`${id}: ${group.length} dispositions, exactly one is required`);
  for (const id of new Set(devIds)) if (!byId.has(id)) problems.push(`${id}: dev advisory has no disposition`);
  for (const id of byId.keys()) if (!devIds.includes(id)) problems.push(`${id}: disposition for an advisory that is not in the json report`);

  for (const finding of dev) {
    const row = byId.get(finding.id)?.[0];
    if (!row) continue;
    if (!DISPOSITIONS.has(row.disposition)) problems.push(`${finding.id}: disposition "${row.disposition}" is not one of ${[...DISPOSITIONS].join("/")}`);
    if (!row.rationale) problems.push(`${finding.id}: empty rationale`);
    if (!row.owner) problems.push(`${finding.id}: empty owner`);
    if (row.severity !== finding.severity) problems.push(`${finding.id}: markdown severity "${row.severity}" differs from audit severity "${finding.severity}"`);
    if (row.package !== finding.package) problems.push(`${finding.id}: markdown package "${row.package}" differs from audit package "${finding.package}"`);
    if (HIGH.has(finding.severity)) {
      if (row.disposition === "reassessed" && !/D-12/.test(row.rationale ?? "")) problems.push(`${finding.id}: reassessed ${finding.severity} needs an evidence-based D-12 rationale`);
      if (row.disposition !== "fixed" && row.disposition !== "reassessed") problems.push(`${finding.id}: unresolved ${finding.severity} advisory blocks the release (D-12)`);
    }
  }
  return problems;
}

function defaultDeps() {
  const git = (...args) => {
    const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
    return { status: result.status, stdout: (result.stdout ?? "").trim() };
  };
  const npm = (args) => {
    const win = process.platform === "win32";
    const executable = win ? "npm.cmd" : "npm";
    const result = spawnSync(executable, args, { cwd: ROOT, encoding: "utf8", shell: win, maxBuffer: 64 * 1024 * 1024 });
    return { command: `${executable} ${args.join(" ")}`, status: result.status, stdout: result.stdout ?? "" };
  };
  return { fs: nodeFs, git, npm, root: ROOT, out: (text) => process.stdout.write(text), err: (text) => process.stderr.write(text), now: () => new Date().toISOString() };
}

// Line endings are normalized so a checkout with another autocrlf setting still matches the recorded hash.
const fileHash = (deps, relative) => {
  const text = deps.fs.readFileSync(path.join(deps.root, relative)).toString("latin1").replace(/\r\n/g, "\n");
  return sha256(Buffer.from(text, "latin1"));
};

export function capture(deps) {
  const dirty = deps.git("status", "--porcelain", "--", "package.json", "package-lock.json").stdout;
  if (dirty) throw new AuditError("dirty-manifest", "package.json or package-lock.json has uncommitted changes; the audit must describe a commit");
  const before = deps.git("rev-parse", "HEAD").stdout;
  const productionRun = deps.npm(PRODUCTION_ARGS);
  const fullRun = deps.npm(FULL_ARGS);
  const after = deps.git("rev-parse", "HEAD").stdout;
  if (!/^[0-9a-f]{40}$/.test(before) || before !== after) throw new AuditError("head-moved", "HEAD changed while the audits ran; retry");
  const parse = (run) => { try { return JSON.parse(run.stdout); } catch { throw new AuditError("audit-not-json", run.command); } };
  const productionJson = parse(productionRun);
  const fullJson = parse(fullRun);
  const report = {
    schema: SCHEMA,
    commit: before,
    capturedAt: deps.now(),
    node: process.version,
    lockfileSha256: fileHash(deps, "package-lock.json"),
    packageJsonSha256: fileHash(deps, "package.json"),
    audits: {
      production: { command: productionRun.command, exitCode: productionRun.status, counts: countsOf(productionJson), findings: normalizeAudit(productionJson) },
      full: { command: fullRun.command, exitCode: fullRun.status, counts: countsOf(fullJson), findings: normalizeAudit(fullJson) },
    },
  };
  deps.fs.writeFileSync(path.join(deps.root, REPORT_JSON), `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

export function verify(deps) {
  const read = (relative) => {
    const file = path.join(deps.root, relative);
    if (!deps.fs.existsSync(file)) throw new AuditError("missing-report", relative);
    return deps.fs.readFileSync(file, "utf8");
  };
  let report;
  try { report = JSON.parse(read(REPORT_JSON)); } catch (error) { if (error instanceof AuditError) throw error; throw new AuditError("report-not-json", REPORT_JSON); }
  const markdown = read(REPORT_MD);
  const head = deps.git("rev-parse", "HEAD").stdout;
  return verifyAuditReport({
    report,
    markdown,
    current: {
      isAncestor: (commit) => deps.git("merge-base", "--is-ancestor", commit, head).status === 0,
      lockfileSha256: fileHash(deps, "package-lock.json"),
      packageJsonSha256: fileHash(deps, "package.json"),
    },
  });
}

export function main(argv = process.argv.slice(2), overrides = {}) {
  const deps = { ...defaultDeps(), ...overrides };
  const mode = argv[0];
  try {
    if (mode === "--capture") {
      const report = capture(deps);
      deps.out(`captured ${report.commit.slice(0, 7)}: production ${report.audits.production.findings.length} finding(s), full ${report.audits.full.findings.length} finding(s)\n`);
      return 0;
    }
    if (mode === "--verify") {
      const problems = verify(deps);
      if (problems.length) {
        deps.err(`${problems.map((problem) => `[PORTIA_AUDIT:verify-failed] ${problem}`).join("\n")}\n`);
        return 1;
      }
      deps.out("dependency audit evidence verified\n");
      return 0;
    }
    deps.err("usage: node scripts/phase20-audit-check.mjs --capture | --verify\n");
    return 2;
  } catch (error) {
    deps.err(`${error instanceof AuditError ? error.message : `[PORTIA_AUDIT:unexpected] ${error instanceof Error ? error.message : "unknown"}`}\n`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
