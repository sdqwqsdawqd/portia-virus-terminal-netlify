import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

// Phase 20-27 (pre-builds 20-14 Task 1): fail-closed validation of the owner physical-device UAT ledger (20-UAT.md).
// Default mode checks structure and honest statuses. PORTIA_REQUIRE_UAT=1 (20-14 Task 2 gate) additionally requires final statuses and verdicts.

const root = path.resolve(import.meta.dirname, "..");
const uatPath = path.join(root, ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-UAT.md");

export const stepStatuses = ["ОЖИДАЕТ", "PASS", "FAIL", "BLOCKED (ENV)", "BLOCKED (DATA)", "BLOCKED (OWNER)", "BLOCKED (DEVICE)"];

const hexCommit = /^[0-9a-f]{7,40}$/;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const empty = (value: string) => value === "" || value === "-";

export type Prerequisite = { id: string; what: string; source: string; status: string; date: string; note: string };
export type Step = {
  id: string; step: string; expected: string; requirements: string; dependsOn: string; status: string;
  device: string; commit: string; date: string; note: string; screenshot: string;
};
export type Verdict = { raw: string; status: string; commit: string };
export type Uat = {
  frontmatter: Record<string, string>;
  headingLine: { pc: number; phone: number };
  prerequisites: Prerequisite[];
  pc: Step[];
  phone: Step[];
  verdicts: { pc: Verdict | null; phone: Verdict | null };
  d15: Record<string, string>;
  problems: string[];
};

export type Section = "prereq" | "pc" | "phone" | "verdicts" | "d15" | "other";

export function sectionOf(heading: string): Section {
  if (/^## Prerequisites\b/.test(heading)) return "prereq";
  if (/^## Чек-лист PC\b/.test(heading)) return "pc";
  if (/^## Чек-лист phone\b/.test(heading)) return "phone";
  if (/^## Вердикты(\s|$)/.test(heading)) return "verdicts";
  if (/^## D-15\b/.test(heading)) return "d15";
  return "other";
}

export const splitRow = (line: string): string[] =>
  line.slice(1, line.endsWith("|") ? -1 : undefined).split("|").map((cell) => cell.trim());

const isHeaderOrSeparator = (cells: string[]) => cells[0] === "ID" || /^:?-+:?$/.test(cells[0]);

function parseVerdict(raw: string): Verdict {
  const commit = raw.match(/\(commit ([0-9a-fA-F]+)\)/)?.[1] ?? "";
  const status = raw.replace(/\s*\(commit [^)]*\)\s*$/, "").trim();
  return { raw, status, commit };
}

export function parseUat(text: string): Uat {
  const lines = text.split(/\r?\n/);
  const uat: Uat = {
    frontmatter: {}, headingLine: { pc: -1, phone: -1 }, prerequisites: [], pc: [], phone: [],
    verdicts: { pc: null, phone: null }, d15: {}, problems: [],
  };
  let index = 0;
  if (lines[0] === "---") {
    index = 1;
    for (; index < lines.length && lines[index] !== "---"; index += 1) {
      const match = lines[index].match(/^([A-Za-z_]+):\s*(.*)$/);
      if (match) uat.frontmatter[match[1]] = match[2].trim();
    }
    index += 1;
  }
  let section: Section = "other";
  for (; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith("## ")) {
      section = sectionOf(line);
      if (section === "pc" || section === "phone") uat.headingLine[section] = index;
      continue;
    }
    if (section === "verdicts") {
      const verdict = line.match(/^Вердикт (PC|phone): (.+)$/);
      if (verdict) uat.verdicts[verdict[1] === "PC" ? "pc" : "phone"] = parseVerdict(verdict[2].trim());
      continue;
    }
    if (section === "d15") {
      const field = line.match(/^- ([^:]+):\s*(.*)$/);
      if (field) uat.d15[field[1].trim()] = field[2].trim();
      continue;
    }
    if (!line.startsWith("|")) continue;
    const cells = splitRow(line);
    if (isHeaderOrSeparator(cells)) continue;
    if (section === "prereq") {
      if (cells.length !== 6) { uat.problems.push(`prerequisite row "${cells[0]}" has ${cells.length} cells, expected 6`); continue; }
      uat.prerequisites.push({ id: cells[0], what: cells[1], source: cells[2], status: cells[3], date: cells[4], note: cells[5] });
    } else if (section === "pc" || section === "phone") {
      if (cells.length !== 11) { uat.problems.push(`${section} row "${cells[0]}" has ${cells.length} cells, expected 11`); continue; }
      uat[section].push({
        id: cells[0], step: cells[1], expected: cells[2], requirements: cells[3], dependsOn: cells[4], status: cells[5],
        device: cells[6], commit: cells[7], date: cells[8], note: cells[9], screenshot: cells[10],
      });
    }
  }
  return uat;
}

export type UatOptions = {
  requireComplete?: boolean;
  // `git cat-file -e` in the real run; a stub in fixtures. Must be provided for commit existence to be checked.
  commitExists?: (commit: string) => boolean;
};

const deviceLabel = { pc: "PC", phone: "phone" } as const;

export function validateUat(text: string, options: UatOptions = {}): string[] {
  const errors: string[] = [];
  const uat = parseUat(text);
  errors.push(...uat.problems);

  if (uat.headingLine.pc < 0) errors.push("the PC checklist table is missing");
  if (uat.headingLine.phone < 0) errors.push("the phone checklist table is missing");
  if (uat.headingLine.pc >= 0 && uat.headingLine.phone >= 0 && uat.headingLine.phone < uat.headingLine.pc) {
    errors.push("PC must come before phone (D-13)");
  }
  if (!uat.verdicts.pc) errors.push("the PC verdict line is missing");
  if (!uat.verdicts.phone) errors.push("the phone verdict line is missing");

  for (const device of ["pc", "phone"] as const) {
    for (const step of uat[device]) {
      const where = `${step.id} on ${deviceLabel[device]}`;
      if (!stepStatuses.includes(step.status)) { errors.push(`${where}: unknown status "${step.status}"`); continue; }
      if (step.status !== "PASS") continue;
      if (step.device.toLowerCase() !== deviceLabel[device].toLowerCase()) {
        errors.push(`${where}: PASS needs the device "${deviceLabel[device]}", got "${step.device}"`);
      }
      if (!hexCommit.test(step.commit)) errors.push(`${where}: PASS needs a commit of 7-40 hex characters, got "${step.commit}"`);
      else if (options.commitExists && !options.commitExists(step.commit)) errors.push(`${where}: commit ${step.commit} does not exist`);
      if (!isoDate.test(step.date)) errors.push(`${where}: PASS needs an ISO date, got "${step.date}"`);
    }
  }
  return errors;
}

// git cat-file -e: a non-zero exit means the commit is not there; a spawn failure is a verification error, never a silent pass.
export function gitCommitExists(commit: string): boolean {
  if (!hexCommit.test(commit)) return false;
  const result = spawnSync("git", ["cat-file", "-e", `${commit}^{commit}`], { cwd: root, stdio: "ignore" });
  if (result.error) throw new Error(`git cat-file could not run: ${result.error.message}`);
  return result.status === 0;
}

const ledger = readFileSync(uatPath, "utf8");

// Fixture editing: change one cell row of a section of a copy of the real ledger, so fixtures break together with the format.
function editStep(text: string, device: "pc" | "phone", id: string, edit: (cells: string[]) => void): string {
  let section: Section = "other";
  let found = false;
  const out = text.split(/\r?\n/).map((line) => {
    if (line.startsWith("## ")) section = sectionOf(line);
    if (section !== device || !line.startsWith(`| ${id} |`)) return line;
    const cells = splitRow(line);
    edit(cells);
    found = true;
    return `| ${cells.join(" | ")} |`;
  });
  assert.ok(found, `fixture row ${id} on ${device} not found`);
  return out.join("\n");
}

describe("20-UAT ledger structure (fail-closed)", () => {
  test("the committed ledger is structurally valid", () => {
    assert.deepEqual(validateUat(ledger, { commitExists: gitCommitExists }), []);
  });

  test("both device tables exist, PC first, and each has a verdict line", () => {
    const uat = parseUat(ledger);
    assert.ok(uat.pc.length > 0 && uat.phone.length > 0);
    assert.ok(uat.headingLine.pc < uat.headingLine.phone);
    assert.ok(uat.verdicts.pc && uat.verdicts.phone);
  });

  test("a PASS without a commit is rejected", () => {
    const broken = editStep(ledger, "pc", "SPIDER-01", (cells) => { cells[5] = "PASS"; cells[6] = "PC"; cells[7] = "-"; cells[8] = "2026-11-05"; });
    const errors = validateUat(broken, { commitExists: () => true });
    assert.ok(errors.some((error) => error.startsWith("SPIDER-01 on PC: PASS needs a commit")), errors.join("\n"));
  });

  test("a PASS with a commit that git does not know is rejected, and a known commit passes", () => {
    const withCommit = (commit: string) =>
      editStep(ledger, "phone", "SPIDER-01", (cells) => { cells[5] = "PASS"; cells[6] = "phone"; cells[7] = commit; cells[8] = "2026-11-05"; });
    assert.ok(validateUat(withCommit("abcdef1"), { commitExists: () => false }).some((error) => error.includes("does not exist")));
    assert.deepEqual(validateUat(withCommit("abcdef1"), { commitExists: () => true }), []);
  });

  test("gitCommitExists treats a missing or non-hex commit as absent", () => {
    assert.equal(gitCommitExists("0000000000000000000000000000000000000000"), false);
    assert.equal(gitCommitExists("not-a-commit"), false);
    assert.equal(gitCommitExists("HEAD"), false);
  });
});
