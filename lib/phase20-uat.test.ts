import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

// Phase 20-27 (pre-builds 20-14 Task 1): fail-closed validation of the owner physical-device UAT ledger (20-UAT.md).
// Default mode checks structure and honest statuses. PORTIA_REQUIRE_UAT=1 (20-14 Task 2 gate) additionally requires final statuses and verdicts.

const root = path.resolve(import.meta.dirname, "..");
const uatPath = path.join(root, ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-UAT.md");
const contextPath = path.join(root, ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-CONTEXT.md");

// D-70 is the owner's refusal of the step-by-step device acceptance, not an acceptance: it is never PASS and PORTIA_REQUIRE_UAT=1 stays red.
// The owner words are copied verbatim from 20-CONTEXT.md D-70 (2026-11-08); the ledger section must repeat them exactly.
export const D70_STEP_STATUS = "НЕ ПРОВЕРЕНО (D-70)";
export const D70_VERDICT = "ПРИНЯТО ВЛАДЕЛЬЦЕМ БЕЗ UAT (D-70)";
export const D70_OWNER_WORDS = "Можно ли сразу перейти к след фазе? ведь меня все устраивает";
export const d70WaivablePrerequisites = ["STAGING-FREE", "REVIEWER-ROLE"];
export const D70_HEADING = "## D-70: принятие риска владельцем без UAT";

export const stepStatuses = ["ОЖИДАЕТ", "PASS", "FAIL", "BLOCKED (ENV)", "BLOCKED (DATA)", "BLOCKED (OWNER)", "BLOCKED (DEVICE)", D70_STEP_STATUS];

export const prerequisiteStatuses = [...stepStatuses, "ОЖИДАЕТ ВЛАДЕЛЬЦА", "ПРИМЕНЕНО ВЛАДЕЛЬЦЕМ"];

const seq = (prefix: string, count: number) => Array.from({ length: count }, (_, i) => `${prefix}${String(i + 1).padStart(2, "0")}`);

// Every id the owner must see, once per place: prerequisites once; `both` on PC and phone; `pcOnly` only on PC; `phoneOnly` only on phone.
export const requiredUatIds = {
  prerequisites: [
    ...Array.from({ length: 8 }, (_, i) => `P19-GAP-${15 + i}`),
    "OWNER-MIG-D36", "OWNER-MIG-NOTES", "STAGING-FREE", "REVIEWER-ROLE", "VISUAL-APPROVED", "RELEASE-GATE",
  ],
  both: [
    ...seq("SPIDER-", 3), ...seq("CLASS-", 4), "SEARCH-01", "SEARCH-03", ...seq("EDITOR-", 4), "EDITOR-FRAMING-01", "EDITOR-INFO-ADD-01", ...seq("REG-", 7), ...seq("PROMO-", 5),
    "TMPL-01", "WIN-01", "QUAL-LOCK-01", "WALL-01", "SVG-01", "SHORTCUT-01", "VIVIAN-01", "MOTION-01", "MEDIA-01", "A11Y-SR-01",
  ],
  pcOnly: ["INFO-PC-01", "SEARCH-02", "A11Y-KEY-01", "A11Y-CONTRAST-D10"],
  phoneOnly: [...seq("INFO-PHONE-", 5), "A11Y-TOUCH-01"],
};

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
  hasD70: boolean;
  d70: Record<string, string>;
  problems: string[];
};

export type Section = "prereq" | "pc" | "phone" | "verdicts" | "d15" | "d70" | "other";

export function sectionOf(heading: string): Section {
  if (/^## Prerequisites\b/.test(heading)) return "prereq";
  if (/^## Чек-лист PC\b/.test(heading)) return "pc";
  if (/^## Чек-лист phone\b/.test(heading)) return "phone";
  if (/^## Вердикты(\s|$)/.test(heading)) return "verdicts";
  if (/^## D-15\b/.test(heading)) return "d15";
  if (/^## D-70\b/.test(heading)) return "d70";
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
    verdicts: { pc: null, phone: null }, d15: {}, hasD70: false, d70: {}, problems: [],
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
      if (section === "d70") uat.hasD70 = true;
      continue;
    }
    if (section === "verdicts") {
      const verdict = line.match(/^Вердикт (PC|phone): (.+)$/);
      if (verdict) uat.verdicts[verdict[1] === "PC" ? "pc" : "phone"] = parseVerdict(verdict[2].trim());
      continue;
    }
    if (section === "d15" || section === "d70") {
      const field = line.match(/^- ([^:]+):\s*(.*)$/);
      if (field) uat[section][field[1].trim()] = field[2].trim();
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
const d15Labels = ["Изменение между коммитами", "Основание сохранения PC-вердикта", "Полный повтор phone"];
const sameCommit = (a: string, b: string) => hexCommit.test(a) && hexCommit.test(b) && (a.startsWith(b) || b.startsWith(a));
const isBlocked = (status: string) => status.startsWith("BLOCKED");
const prerequisiteSatisfied = (status: string) => status === "PASS" || status === "ПРИМЕНЕНО ВЛАДЕЛЬЦЕМ";

const hexCommit40 = /\b[0-9a-f]{40}\b/;
const namesD70 = (note: string) => note.includes("D-70");

function validatePrerequisites(uat: Uat, complete: boolean, errors: string[]): Map<string, Prerequisite> {
  const byId = new Map<string, Prerequisite>();
  for (const row of uat.prerequisites) {
    if (byId.has(row.id)) errors.push(`duplicate ${row.id} in prerequisites`);
    else byId.set(row.id, row);
  }
  for (const id of requiredUatIds.prerequisites) if (!byId.has(id)) errors.push(`missing ${id} on prerequisites`);

  for (const row of uat.prerequisites) {
    if (!prerequisiteStatuses.includes(row.status)) { errors.push(`${row.id}: unknown status "${row.status}"`); continue; }
    const ownerMigration = row.id.startsWith("OWNER-MIG-");
    if (ownerMigration && row.status === "PASS") {
      // D-36, D-47: production is applied by the owner only; an agent PASS here would be an unverifiable claim.
      errors.push(`${row.id}: an owner migration row cannot be PASS (the owner records ПРИМЕНЕНО ВЛАДЕЛЬЦЕМ with date and method)`);
    } else if (row.status === "PASS" && !isoDate.test(row.date)) {
      errors.push(`${row.id}: PASS needs an ISO date`);
    }
    if (row.status === "ПРИМЕНЕНО ВЛАДЕЛЬЦЕМ") {
      if (!ownerMigration) errors.push(`${row.id}: ПРИМЕНЕНО ВЛАДЕЛЬЦЕМ is only for the OWNER-MIG rows`);
      else if (!isoDate.test(row.date) || empty(row.note)) errors.push(`${row.id}: applied needs the owner date and method`);
    }
    if (isBlocked(row.status) && empty(row.note)) errors.push(`${row.id}: BLOCKED needs a reason`);
    if (row.status === "FAIL" && empty(row.note)) errors.push(`${row.id}: FAIL needs a note`);
    if (row.status === D70_STEP_STATUS) {
      // D-70 (5): evidence rows and owner migrations are not cancelled by the owner's refusal of the step-by-step acceptance.
      if (!d70WaivablePrerequisites.includes(row.id)) errors.push(`${row.id}: ${D70_STEP_STATUS} is only for ${d70WaivablePrerequisites.join(" and ")} (D-70 (5))`);
      if (!uat.hasD70) errors.push(`${row.id}: ${D70_STEP_STATUS} needs the D-70 section ("${D70_HEADING}")`);
      if (!empty(row.date)) errors.push(`${row.id}: ${D70_STEP_STATUS} must have no date`);
      if (!namesD70(row.note)) errors.push(`${row.id}: ${D70_STEP_STATUS} needs a note that names D-70`);
      if (complete) errors.push(`${row.id}: ${D70_STEP_STATUS} is not acceptance (PORTIA_REQUIRE_UAT=1 needs a real PASS)`);
    }
    if (complete) {
      if (row.status === "ОЖИДАЕТ") errors.push(`${row.id}: is still ОЖИДАЕТ`);
      if (row.status === "ОЖИДАЕТ ВЛАДЕЛЬЦА" && !ownerMigration) errors.push(`${row.id}: is still ОЖИДАЕТ ВЛАДЕЛЬЦА`);
    }
  }
  if (complete && byId.has("RELEASE-GATE") && byId.get("RELEASE-GATE")!.status !== "PASS") {
    errors.push("RELEASE-GATE must be PASS before the owner verdicts count (20-13 gate on the release commit)");
  }
  return byId;
}

function validateSteps(
  uat: Uat, device: "pc" | "phone", prerequisites: Map<string, Prerequisite>, complete: boolean, commitExists: (commit: string) => boolean, errors: string[],
) {
  const label = deviceLabel[device];
  const required = device === "pc" ? [...requiredUatIds.both, ...requiredUatIds.pcOnly] : [...requiredUatIds.both, ...requiredUatIds.phoneOnly];
  const foreign = device === "pc" ? requiredUatIds.phoneOnly : requiredUatIds.pcOnly;
  const seen = new Set<string>();
  for (const step of uat[device]) {
    const where = `${step.id} on ${label}`;
    if (seen.has(step.id)) errors.push(`duplicate ${step.id} on ${label}`);
    seen.add(step.id);
    if (foreign.includes(step.id)) errors.push(`${step.id} must not be on ${label}`);

    const dependencies = step.dependsOn.split(/\s*[,;]\s*/).filter((dep) => dep !== "" && dep !== "-");
    for (const dep of dependencies) if (!prerequisites.has(dep)) errors.push(`${where}: unknown prerequisite ${dep}`);
    if (!stepStatuses.includes(step.status)) { errors.push(`${where}: unknown status "${step.status}"`); continue; }

    if (step.status === D70_STEP_STATUS) {
      if (!uat.hasD70) errors.push(`${where}: ${D70_STEP_STATUS} needs the D-70 section ("${D70_HEADING}")`);
      if (!empty(step.commit)) errors.push(`${where}: ${D70_STEP_STATUS} must not name a tested commit (the step was not run)`);
      if (!empty(step.device)) errors.push(`${where}: ${D70_STEP_STATUS} must have no device`);
      if (!empty(step.date)) errors.push(`${where}: ${D70_STEP_STATUS} must have no date`);
      if (!empty(step.screenshot)) errors.push(`${where}: ${D70_STEP_STATUS} must have no screenshot`);
      if (!namesD70(step.note)) errors.push(`${where}: ${D70_STEP_STATUS} needs a note that names D-70`);
      for (const dep of dependencies) {
        const prerequisite = prerequisites.get(dep);
        if (prerequisite && isBlocked(prerequisite.status)) errors.push(`${where}: ${D70_STEP_STATUS} but prerequisite ${dep} is ${prerequisite.status}: the step stays BLOCKED (D-16)`);
      }
      if (complete) errors.push(`${where}: ${D70_STEP_STATUS} is not acceptance (PORTIA_REQUIRE_UAT=1 needs a real PASS)`);
      continue;
    }
    if (step.status === "ОЖИДАЕТ" && complete) errors.push(`${where}: is still ОЖИДАЕТ`);
    if (isBlocked(step.status) && empty(step.note)) errors.push(`${where}: BLOCKED needs a reason`);
    if (step.status === "FAIL") {
      if (empty(step.note)) errors.push(`${where}: FAIL needs a note`);
      if (empty(step.screenshot)) errors.push(`${where}: FAIL needs a screenshot`);
      if (complete && !hexCommit.test(step.commit)) errors.push(`${where}: FAIL needs the tested commit`);
    }
    if (step.status !== "PASS") continue;

    if (step.device.toLowerCase() !== label.toLowerCase()) errors.push(`${where}: PASS needs the device "${label}", got "${step.device}"`);
    if (!hexCommit.test(step.commit)) errors.push(`${where}: PASS needs a commit of 7-40 hex characters, got "${step.commit}"`);
    else if (!commitExists(step.commit)) errors.push(`${where}: commit ${step.commit} does not exist`);
    if (!isoDate.test(step.date)) errors.push(`${where}: PASS needs an ISO date, got "${step.date}"`);
    for (const dep of dependencies) {
      const prerequisite = prerequisites.get(dep);
      if (prerequisite && !prerequisiteSatisfied(prerequisite.status)) errors.push(`${where}: PASS depends on ${dep} which is ${prerequisite.status}`);
    }
  }
  for (const id of required) if (!seen.has(id)) errors.push(`missing ${id} on ${label}`);
}

function validateVerdicts(uat: Uat, commitExists: (commit: string) => boolean, complete: boolean, errors: string[]) {
  for (const device of ["pc", "phone"] as const) {
    const label = deviceLabel[device];
    const verdict = uat.verdicts[device];
    if (!verdict) continue; // the missing line is reported with the structure
    if (verdict.status === "ОЖИДАЕТ") {
      if (complete) errors.push(`${label} verdict is still ОЖИДАЕТ`);
      continue;
    }
    if (verdict.status === D70_VERDICT) {
      if (!uat.hasD70) errors.push(`${label} verdict ${D70_VERDICT} needs the D-70 section ("${D70_HEADING}")`);
      if (/\(commit /.test(verdict.raw)) errors.push(`${label} verdict ${D70_VERDICT} must not carry a commit (no device was accepted)`);
      for (const step of uat[device]) {
        if (step.status === "PASS" || step.status === "ОЖИДАЕТ") errors.push(`${label} verdict is ${D70_VERDICT} but ${step.id} is ${step.status}`);
      }
      if (complete) errors.push(`${label} verdict ${D70_VERDICT} is not acceptance (PORTIA_REQUIRE_UAT=1 needs PASS)`);
      continue;
    }
    if (uat.hasD70 && (verdict.status === "PASS" || verdict.status === "FAIL")) {
      errors.push(`${label} verdict is ${verdict.status} next to the D-70 section: the owner's waiver and a device verdict exclude each other`);
    }
    if ((verdict.status !== "PASS" && verdict.status !== "FAIL") || !hexCommit.test(verdict.commit)) {
      errors.push(`${label} verdict needs "PASS (commit <hex>)" or "FAIL (commit <hex>)", got "${verdict.raw}"`);
      continue;
    }
    if (!commitExists(verdict.commit)) errors.push(`${label} verdict commit ${verdict.commit} does not exist`);
    for (const step of uat[device]) {
      if (verdict.status === "PASS" && step.status !== "PASS") errors.push(`${label} verdict is PASS but ${step.id} is ${step.status}`);
      // The verdict is bound to the commit the steps were run on; D-15 is the only way two devices differ.
      if ((step.status === "PASS" || step.status === "FAIL") && hexCommit.test(step.commit) && !sameCommit(step.commit, verdict.commit)) {
        errors.push(`${step.id} on ${label}: commit ${step.commit} differs from the ${label} verdict commit ${verdict.commit}`);
      }
    }
  }

  const pc = uat.verdicts.pc;
  const phone = uat.verdicts.phone;
  if (pc && phone && hexCommit.test(pc.commit) && hexCommit.test(phone.commit) && !sameCommit(pc.commit, phone.commit)) {
    for (const label of d15Labels) {
      const value = uat.d15[label] ?? "";
      if (empty(value) || /^не требуется/i.test(value)) errors.push(`D-15: "${label}" must be filled when the PC and phone commits differ`);
    }
  }
}

const d70Field = (d70: Record<string, string>, labelStart: string) => {
  const key = Object.keys(d70).find((name) => name.startsWith(labelStart));
  return key === undefined ? undefined : d70[key];
};
const stripQuotes = (value: string) => value.replace(/[«»"'\s]/g, "");

// The D-70 section is the only place with the owner's words; it is checked whenever it exists.
function validateD70(uat: Uat, commitExists: (commit: string) => boolean, errors: string[]) {
  if (!uat.hasD70) return;
  const need = (labelStart: string): string | null => {
    const value = d70Field(uat.d70, labelStart);
    if (value === undefined) { errors.push(`D-70: field "${labelStart}" is missing`); return null; }
    return value;
  };
  const date = need("Дата");
  if (date !== null && !isoDate.test(date)) errors.push(`D-70: "Дата" must be an ISO date, got "${date}"`);
  const words = need("Слова владельца");
  if (words !== null && !words.includes(D70_OWNER_WORDS)) errors.push('D-70: "Слова владельца" must contain the owner words verbatim (20-CONTEXT.md D-70)');
  const answer = need("Ответ владельца");
  if (answer !== null && stripQuotes(answer) !== "2") errors.push(`D-70: "Ответ владельца" must be «2», got "${answer}"`);
  const variant = need("Текст варианта 2");
  if (variant !== null && stripQuotes(variant).replace(/^-$/, "") === "") errors.push('D-70: "Текст варианта 2" is empty');
  const decision = need("Запись решения");
  if (decision !== null) {
    const commit = decision.match(hexCommit40)?.[0];
    if (!commit) errors.push('D-70: "Запись решения" needs the 40-hex commit of the decision record');
    else if (!commitExists(commit)) errors.push(`D-70: decision commit ${commit} does not exist`);
  }
  const release = need("Release commit");
  if (release !== null) {
    const commit = release.match(hexCommit40)?.[0];
    if (!commit) errors.push('D-70: "Release commit" needs a 40-hex commit');
    else {
      if (!commitExists(commit)) errors.push(`D-70: Release commit ${commit} does not exist`);
      const frontmatter = uat.frontmatter.release_candidate_commit ?? "";
      if (!hexCommit.test(frontmatter) || !sameCommit(commit, frontmatter)) {
        errors.push(`D-70: Release commit ${commit} is not release_candidate_commit "${frontmatter}"`);
      }
    }
  }
  const product = need("Код продукта после записи");
  if (product !== null && !product.startsWith("НЕ ИЗМЕНЁН")) {
    errors.push('D-70: "Код продукта после записи D-70" must start with НЕ ИЗМЕНЁН (the owner words do not cover changed product code)');
  }
}

export function validateUat(text: string, options: UatOptions = {}): string[] {
  const errors: string[] = [];
  const uat = parseUat(text);
  const complete = options.requireComplete === true;
  const commitExists = (commit: string) => !options.commitExists || options.commitExists(commit);
  errors.push(...uat.problems);

  if (uat.frontmatter.artifact !== "uat-ledger") errors.push('frontmatter artifact must be "uat-ledger"');
  if (uat.headingLine.pc < 0) errors.push("the PC checklist table is missing");
  if (uat.headingLine.phone < 0) errors.push("the phone checklist table is missing");
  if (uat.headingLine.pc >= 0 && uat.headingLine.phone >= 0 && uat.headingLine.phone < uat.headingLine.pc) {
    errors.push("PC must come before phone (D-13)");
  }
  if (!uat.verdicts.pc) errors.push("the PC verdict line is missing");
  if (!uat.verdicts.phone) errors.push("the phone verdict line is missing");

  const prerequisites = validatePrerequisites(uat, complete, errors);
  validateSteps(uat, "pc", prerequisites, complete, commitExists, errors);
  validateSteps(uat, "phone", prerequisites, complete, commitExists, errors);
  validateVerdicts(uat, commitExists, complete, errors);
  validateD70(uat, commitExists, errors);

  if (complete) {
    const release = uat.frontmatter.release_candidate_commit ?? "";
    const phoneCommit = uat.verdicts.phone?.commit ?? "";
    if (!hexCommit.test(release)) errors.push(`release_candidate_commit must be a 7-40 hex commit, got "${release}"`);
    else {
      if (!commitExists(release)) errors.push(`release_candidate_commit ${release} does not exist`);
      if (hexCommit.test(phoneCommit) && !sameCommit(release, phoneCommit)) {
        errors.push(`release_candidate_commit ${release} is not the phone verdict commit ${phoneCommit}`);
      }
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
// PORTIA_REQUIRE_UAT=1 is the 20-14 Task 2 owner gate: the real ledger must then be final, not just well-formed.
const strict = process.env.PORTIA_REQUIRE_UAT === "1";

type Table = "prereq" | "pc" | "phone";
const isTable = (section: Section): section is Table => section === "prereq" || section === "pc" || section === "phone";

// Fixture editing on a copy of the real ledger, so fixtures break together with the format. `undefined` keeps the row, `null` drops it.
function mapRows(text: string, fn: (section: Table, cells: string[]) => string[] | null | undefined): string {
  let section: Section = "other";
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("## ")) section = sectionOf(line);
    if (!isTable(section) || !line.startsWith("|")) { out.push(line); continue; }
    const cells = splitRow(line);
    if (isHeaderOrSeparator(cells)) { out.push(line); continue; }
    const next = fn(section, cells);
    if (next === null) continue;
    out.push(next === undefined ? line : `| ${next.join(" | ")} |`);
  }
  return out.join("\n");
}

function editRow(text: string, table: Table, id: string, edit: (cells: string[]) => void): string {
  let found = false;
  const out = mapRows(text, (section, cells) => {
    if (section !== table || cells[0] !== id) return undefined;
    found = true;
    edit(cells);
    return cells;
  });
  assert.ok(found, `fixture row ${id} in ${table} not found`);
  return out;
}

const dropRow = (text: string, table: Table, id: string) => mapRows(text, (section, cells) => (section === table && cells[0] === id ? null : undefined));
const duplicateRow = (text: string, table: Table, id: string) => {
  const out: string[] = [];
  let section: Section = "other";
  let done = false;
  for (const raw of text.split(/\r?\n/)) {
    if (raw.startsWith("## ")) section = sectionOf(raw);
    out.push(raw);
    if (!done && section === table && raw.startsWith(`| ${id} |`)) { out.push(raw); done = true; }
  }
  assert.ok(done, `fixture row ${id} in ${table} not found`);
  return out.join("\n");
};

const stepDevice = { pc: "PC", phone: "phone" } as const;
type Commits = { pc: string; phone: string };

const D70_FIXTURE_RELEASE = "f49aa00f2b9833f962fa3fa890117e98a4abf362";
const D70_FIXTURE_DECISION = "03e890a0135ff20f02b4ab68fe39642fff84c39f";
// Drops the D-70 section (up to the next `## ` heading or the end of the text).
const removeD70Section = (text: string) => text.replace(/^## D-70\b[\s\S]*?(?=^## |(?![\s\S]))/m, "");

// The real ledger with every step, verdict and the four evidence prerequisites back to ОЖИДАЕТ and no D-70 section: the baseline for "unfilled ledger" fixtures.
function pendingLedger(text: string): string {
  const pendingPrerequisites = ["STAGING-FREE", "REVIEWER-ROLE", "VISUAL-APPROVED", "RELEASE-GATE"];
  let out = mapRows(removeD70Section(text), (section, cells) => {
    if (section === "prereq") {
      if (!pendingPrerequisites.includes(cells[0])) return undefined;
      cells[3] = "ОЖИДАЕТ"; cells[4] = "-";
      return cells;
    }
    cells[5] = "ОЖИДАЕТ"; cells[6] = "-"; cells[7] = "-"; cells[8] = "-"; cells[9] = "-"; cells[10] = "-";
    return cells;
  });
  out = out.replace(/^status:.*$/m, "status: awaiting-owner");
  out = out.replace(/^release_candidate_commit:.*$/m, "release_candidate_commit: ОЖИДАЕТ 20-13");
  out = out.replace(/^Вердикт PC: .*$/m, "Вердикт PC: ОЖИДАЕТ");
  out = out.replace(/^Вердикт phone: .*$/m, "Вердикт phone: ОЖИДАЕТ");
  return out;
}

function d70Section(releaseCommit: string): string {
  return [
    D70_HEADING,
    "",
    "- Дата: 2026-11-08",
    `- Слова владельца (дословно): «${D70_OWNER_WORDS}»`,
    "- Ответ владельца на варианты (дословно): «2»",
    "- Текст варианта 2, показанный владельцу (слова оркестратора, не владельца): «Сократить 20-14. Я записываю это как «принято владельцем без UAT», а не как PASS.»",
    `- Запись решения: 20-CONTEXT.md D-70, commit ${D70_FIXTURE_DECISION}`,
    `- Release commit: ${releaseCommit} (20-63-SUMMARY.md, 20-RELEASE-EVIDENCE.md)`,
    `- Код продукта после записи D-70: НЕ ИЗМЕНЁН (git diff ${D70_FIXTURE_DECISION.slice(0, 12)}..${releaseCommit.slice(0, 12)} по app, components, public, lib без *.test.*)`,
    "- Что это значит: шаги не проходились; ни один шаг и ни один вердикт не получает PASS; PORTIA_REQUIRE_UAT=1 остаётся красным",
    "",
  ].join("\n");
}

// Replaces the value of one `- Поле: значение` line of the D-70 section; the field is found by the start of its label.
function setD70Field(text: string, labelStart: string, value: string): string {
  let found = false;
  const out = text.split(/\r?\n/).map((line) => {
    if (found || !line.startsWith(`- ${labelStart}`)) return line;
    found = true;
    return `${line.slice(0, line.indexOf(":"))}: ${value}`;
  });
  assert.ok(found, `fixture D-70 field ${labelStart} not found`);
  return out.join("\n");
}

const dropD70Field = (text: string, labelStart: string) => text.split(/\r?\n/).filter((line) => !line.startsWith(`- ${labelStart}`)).join("\n");

type WaivedOptions = { releaseCommit?: string; reviewerRole?: "blocked" | "d70" };

// A ledger as 20-14 records it: D-70 section, steps НЕ ПРОВЕРЕНО (D-70) or BLOCKED (when a prerequisite is BLOCKED), both verdicts D-70.
function waivedLedger(text: string, options: WaivedOptions = {}): string {
  const release = options.releaseCommit ?? D70_FIXTURE_RELEASE;
  const reviewer = options.reviewerRole ?? "blocked";
  let out = mapRows(pendingLedger(text), (section, cells) => {
    if (section !== "prereq") return undefined;
    if (cells[0] === "STAGING-FREE") {
      cells[3] = D70_STEP_STATUS; cells[4] = "-"; cells[5] = "D-70: подтверждение владельца не запрашивалось; проверки с мутациями на staging не проводились";
    } else if (cells[0] === "REVIEWER-ROLE") {
      if (reviewer === "blocked") { cells[3] = "BLOCKED (ENV)"; cells[4] = "-"; cells[5] = "нет аттестованного staging проверяющего (20-RELEASE-EVIDENCE.md)"; }
      else { cells[3] = D70_STEP_STATUS; cells[4] = "-"; cells[5] = "D-70: подтверждение владельца не запрашивалось; проверки с мутациями на staging не проводились"; }
    } else if (cells[0] === "VISUAL-APPROVED") {
      cells[3] = "PASS"; cells[4] = "2026-11-08"; cells[5] = "общий вердикт владельца на 0c2a59d1d1a7 (D-68)";
    } else if (cells[0] === "RELEASE-GATE") {
      cells[3] = "BLOCKED (ENV)"; cells[4] = "-"; cells[5] = "итог раннера BLOCKED: полосы среды без цели и staging";
    } else return undefined;
    return cells;
  });
  const prerequisiteStatus = new Map(parseUat(out).prerequisites.map((row) => [row.id, row.status]));
  out = mapRows(out, (section, cells) => {
    if (section === "prereq") return undefined;
    const dependencies = cells[4].split(/\s*[,;]\s*/).filter((dep) => dep !== "" && dep !== "-");
    const blocked = dependencies.map((dep) => ({ dep, status: prerequisiteStatus.get(dep) ?? "" })).find((entry) => entry.status.startsWith("BLOCKED"));
    cells[6] = "-"; cells[7] = "-"; cells[8] = "-"; cells[10] = "-";
    if (blocked) { cells[5] = blocked.status; cells[9] = `prerequisite ${blocked.dep} — ${blocked.status}; D-70: шаг не проходился`; }
    else { cells[5] = D70_STEP_STATUS; cells[9] = "D-70: шаг не проходился, риск принят владельцем"; }
    return cells;
  });
  out = out.replace(/^status:.*$/m, "status: accepted-risk-d70");
  out = out.replace(/^release_candidate_commit:.*$/m, `release_candidate_commit: ${release}`);
  out = out.replace(/^Вердикт PC: .*$/m, `Вердикт PC: ${D70_VERDICT}`);
  out = out.replace(/^Вердикт phone: .*$/m, `Вердикт phone: ${D70_VERDICT}`);
  return `${out.replace(/\s*$/, "")}\n\n${d70Section(release)}`;
}

// A fully filled, consistent ledger (every prerequisite satisfied, every step PASS, two PASS verdicts); the baseline for negative fixtures.
function completeLedger(text: string, commits: Commits = { pc: "abcdef1", phone: "abcdef1" }): string {
  let out = mapRows(removeD70Section(text), (section, cells) => {
    if (section === "prereq") {
      cells[3] = cells[0].startsWith("OWNER-MIG-") ? "ПРИМЕНЕНО ВЛАДЕЛЬЦЕМ" : "PASS";
      cells[4] = "2026-11-05";
      if (empty(cells[5])) cells[5] = "проверено владельцем";
      return cells;
    }
    cells[5] = "PASS"; cells[6] = stepDevice[section]; cells[7] = commits[section]; cells[8] = "2026-11-05"; cells[9] = "проверено владельцем";
    return cells;
  });
  out = out.replace(/^release_candidate_commit:.*$/m, `release_candidate_commit: ${commits.phone}`);
  out = out.replace(/^Вердикт PC: .*$/m, `Вердикт PC: PASS (commit ${commits.pc})`);
  out = out.replace(/^Вердикт phone: .*$/m, `Вердикт phone: PASS (commit ${commits.phone})`);
  if (commits.pc !== commits.phone) {
    out = out.replace(/^- Изменение между коммитами:.*$/m, "- Изменение между коммитами: исправлен только стиль кнопки на телефоне")
      .replace(/^- Основание сохранения PC-вердикта:.*$/m, "- Основание сохранения PC-вердикта: изменение затрагивает только phone-раскладку, PC-код не менялся")
      .replace(/^- Полный повтор phone:.*$/m, `- Полный повтор phone: весь phone-чек-лист повторён на ${commits.phone}`);
  }
  return out;
}

const withVerdict = (text: string, device: "PC" | "phone", value: string) =>
  text.replace(new RegExp(`^Вердикт ${device}: .*$`, "m"), `Вердикт ${device}: ${value}`);
const allKnown = () => true;
const noCommit = () => false;
const errorsOf = (text: string, options: UatOptions = {}) => validateUat(text, { commitExists: allKnown, ...options });

describe("20-UAT ledger structure (fail-closed)", () => {
  test("the committed ledger is structurally valid (and final when PORTIA_REQUIRE_UAT=1)", () => {
    assert.deepEqual(validateUat(ledger, { commitExists: gitCommitExists, requireComplete: strict }), []);
  });

  test("both device tables exist, PC first, and each has a verdict line", () => {
    const uat = parseUat(ledger);
    assert.ok(uat.pc.length > 0 && uat.phone.length > 0);
    assert.ok(uat.headingLine.pc < uat.headingLine.phone);
    assert.ok(uat.verdicts.pc && uat.verdicts.phone);
  });

  test("a PASS without a commit is rejected", () => {
    const broken = editRow(ledger, "pc", "SPIDER-01", (cells) => { cells[5] = "PASS"; cells[6] = "PC"; cells[7] = "-"; cells[8] = "2026-11-05"; });
    const errors = errorsOf(broken);
    assert.ok(errors.some((error) => error.startsWith("SPIDER-01 on PC: PASS needs a commit")), errors.join("\n"));
  });

  test("a PASS with a commit that git does not know is rejected, and a known commit passes", () => {
    const withCommit = (commit: string) =>
      editRow(pendingLedger(ledger), "phone", "SPIDER-01", (cells) => { cells[5] = "PASS"; cells[6] = "phone"; cells[7] = commit; cells[8] = "2026-11-05"; });
    assert.ok(errorsOf(withCommit("abcdef1"), { commitExists: noCommit }).some((error) => error.includes("does not exist")));
    // SPIDER-01 depends on VISUAL-APPROVED, which is still pending in the real ledger, so a lone PASS is rejected for that reason only.
    assert.deepEqual(errorsOf(withCommit("abcdef1")).filter((error) => !error.includes("depends on")), []);
  });

  test("gitCommitExists treats a missing or non-hex commit as absent", () => {
    assert.equal(gitCommitExists("0000000000000000000000000000000000000000"), false);
    assert.equal(gitCommitExists("not-a-commit"), false);
    assert.equal(gitCommitExists("HEAD"), false);
  });
});

describe("20-UAT required ids (D-34, D-28..D-47, plan 20-14 Task 1)", () => {
  const ids = requiredUatIds;
  test("the id lists have the planned size and no overlaps", () => {
    assert.equal(ids.prerequisites.length, 14);
    assert.equal(new Set([...ids.both, ...ids.pcOnly, ...ids.phoneOnly]).size, ids.both.length + ids.pcOnly.length + ids.phoneOnly.length);
    for (const id of ["QUAL-LOCK-01", "EDITOR-03", "A11Y-CONTRAST-D10", "OWNER-MIG-NOTES", "INFO-PHONE-05", "SEARCH-02"]) {
      assert.ok([...ids.prerequisites, ...ids.both, ...ids.pcOnly, ...ids.phoneOnly].includes(id), `${id} is not required`);
    }
  });

  test("dropping any required id, on each device where it belongs, is rejected", () => {
    for (const id of ids.prerequisites) {
      assert.ok(errorsOf(dropRow(ledger, "prereq", id)).includes(`missing ${id} on prerequisites`), `${id} not enforced`);
    }
    for (const id of [...ids.both, ...ids.pcOnly]) {
      assert.ok(errorsOf(dropRow(ledger, "pc", id)).includes(`missing ${id} on PC`), `${id} not enforced on PC`);
    }
    for (const id of [...ids.both, ...ids.phoneOnly]) {
      assert.ok(errorsOf(dropRow(ledger, "phone", id)).includes(`missing ${id} on phone`), `${id} not enforced on phone`);
    }
  });

  test("every required id is present in the committed ledger exactly once per place", () => {
    const uat = parseUat(ledger);
    for (const id of ids.prerequisites) assert.equal(uat.prerequisites.filter((row) => row.id === id).length, 1, id);
    for (const id of [...ids.both, ...ids.pcOnly]) assert.equal(uat.pc.filter((row) => row.id === id).length, 1, `${id} on PC`);
    for (const id of [...ids.both, ...ids.phoneOnly]) assert.equal(uat.phone.filter((row) => row.id === id).length, 1, `${id} on phone`);
  });

  test("a duplicate id on a device or in prerequisites is rejected", () => {
    assert.ok(errorsOf(duplicateRow(ledger, "pc", "REG-03")).some((error) => error.includes("duplicate REG-03 on PC")));
    assert.ok(errorsOf(duplicateRow(ledger, "prereq", "STAGING-FREE")).some((error) => error.includes("duplicate STAGING-FREE")));
  });

  test("device-only steps on the wrong device are rejected", () => {
    const phoneStep = parseUat(ledger).phone.find((row) => row.id === "INFO-PHONE-01")!;
    const inPc = ledger.replace("## Чек-лист phone", `${`| ${Object.values(phoneStep).join(" | ")} |`}\n\n## Чек-лист phone`);
    assert.ok(errorsOf(inPc).some((error) => error.includes("INFO-PHONE-01 must not be on PC")));
    const pcStep = parseUat(ledger).pc.find((row) => row.id === "SEARCH-02")!;
    const inPhone = ledger.replace("## Вердикты", `| ${Object.values(pcStep).join(" | ")} |\n\n## Вердикты`);
    assert.ok(errorsOf(inPhone).some((error) => error.includes("SEARCH-02 must not be on phone")));
  });

  test("D-13: the phone table before the PC table is rejected", () => {
    const pcAt = ledger.indexOf("## Чек-лист PC");
    const phoneAt = ledger.indexOf("## Чек-лист phone");
    const verdictsAt = ledger.indexOf("## Вердикты");
    const swapped = ledger.slice(0, pcAt) + ledger.slice(phoneAt, verdictsAt) + ledger.slice(pcAt, phoneAt) + ledger.slice(verdictsAt);
    assert.ok(errorsOf(swapped).includes("PC must come before phone (D-13)"));
  });

  test("the two behavior-unverified items are written out as steps on both devices", () => {
    const uat = parseUat(ledger);
    for (const rows of [uat.pc, uat.phone]) {
      const qual = rows.find((row) => row.id === "QUAL-LOCK-01")!;
      assert.match(qual.expected, /Tab/);
      assert.match(qual.expected, /фокус возвращается/);
      const editor = rows.find((row) => row.id === "EDITOR-03")!;
      assert.match(editor.expected, /границ[уы]? колонки/);
      assert.match(editor.expected, /фокус остаётся на той же ручке/);
      assert.match(editor.expected, /одна отмена/);
    }
  });
});

describe("20-UAT honest statuses (T-20-41)", () => {
  test("the baseline fully filled fixture passes strict validation", () => {
    assert.deepEqual(errorsOf(completeLedger(ledger), { requireComplete: true }), []);
  });

  test("an unknown status is rejected in steps and prerequisites", () => {
    assert.ok(errorsOf(editRow(ledger, "pc", "REG-01", (cells) => { cells[5] = "OK"; })).some((error) => error.includes('REG-01 on PC: unknown status "OK"')));
    assert.ok(errorsOf(editRow(ledger, "prereq", "RELEASE-GATE", (cells) => { cells[3] = "готово"; })).some((error) => error.includes("RELEASE-GATE: unknown status")));
  });

  test("a PASS on the wrong device column or without a date is rejected", () => {
    const base = completeLedger(ledger);
    assert.ok(errorsOf(editRow(base, "phone", "REG-01", (cells) => { cells[6] = "PC"; })).some((error) => error.includes('REG-01 on phone: PASS needs the device "phone"')));
    assert.ok(errorsOf(editRow(base, "pc", "REG-01", (cells) => { cells[8] = "-"; })).some((error) => error.includes("REG-01 on PC: PASS needs an ISO date")));
  });

  test("FAIL needs a note and a screenshot; BLOCKED needs a reason", () => {
    const base = completeLedger(ledger);
    const fail = (note: string, shot: string) => editRow(base, "pc", "REG-02", (cells) => { cells[5] = "FAIL"; cells[9] = note; cells[10] = shot; });
    assert.ok(errorsOf(fail("-", "ui/shot.png")).some((error) => error.includes("REG-02 on PC: FAIL needs a note")));
    assert.ok(errorsOf(fail("кнопка не нажимается", "-")).some((error) => error.includes("REG-02 on PC: FAIL needs a screenshot")));
    const blocked = (note: string) => editRow(base, "phone", "A11Y-SR-01", (cells) => { cells[5] = "BLOCKED (DEVICE)"; cells[9] = note; });
    assert.ok(errorsOf(blocked("-")).some((error) => error.includes("A11Y-SR-01 on phone: BLOCKED needs a reason")));
    assert.ok(!errorsOf(blocked("на телефоне нет экранного диктора")).some((error) => error.includes("A11Y-SR-01 on phone: BLOCKED")));
  });

  test("a PASS step cannot depend on a prerequisite that is not PASS (D-34)", () => {
    const base = completeLedger(ledger);
    const broken = editRow(base, "prereq", "REVIEWER-ROLE", (cells) => { cells[3] = "BLOCKED (ENV)"; cells[4] = "-"; cells[5] = "нет роли на staging"; });
    const errors = errorsOf(broken);
    assert.ok(errors.some((error) => error.startsWith("PROMO-03 on PC: PASS depends on REVIEWER-ROLE")), errors.join("\n"));
    assert.ok(errors.some((error) => error.startsWith("PROMO-03 on phone: PASS depends on REVIEWER-ROLE")));
  });

  test("a step that depends on a prerequisite which is not in the table is rejected", () => {
    const broken = editRow(ledger, "pc", "REG-01", (cells) => { cells[4] = "NO-SUCH-PREREQ"; });
    assert.ok(errorsOf(broken).some((error) => error.includes("REG-01 on PC: unknown prerequisite NO-SUCH-PREREQ")));
  });

  test("OWNER-MIG-D36 and OWNER-MIG-NOTES are never an agent PASS (D-36, D-47)", () => {
    for (const id of ["OWNER-MIG-D36", "OWNER-MIG-NOTES"]) {
      const broken = editRow(ledger, "prereq", id, (cells) => { cells[3] = "PASS"; cells[4] = "2026-11-05"; cells[5] = "применено"; });
      assert.ok(errorsOf(broken).some((error) => error.startsWith(`${id}: an owner migration row cannot be PASS`)), id);
    }
  });

  test("OWNER-MIG rows: applied needs the owner date and method; waiting and BLOCKED are allowed", () => {
    const set = (status: string, date: string, note: string) => editRow(ledger, "prereq", "OWNER-MIG-D36", (cells) => { cells[3] = status; cells[4] = date; cells[5] = note; });
    assert.deepEqual(errorsOf(set("ПРИМЕНЕНО ВЛАДЕЛЬЦЕМ", "2026-11-06", "SQL Editor, владелец")), []);
    assert.ok(errorsOf(set("ПРИМЕНЕНО ВЛАДЕЛЬЦЕМ", "-", "SQL Editor")).some((error) => error.startsWith("OWNER-MIG-D36: applied needs")));
    assert.ok(errorsOf(set("ПРИМЕНЕНО ВЛАДЕЛЬЦЕМ", "2026-11-06", "-")).some((error) => error.startsWith("OWNER-MIG-D36: applied needs")));
    assert.deepEqual(errorsOf(set("ОЖИДАЕТ ВЛАДЕЛЬЦА", "-", "ждём владельца")), []);
    assert.deepEqual(errorsOf(set("BLOCKED (OWNER)", "-", "владелец не применил")), []);
  });

  test("a PASS prerequisite needs a date; a BLOCKED prerequisite needs a reason", () => {
    assert.ok(errorsOf(editRow(ledger, "prereq", "P19-GAP-20", (cells) => { cells[4] = "-"; })).some((error) => error.startsWith("P19-GAP-20: PASS needs an ISO date")));
    assert.ok(errorsOf(editRow(ledger, "prereq", "P19-GAP-16", (cells) => { cells[5] = "-"; })).some((error) => error.startsWith("P19-GAP-16: BLOCKED needs a reason")));
  });

  test("a PASS verdict needs a commit that exists and every step of that device PASS", () => {
    const base = completeLedger(ledger);
    assert.ok(errorsOf(withVerdict(base, "PC", "PASS")).some((error) => error.includes("PC verdict needs")));
    assert.ok(errorsOf(withVerdict(base, "phone", "BLOCKED (commit abcdef1)")).some((error) => error.includes("phone verdict")));
    assert.ok(errorsOf(base, { commitExists: noCommit }).some((error) => error.includes("PC verdict commit abcdef1 does not exist")));
    const failed = editRow(base, "pc", "WIN-01", (cells) => { cells[5] = "FAIL"; cells[9] = "окно уходит за край"; cells[10] = "shots/win.png"; });
    assert.ok(errorsOf(failed).some((error) => error.includes("PC verdict is PASS but WIN-01 is FAIL")));
    const blocked = editRow(base, "phone", "A11Y-SR-01", (cells) => { cells[5] = "BLOCKED (DEVICE)"; cells[9] = "нет диктора"; });
    assert.ok(errorsOf(blocked).some((error) => error.includes("phone verdict is PASS but A11Y-SR-01 is BLOCKED (DEVICE)")));
    // A FAIL verdict with a FAIL step is consistent.
    assert.deepEqual(errorsOf(withVerdict(failed, "PC", "FAIL (commit abcdef1)"), { requireComplete: true }), []);
  });
});

describe("20-UAT strict mode PORTIA_REQUIRE_UAT=1 (20-14 Task 2 gate)", () => {
  test("the unfilled ledger is rejected: pending steps, prerequisites and verdicts", () => {
    const errors = errorsOf(pendingLedger(ledger), { requireComplete: true });
    assert.ok(errors.length > 0);
    assert.ok(errors.some((error) => error.includes("REG-01 on PC: is still ОЖИДАЕТ")));
    assert.ok(errors.some((error) => error.includes("STAGING-FREE: is still ОЖИДАЕТ")));
    assert.ok(errors.some((error) => error.includes("PC verdict is still ОЖИДАЕТ")));
    assert.ok(errors.some((error) => error.includes("phone verdict is still ОЖИДАЕТ")));
    assert.ok(errors.some((error) => error.includes("release_candidate_commit")));
  });

  test("a single pending step or prerequisite breaks an otherwise final ledger", () => {
    const base = completeLedger(ledger);
    assert.ok(errorsOf(editRow(base, "pc", "TMPL-01", (cells) => { cells[5] = "ОЖИДАЕТ"; }), { requireComplete: true }).some((error) => error.includes("TMPL-01 on PC: is still ОЖИДАЕТ")));
    assert.ok(errorsOf(editRow(base, "prereq", "VISUAL-APPROVED", (cells) => { cells[3] = "ОЖИДАЕТ"; }), { requireComplete: true }).some((error) => error.includes("VISUAL-APPROVED: is still ОЖИДАЕТ")));
  });

  test("OWNER-MIG waiting for the owner stays allowed in the final ledger (an honest pending production action)", () => {
    const waiting = editRow(completeLedger(ledger), "prereq", "OWNER-MIG-NOTES", (cells) => { cells[3] = "ОЖИДАЕТ ВЛАДЕЛЬЦА"; cells[4] = "-"; });
    assert.deepEqual(errorsOf(waiting, { requireComplete: true }), []);
  });

  test("a verdict without a hex commit, or with another status, is rejected", () => {
    const base = completeLedger(ledger);
    assert.ok(errorsOf(withVerdict(base, "phone", "PASS (commit xyz)"), { requireComplete: true }).some((error) => error.includes("phone verdict needs")));
    assert.ok(errorsOf(withVerdict(base, "PC", "ГОТОВО (commit abcdef1)"), { requireComplete: true }).some((error) => error.includes("PC verdict")));
  });

  test("a step commit that differs from its device verdict commit is rejected", () => {
    const base = completeLedger(ledger);
    const broken = editRow(base, "phone", "REG-07", (cells) => { cells[7] = "1234567"; });
    assert.ok(errorsOf(broken, { requireComplete: true }).some((error) => error.includes("REG-07 on phone: commit 1234567 differs from the phone verdict commit abcdef1")));
  });

  test("D-15: different PC and phone commits need a filled D-15 section", () => {
    const commits = { pc: "abcdef1", phone: "abcdef2" };
    const filled = completeLedger(ledger, commits);
    assert.deepEqual(errorsOf(filled, { requireComplete: true }), []);
    const withoutD15 = filled
      .replace(/^- Изменение между коммитами:.*$/m, "- Изменение между коммитами: не требуется")
      .replace(/^- Основание сохранения PC-вердикта:.*$/m, "- Основание сохранения PC-вердикта: не требуется")
      .replace(/^- Полный повтор phone:.*$/m, "- Полный повтор phone: не требуется");
    const errors = errorsOf(withoutD15, { requireComplete: true });
    for (const label of ["Изменение между коммитами", "Основание сохранения PC-вердикта", "Полный повтор phone"]) {
      assert.ok(errors.some((error) => error.includes(`D-15: "${label}" must be filled`)), label);
    }
    // Same commit on both devices needs no D-15 text.
    assert.deepEqual(errorsOf(completeLedger(ledger), { requireComplete: true }), []);
  });

  test("release_candidate_commit must be a hex commit and the one the phone verdict was run on", () => {
    const base = completeLedger(ledger);
    const set = (value: string) => base.replace(/^release_candidate_commit:.*$/m, `release_candidate_commit: ${value}`);
    assert.ok(errorsOf(set("ОЖИДАЕТ 20-13"), { requireComplete: true }).some((error) => error.includes("release_candidate_commit must be a 7-40 hex commit")));
    assert.ok(errorsOf(set("1234567"), { requireComplete: true }).some((error) => error.includes("release_candidate_commit 1234567 is not the phone verdict commit abcdef1")));
    assert.ok(errorsOf(set("abcdef1"), { requireComplete: true, commitExists: noCommit }).some((error) => error.includes("release_candidate_commit abcdef1 does not exist")));
  });

  test("RELEASE-GATE must be PASS before the owner verdicts count", () => {
    const base = completeLedger(ledger);
    const broken = editRow(base, "prereq", "RELEASE-GATE", (cells) => { cells[3] = "BLOCKED (ENV)"; cells[4] = "-"; cells[5] = "20-13 не выполнен"; });
    assert.ok(errorsOf(broken, { requireComplete: true }).some((error) => error.includes("RELEASE-GATE must be PASS")));
  });
});

describe("20-UAT D-70 owner waiver, not an acceptance (plan 20-14)", () => {
  const waived = () => waivedLedger(ledger);
  const unknownDecision = (commit: string) => !commit.startsWith("03e890a");
  const setStep = (text: string, device: "pc" | "phone", id: string, cells5to10: string[]) =>
    editRow(text, device, id, (cells) => { cells.splice(5, cells5to10.length, ...cells5to10); });

  test("the D-70 constants are exported, the statuses are known, and the words match 20-CONTEXT.md D-70 verbatim", () => {
    assert.equal(D70_STEP_STATUS, "НЕ ПРОВЕРЕНО (D-70)");
    assert.equal(D70_VERDICT, "ПРИНЯТО ВЛАДЕЛЬЦЕМ БЕЗ UAT (D-70)");
    assert.deepEqual(d70WaivablePrerequisites, ["STAGING-FREE", "REVIEWER-ROLE"]);
    assert.ok(stepStatuses.includes(D70_STEP_STATUS));
    assert.ok(prerequisiteStatuses.includes(D70_STEP_STATUS));
    assert.ok(!stepStatuses.includes(D70_VERDICT), "the verdict is a verdict, not a step status");
    const line = readFileSync(contextPath, "utf8").split(/\r?\n/).find((entry) => entry.startsWith("- **D-70:**"));
    assert.ok(line, "20-CONTEXT.md has no D-70 line");
    assert.ok(line.includes(`«${D70_OWNER_WORDS}»`), "D70_OWNER_WORDS is not the owner's sentence in 20-CONTEXT.md");
  });

  test("the waived fixture has the planned shape and is accepted in the default mode", () => {
    const uat = parseUat(waived());
    assert.equal(uat.verdicts.pc?.status, D70_VERDICT);
    assert.equal(uat.verdicts.phone?.status, D70_VERDICT);
    assert.ok([...uat.pc, ...uat.phone].every((step) => step.status !== "PASS" && step.status !== "ОЖИДАЕТ"));
    assert.ok(uat.pc.some((step) => step.status === D70_STEP_STATUS));
    assert.equal(uat.pc.find((step) => step.id === "PROMO-03")?.status, "BLOCKED (ENV)", "a BLOCKED prerequisite keeps its step BLOCKED");
    assert.match(uat.phone.find((step) => step.id === "MEDIA-01")?.status ?? "", /^BLOCKED/);
    assert.deepEqual(errorsOf(waived()), []);
    assert.deepEqual(errorsOf(waivedLedger(ledger, { reviewerRole: "d70" })), []);
  });

  test("D-70 statuses and verdicts need the D-70 section", () => {
    const errors = errorsOf(removeD70Section(waived()));
    assert.ok(errors.some((error) => error.startsWith("INFO-PC-01 on PC:") && error.includes("D-70 section")), errors.join("\n"));
    assert.ok(errors.some((error) => error.startsWith("STAGING-FREE:") && error.includes("D-70 section")));
    assert.ok(errors.some((error) => error.startsWith("PC verdict") && error.includes("D-70 section")));
    assert.ok(errors.some((error) => error.startsWith("phone verdict") && error.includes("D-70 section")));
  });

  test("a D-70 step carries no device, commit, date or screenshot, and names D-70 in the note", () => {
    const base = waived();
    const pcErrors = errorsOf(setStep(base, "pc", "INFO-PC-01", [D70_STEP_STATUS, "PC", "abcdef1", "2026-11-08", "D-70: шаг не проходился", "-"]));
    assert.ok(pcErrors.some((error) => error.startsWith("INFO-PC-01 on PC:") && error.includes("must not name a tested commit")), pcErrors.join("\n"));
    assert.ok(pcErrors.some((error) => error.startsWith("INFO-PC-01 on PC:") && error.includes("device")));
    assert.ok(pcErrors.some((error) => error.startsWith("INFO-PC-01 on PC:") && error.includes("date")));
    assert.ok(errorsOf(setStep(base, "phone", "INFO-PHONE-01", [D70_STEP_STATUS, "-", "-", "-", "D-70: шаг не проходился", "shots/x.png"])).some((error) => error.startsWith("INFO-PHONE-01 on phone:") && error.includes("screenshot")));
    assert.ok(errorsOf(setStep(base, "phone", "INFO-PHONE-01", [D70_STEP_STATUS, "-", "-", "-", "пропущен", "-"])).some((error) => error.startsWith("INFO-PHONE-01 on phone:") && error.includes("note")));
  });

  test("a step whose prerequisite is BLOCKED stays BLOCKED and cannot become НЕ ПРОВЕРЕНО (D-70) (D-16)", () => {
    const base = waived();
    const masked = setStep(base, "pc", "PROMO-03", [D70_STEP_STATUS, "-", "-", "-", "D-70: шаг не проходился, риск принят владельцем", "-"]);
    const errors = errorsOf(masked);
    assert.ok(errors.some((error) => error.startsWith("PROMO-03 on PC:") && error.includes("stays BLOCKED") && error.includes("REVIEWER-ROLE")), errors.join("\n"));
    const media = setStep(base, "phone", "MEDIA-01", [D70_STEP_STATUS, "-", "-", "-", "D-70: шаг не проходился, риск принят владельцем", "-"]);
    assert.ok(errorsOf(media).some((error) => error.startsWith("MEDIA-01 on phone:") && error.includes("stays BLOCKED") && error.includes("P19-GAP-15")));
  });

  test("a D-70 prerequisite status is only for STAGING-FREE and REVIEWER-ROLE", () => {
    const base = waived();
    for (const id of ["OWNER-MIG-D36", "OWNER-MIG-NOTES", "P19-GAP-16", "P19-GAP-20", "VISUAL-APPROVED", "RELEASE-GATE"]) {
      const broken = editRow(base, "prereq", id, (cells) => { cells[3] = D70_STEP_STATUS; cells[4] = "-"; cells[5] = "D-70: подтверждение не запрашивалось"; });
      assert.ok(errorsOf(broken).some((error) => error.startsWith(`${id}: ${D70_STEP_STATUS} is only for`)), id);
    }
    for (const id of d70WaivablePrerequisites) {
      const ok = editRow(base, "prereq", id, (cells) => { cells[3] = D70_STEP_STATUS; cells[4] = "-"; cells[5] = "D-70: подтверждение не запрашивалось"; });
      assert.ok(!errorsOf(ok).some((error) => error.startsWith(`${id}:`)), id);
    }
    const dated = editRow(base, "prereq", "STAGING-FREE", (cells) => { cells[4] = "2026-11-08"; });
    assert.ok(errorsOf(dated).some((error) => error.startsWith("STAGING-FREE:") && error.includes("date")));
  });

  test("OWNER-MIG rows stay ОЖИДАЕТ ВЛАДЕЛЬЦА next to the D-70 waiver", () => {
    const uat = parseUat(waived());
    for (const id of ["OWNER-MIG-D36", "OWNER-MIG-NOTES"]) assert.equal(uat.prerequisites.find((row) => row.id === id)?.status, "ОЖИДАЕТ ВЛАДЕЛЬЦА", id);
  });

  test("a D-70 verdict carries no commit and cannot stand next to a PASS or ОЖИДАЕТ step", () => {
    const base = waived();
    assert.ok(errorsOf(withVerdict(base, "PC", `${D70_VERDICT} (commit abcdef1)`)).some((error) => error.startsWith("PC verdict") && error.includes("must not carry a commit")));
    assert.ok(errorsOf(withVerdict(base, "phone", `${D70_VERDICT} (commit xyz)`)).some((error) => error.startsWith("phone verdict") && error.includes("must not carry a commit")));
    const withPass = setStep(base, "pc", "TMPL-01", ["PASS", "PC", "abcdef1", "2026-11-08", "проверено", "-"]);
    assert.ok(errorsOf(withPass).some((error) => error === `PC verdict is ${D70_VERDICT} but TMPL-01 is PASS`));
    const withPending = setStep(base, "phone", "TMPL-01", ["ОЖИДАЕТ", "-", "-", "-", "-", "-"]);
    assert.ok(errorsOf(withPending).some((error) => error === `phone verdict is ${D70_VERDICT} but TMPL-01 is ОЖИДАЕТ`));
  });

  test("a PASS or FAIL device verdict next to the D-70 section is rejected", () => {
    const base = waived();
    assert.ok(errorsOf(withVerdict(base, "PC", "PASS (commit abcdef1)")).some((error) => error.startsWith("PC verdict is PASS") && error.includes("D-70")));
    assert.ok(errorsOf(withVerdict(base, "phone", "FAIL (commit abcdef1)")).some((error) => error.startsWith("phone verdict is FAIL") && error.includes("D-70")));
  });

  test("the D-70 section is checked field by field", () => {
    const base = waived();
    const has = (text: string, ...needles: string[]) =>
      errorsOf(text).some((error) => error.startsWith("D-70:") && needles.every((needle) => error.includes(needle)));
    assert.ok(has(setD70Field(base, "Дата", "8 ноября"), "Дата", "ISO date"));
    assert.ok(has(dropD70Field(base, "Дата"), "Дата", "missing"));
    assert.ok(has(setD70Field(base, "Слова владельца", "«Можно перейти к следующей фазе, меня всё устраивает»"), "Слова владельца", "verbatim"));
    assert.ok(has(setD70Field(base, "Слова владельца", `«${D70_OWNER_WORDS.toLowerCase()}»`), "Слова владельца", "verbatim"));
    assert.ok(has(setD70Field(base, "Ответ владельца", "«3»"), "Ответ владельца", "«2»"));
    assert.ok(has(setD70Field(base, "Ответ владельца", "-"), "Ответ владельца", "«2»"));
    assert.ok(has(setD70Field(base, "Текст варианта 2", "-"), "Текст варианта 2", "empty"));
    assert.ok(has(setD70Field(base, "Запись решения", "20-CONTEXT.md D-70, commit без номера"), "Запись решения", "40-hex"));
    assert.ok(has(setD70Field(base, "Release commit", "последний (20-63-SUMMARY.md)"), "Release commit", "40-hex"));
    assert.ok(has(setD70Field(base, "Код продукта", "ИЗМЕНЁН ПОСЛЕ ВЕРДИКТА: components/portia-desktop.tsx"), "Код продукта", "НЕ ИЗМЕНЁН"));
    assert.ok(has(dropD70Field(base, "Код продукта"), "Код продукта", "missing"));
    // The untouched section yields nothing at all.
    assert.deepEqual(errorsOf(base), []);
  });

  test("the D-70 decision commit and the release commit must exist, and the release commit is the one in the frontmatter", () => {
    const base = waived();
    const decision = errorsOf(base, { commitExists: unknownDecision });
    assert.ok(decision.some((error) => error.startsWith("D-70:") && error.includes("decision commit") && error.includes("does not exist")), decision.join("\n"));
    const release = errorsOf(base, { commitExists: (commit) => !commit.startsWith("f49aa00") });
    assert.ok(release.some((error) => error.startsWith("D-70:") && error.includes("Release commit") && error.includes("does not exist")), release.join("\n"));
    const other = base.replace(/^release_candidate_commit:.*$/m, `release_candidate_commit: ${D70_FIXTURE_DECISION}`);
    assert.ok(errorsOf(other).some((error) => error.startsWith("D-70:") && error.includes("is not release_candidate_commit")));
    const pending = base.replace(/^release_candidate_commit:.*$/m, "release_candidate_commit: ОЖИДАЕТ 20-13");
    assert.ok(errorsOf(pending).some((error) => error.startsWith("D-70:") && error.includes("is not release_candidate_commit")));
  });

  test("PORTIA_REQUIRE_UAT=1 rejects every D-70 step, prerequisite and verdict as not acceptance", () => {
    const errors = errorsOf(waived(), { requireComplete: true });
    for (const prefix of ["INFO-PC-01 on PC:", "SPIDER-02 on phone:", "STAGING-FREE:", "PC verdict", "phone verdict"]) {
      assert.ok(errors.some((error) => error.startsWith(prefix) && error.includes("not acceptance")), `${prefix} is not rejected as not acceptance\n${errors.join("\n")}`);
    }
    const reviewer = errorsOf(waivedLedger(ledger, { reviewerRole: "d70" }), { requireComplete: true });
    assert.ok(reviewer.some((error) => error.startsWith("REVIEWER-ROLE:") && error.includes("not acceptance")));
    // The filled fixture without a D-70 section is still accepted in the strict mode.
    assert.deepEqual(errorsOf(completeLedger(ledger), { requireComplete: true }), []);
  });
});

describe("20-UAT the committed ledger as 20-14 records it (D-70)", () => {
  const phaseDir = path.join(root, ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza");
  const readText = (file: string) => readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const uat = parseUat(ledger);
  const steps = [...uat.pc, ...uat.phone];
  const prerequisite = (id: string) => uat.prerequisites.find((row) => row.id === id);

  test("the committed ledger records the D-70 owner waiver", () => {
    assert.equal(uat.verdicts.pc?.raw, D70_VERDICT);
    assert.equal(uat.verdicts.phone?.raw, D70_VERDICT);
    assert.equal(uat.frontmatter.status, "accepted-risk-d70");
    assert.match(uat.frontmatter.release_candidate_commit ?? "", /^[0-9a-f]{40}$/);
    assert.ok(uat.hasD70, "the D-70 section is missing");
    assert.equal(steps.filter((step) => step.status === "PASS").length, 0, "no step may be PASS under D-70");
    assert.equal(steps.filter((step) => step.status === "ОЖИДАЕТ").length, 0, "no step may stay ОЖИДАЕТ under D-70");
    assert.deepEqual(validateUat(ledger, { commitExists: gitCommitExists }), []);
  });

  test("the release commit of the ledger is the release commit of the 20-63 protocol", () => {
    const summary = readText(path.join(phaseDir, "20-63-SUMMARY.md"));
    const release = summary.match(/^release_commit: ([0-9a-f]{40})$/m)?.[1];
    assert.ok(release, "20-63-SUMMARY.md has no release_commit");
    assert.equal(uat.frontmatter.release_candidate_commit, release);
    assert.ok(uat.d70["Release commit"].startsWith(release));
    const evidence = readText(path.join(phaseDir, "20-RELEASE-EVIDENCE.md"));
    assert.ok(evidence.includes(`Commit: \`${release}\``), "20-RELEASE-EVIDENCE.md is not the protocol of this release commit");
  });

  test("a step is BLOCKED exactly when one of its prerequisites is BLOCKED, otherwise it was not checked", () => {
    for (const step of steps) {
      const dependencies = step.dependsOn.split(/\s*[,;]\s*/).filter((dep) => dep !== "" && dep !== "-");
      const blocked = dependencies.map((dep) => prerequisite(dep)?.status ?? "").find((status) => status.startsWith("BLOCKED"));
      if (blocked) assert.equal(step.status, blocked, `${step.id} must keep the BLOCKED kind of its prerequisite`);
      else assert.equal(step.status, D70_STEP_STATUS, `${step.id} was not run and has no BLOCKED prerequisite`);
    }
  });

  test("prerequisites follow the evidence: owner migrations are untouched, the release gate is not strengthened", () => {
    assert.equal(prerequisite("OWNER-MIG-D36")?.status, "ОЖИДАЕТ ВЛАДЕЛЬЦА");
    assert.equal(prerequisite("OWNER-MIG-NOTES")?.status, "ОЖИДАЕТ ВЛАДЕЛЬЦА");
    assert.equal(prerequisite("STAGING-FREE")?.status, D70_STEP_STATUS);
    assert.ok(["BLOCKED (ENV)", D70_STEP_STATUS].includes(prerequisite("REVIEWER-ROLE")?.status ?? ""));
    const evidence = readText(path.join(phaseDir, "20-RELEASE-EVIDENCE.md"));
    const outcome = evidence.match(/^## Итог\s+Итог: (\S+)/m)?.[1];
    assert.ok(outcome, "20-RELEASE-EVIDENCE.md has no outcome line");
    const expectedByOutcome: Record<string, string> = { PASS: "PASS", BLOCKED: "BLOCKED (ENV)", FAIL: "FAIL" };
    assert.equal(prerequisite("RELEASE-GATE")?.status, expectedByOutcome[outcome], `RELEASE-GATE must repeat the protocol outcome ${outcome} without strengthening`);
    for (const row of uat.prerequisites.filter((entry) => entry.status === "PASS")) {
      assert.ok(["P19-GAP-20", "P19-GAP-22", "VISUAL-APPROVED"].includes(row.id), `${row.id} may not be PASS`);
    }
    if (prerequisite("VISUAL-APPROVED")?.status === "PASS") {
      const owner = readText(path.join(phaseDir, "20-58-SUMMARY.md"));
      assert.match(owner, /^owner_verdict: accepted$/m);
      const commit = owner.match(/^owner_verdict_commit: ([0-9a-f]{40})$/m)?.[1];
      const registry = readText(path.join(root, "tests/e2e/visual/phase20-baselines.json"));
      assert.ok(commit && registry.includes(`"commit": "${commit}"`), "the baseline registry is not bound to the owner verdict commit");
    }
  });

  test("the ledger never calls D-70 a physical acceptance", () => {
    assert.ok(!ledger.includes(`${D70_VERDICT} (commit`));
    assert.ok(/не PASS|не получает PASS/.test(uat.d70["Что это значит"] ?? ""));
    assert.ok(steps.every((step) => empty(step.device) && empty(step.commit) && empty(step.date) && empty(step.screenshot)), "a step names a device, commit, date or screenshot");
  });
});
