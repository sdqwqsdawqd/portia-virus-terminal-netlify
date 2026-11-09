import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

// 20-31: the requirements ledger of Phase 20 must not show Complete without proof. Two checks: the checkbox list and the
// traceability table agree for every Phase 20 ID, and a requirement that is Complete has the evidence file that proves it.
// Plan 20-15 cannot inherit an over-marked requirement: reopening one needs the proof listed in `evidenceProblems`.

const phaseDir = ".planning/milestones/v1.3-phases/PORTIA-20-security-accessibility-i-priemka-reliza";
const roadmapPath = ".planning/milestones/v1.3-ROADMAP.md";
const requirementsPath = ".planning/milestones/v1.3-REQUIREMENTS.md";
const read = (relative: string) => readFileSync(new URL(`../${relative}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const exists = (relative: string) => existsSync(new URL(`../${relative}`, import.meta.url));

/** Text of a `## heading` block, up to the next `## ` heading. Empty string when the heading is missing. */
function section(markdown: string, heading: string) {
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => line.startsWith("## ") && line.slice(3).trim().startsWith(heading));
  if (start === -1) return "";
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  return (end === -1 ? rest : rest.slice(0, end)).join("\n");
}

/** Data rows of the first table in the text: header and separator are skipped, cells are trimmed. */
function tableRows(text: string) {
  const lines = text.split("\n").filter((line) => line.trimStart().startsWith("|"));
  return lines.slice(2).map((line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim()));
}

/** The IDs of the `**Requirements**:` line that belongs to `### Phase 20` in the roadmap. */
export function phaseIds(roadmap: string, phase = 20): string[] {
  const lines = roadmap.split("\n");
  const start = lines.findIndex((line) => new RegExp(`^### Phase ${phase}:`).test(line));
  if (start === -1) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("### "));
  const block = end === -1 ? rest : rest.slice(0, end);
  const line = block.find((candidate) => candidate.startsWith("**Requirements**:"));
  if (!line) return [];
  return line.slice("**Requirements**:".length).split(",").map((id) => id.trim()).filter((id) => /^STAB-[A-Z0-9]+-\d+$/.test(id));
}

type Ledger = { checked: Map<string, boolean>; trace: Map<string, string>; duplicates: string[] };

/** Checklist boxes (`- [x] **ID**:`) and traceability statuses (`| ID | Phase N | Status |`) of REQUIREMENTS.md. */
function parseLedger(requirements: string): Ledger {
  const checked = new Map<string, boolean>();
  const trace = new Map<string, string>();
  const duplicates: string[] = [];
  for (const line of requirements.split("\n")) {
    const box = /^- \[([ xX])\] \*\*(STAB-[A-Z0-9]+-\d+)\*\*/.exec(line);
    if (box) {
      if (checked.has(box[2])) duplicates.push(`${box[2]}: more than one checklist line`);
      checked.set(box[2], box[1] !== " ");
      continue;
    }
    const row = /^\|\s*(STAB-[A-Z0-9]+-\d+)\s*\|\s*Phase [\d.]+\s*\|\s*([^|]+?)\s*\|/.exec(line);
    if (row) {
      if (trace.has(row[1])) duplicates.push(`${row[1]}: more than one traceability row`);
      trace.set(row[1], row[2]);
    }
  }
  return { checked, trace, duplicates };
}

/** The checkbox and the traceability row must exist for every ID and say the same thing. */
export function ledgerProblems(requirements: string, ids: string[]): string[] {
  const { checked, trace, duplicates } = parseLedger(requirements);
  const problems: string[] = [];
  if (ids.length === 0) return ["no requirement IDs to check"];
  for (const id of ids) {
    const box = checked.get(id);
    const status = trace.get(id);
    if (box === undefined) problems.push(`${id}: no checklist line`);
    if (status === undefined) problems.push(`${id}: no traceability row`);
    if (box === undefined || status === undefined) continue;
    if (box && status !== "Complete") problems.push(`${id}: checkbox is checked but the traceability status is ${status}`);
    if (!box && status === "Complete") problems.push(`${id}: checkbox is unchecked but the traceability status is Complete`);
  }
  return [...problems, ...duplicates.filter((problem) => ids.some((id) => problem.startsWith(`${id}:`)))];
}

type Evidence = {
  /** Text of 20-UAT.md. */
  uat: string;
  /** Text of 20-SECURITY-MATRIX.md. */
  matrix: string;
  /** Text of 20-RELEASE-NOTES.md, or null when the file does not exist. */
  releaseNotes: string | null;
  /** Whether 20-RECONCILIATION.md exists. */
  reconciliationExists: boolean;
};

const isComplete = (ledger: Ledger, id: string) => ledger.checked.get(id) === true || ledger.trace.get(id) === "Complete";

/** The row of a UAT checklist table with this step ID: its status cell (6th column). */
function uatStepStatus(uat: string, heading: string, step: string) {
  return tableRows(section(uat, heading)).find((row) => row[0] === step)?.[5];
}

/** A requirement that is Complete must have the proof that closes it. Anything else is an over-marked requirement. */
export function evidenceProblems(requirements: string, files: Evidence): string[] {
  const ledger = parseLedger(requirements);
  const problems: string[] = [];

  for (const id of ["STAB-A11Y-01", "STAB-A11Y-03"]) {
    if (isComplete(ledger, id) && !/^Вердикт PC:\s*PASS\s*$/m.test(files.uat)) {
      problems.push(`${id} is Complete but 20-UAT.md has no «Вердикт PC: PASS»`);
    }
  }
  if (isComplete(ledger, "STAB-MEDIA-07")) {
    for (const [heading, label] of [["Чек-лист PC", "PC"], ["Чек-лист phone", "phone"]] as const) {
      if (uatStepStatus(files.uat, heading, "MEDIA-01") !== "PASS") problems.push(`STAB-MEDIA-07 is Complete but MEDIA-01 is not PASS in the ${label} table of 20-UAT.md`);
    }
  }
  if (isComplete(ledger, "STAB-SEC-06") && !/^status:\s*final\s*$/m.test(files.releaseNotes?.split("\n---\n")[0] ?? "")) {
    problems.push("STAB-SEC-06 is Complete but 20-RELEASE-NOTES.md is missing or is not status: final");
  }
  if (isComplete(ledger, "STAB-SEC-05")) {
    for (const heading of ["Маршруты API (охват)", "Охват файлов"]) {
      if (section(files.matrix, heading).trim() === "") problems.push(`STAB-SEC-05 is Complete but the matrix has no section «${heading}»`);
    }
  }
  if (isComplete(ledger, "STAB-REL-07") && !files.reconciliationExists) {
    problems.push("STAB-REL-07 is Complete but 20-RECONCILIATION.md does not exist");
  }
  return problems;
}

// ---------------------------------------------------------------------------------------------------------------------
// Fixtures.

const roadmapFixture = [
  "### Phase 19: Повышение", "", "**Requirements**: STAB-PROM-01, STAB-PROM-02", "",
  "### Phase 20: Security", "", "**Goal**: цель", "**Requirements**: STAB-A11Y-01, STAB-A11Y-03, STAB-MEDIA-07, STAB-SEC-05, STAB-SEC-06, STAB-REL-07", "**Merged**: x", "",
  "### Phase 21: после", "", "**Requirements**: STAB-NEXT-01", "",
].join("\n");

type Mark = "Complete" | "Pending";
function requirementsFixture(marks: Partial<Record<string, Mark>> = {}, boxes: Partial<Record<string, Mark>> = {}) {
  const ids = ["STAB-A11Y-01", "STAB-A11Y-03", "STAB-MEDIA-07", "STAB-SEC-05", "STAB-SEC-06", "STAB-REL-07"];
  const status = (id: string): Mark => marks[id] ?? "Pending";
  const box = (id: string): Mark => boxes[id] ?? status(id);
  return [
    "# Requirements", "",
    ...ids.map((id) => `- [${box(id) === "Complete" ? "x" : " "}] **${id}**: текст требования.`), "",
    "## Traceability", "", "| Requirement | Phase | Status |", "|-------------|-------|--------|",
    ...ids.map((id) => `| ${id} | Phase 20 | ${status(id)} |`), "",
  ].join("\n");
}

const ids6 = phaseIds(roadmapFixture);

const uatFixture = (over: { pc?: string; pcMedia?: string; phoneMedia?: string } = {}) => [
  "# 20-UAT", "",
  "## Чек-лист PC", "", "| ID | Шаг | Ожидаемый результат | Требования | Зависит от | Статус |", "|----|---|---|---|---|---|",
  `| MEDIA-01 | Внешние media | ok | STAB-MEDIA-07 | - | ${over.pcMedia ?? "ОЖИДАЕТ"} |`, "",
  "## Чек-лист phone", "", "| ID | Шаг | Ожидаемый результат | Требования | Зависит от | Статус |", "|----|---|---|---|---|---|",
  `| MEDIA-01 | Внешние media | ok | STAB-MEDIA-07 | - | ${over.phoneMedia ?? "ОЖИДАЕТ"} |`, "",
  "## Вердикты", "", `Вердикт PC: ${over.pc ?? "ОЖИДАЕТ"}`, "Вердикт phone: ОЖИДАЕТ", "",
].join("\n");

const matrixFixture = "# матрица\n\n## Маршруты API (охват)\n\n| Маршрут |\n|---|\n| `app/api/x/route.ts` |\n\n## Охват файлов\n\n- `app/api`\n";
const notesFixture = (status: string) => `---\nstatus: ${status}\nrelease_commit: ОЖИДАЕТ 20-15\n---\n\n# Release notes\n`;

const proof = (over: Partial<Evidence> = {}): Evidence => ({ uat: uatFixture(), matrix: matrixFixture, releaseNotes: notesFixture("draft"), reconciliationExists: false, ...over });

test("phaseIds returns the requirement IDs of the Phase 20 roadmap block only", () => {
  assert.deepEqual(ids6, ["STAB-A11Y-01", "STAB-A11Y-03", "STAB-MEDIA-07", "STAB-SEC-05", "STAB-SEC-06", "STAB-REL-07"]);
  assert.deepEqual(phaseIds(roadmapFixture, 19), ["STAB-PROM-01", "STAB-PROM-02"]);
  assert.deepEqual(phaseIds("### Phase 20: x\n\n**Goal**: g\n"), []);
  assert.deepEqual(phaseIds("нет фаз"), []);
});

test("ledgerProblems fixture: a consistent ledger is accepted", () => {
  assert.deepEqual(ledgerProblems(requirementsFixture(), ids6), []);
  assert.deepEqual(ledgerProblems(requirementsFixture({ "STAB-SEC-05": "Complete" }), ids6), []);
});

test("ledgerProblems fixture: an ID without a checklist line or without a traceability row is rejected", () => {
  const noBox = requirementsFixture().replace(/^- \[ \] \*\*STAB-REL-07\*\*.*\n/m, "");
  assert.deepEqual(ledgerProblems(noBox, ids6), ["STAB-REL-07: no checklist line"]);
  const noRow = requirementsFixture().replace(/^\| STAB-SEC-06 \|.*\n/m, "");
  assert.deepEqual(ledgerProblems(noRow, ids6), ["STAB-SEC-06: no traceability row"]);
  assert.deepEqual(ledgerProblems("", ["STAB-X-01"]), ["STAB-X-01: no checklist line", "STAB-X-01: no traceability row"]);
  assert.deepEqual(ledgerProblems(requirementsFixture(), []), ["no requirement IDs to check"]);
});

test("ledgerProblems fixture: a checkbox and a traceability status that disagree are rejected in both directions", () => {
  assert.deepEqual(ledgerProblems(requirementsFixture({ "STAB-SEC-05": "Pending" }, { "STAB-SEC-05": "Complete" }), ids6), ["STAB-SEC-05: checkbox is checked but the traceability status is Pending"]);
  assert.deepEqual(ledgerProblems(requirementsFixture({ "STAB-SEC-05": "Complete" }, { "STAB-SEC-05": "Pending" }), ids6), ["STAB-SEC-05: checkbox is unchecked but the traceability status is Complete"]);
});

test("ledgerProblems fixture: a duplicated line is rejected", () => {
  const doubled = `${requirementsFixture()}\n| STAB-SEC-06 | Phase 20 | Pending |\n`;
  assert.deepEqual(ledgerProblems(doubled, ids6), ["STAB-SEC-06: more than one traceability row"]);
});

test("evidenceProblems fixture: nothing Complete needs no proof", () => {
  assert.deepEqual(evidenceProblems(requirementsFixture(), proof()), []);
});

test("evidenceProblems fixture: STAB-A11Y-01 and STAB-A11Y-03 Complete need «Вердикт PC: PASS» in 20-UAT.md", () => {
  const complete = requirementsFixture({ "STAB-A11Y-01": "Complete", "STAB-A11Y-03": "Complete" });
  assert.deepEqual(evidenceProblems(complete, proof()), [
    "STAB-A11Y-01 is Complete but 20-UAT.md has no «Вердикт PC: PASS»", "STAB-A11Y-03 is Complete but 20-UAT.md has no «Вердикт PC: PASS»",
  ]);
  assert.deepEqual(evidenceProblems(complete, proof({ uat: uatFixture({ pc: "FAIL" }) })).length, 2);
  assert.deepEqual(evidenceProblems(complete, proof({ uat: uatFixture({ pc: "PASS" }) })), []);
});

test("evidenceProblems fixture: STAB-MEDIA-07 Complete needs MEDIA-01 PASS in both the PC and the phone table", () => {
  const complete = requirementsFixture({ "STAB-MEDIA-07": "Complete" });
  assert.deepEqual(evidenceProblems(complete, proof()), [
    "STAB-MEDIA-07 is Complete but MEDIA-01 is not PASS in the PC table of 20-UAT.md", "STAB-MEDIA-07 is Complete but MEDIA-01 is not PASS in the phone table of 20-UAT.md",
  ]);
  assert.deepEqual(evidenceProblems(complete, proof({ uat: uatFixture({ pcMedia: "PASS" }) })), ["STAB-MEDIA-07 is Complete but MEDIA-01 is not PASS in the phone table of 20-UAT.md"]);
  assert.deepEqual(evidenceProblems(complete, proof({ uat: uatFixture({ pcMedia: "PASS", phoneMedia: "PASS" }) })), []);
});

test("evidenceProblems fixture: STAB-SEC-06 Complete needs release notes with status: final", () => {
  const complete = requirementsFixture({ "STAB-SEC-06": "Complete" });
  const problem = "STAB-SEC-06 is Complete but 20-RELEASE-NOTES.md is missing or is not status: final";
  assert.deepEqual(evidenceProblems(complete, proof()), [problem]);
  assert.deepEqual(evidenceProblems(complete, proof({ releaseNotes: null })), [problem]);
  assert.deepEqual(evidenceProblems(complete, proof({ releaseNotes: notesFixture("final") })), []);
});

test("evidenceProblems fixture: STAB-SEC-05 Complete needs the route and file coverage sections of the matrix", () => {
  const complete = requirementsFixture({ "STAB-SEC-05": "Complete" });
  assert.deepEqual(evidenceProblems(complete, proof()), []);
  assert.deepEqual(evidenceProblems(complete, proof({ matrix: matrixFixture.replace(/## Охват файлов[\s\S]*$/, "") })), ["STAB-SEC-05 is Complete but the matrix has no section «Охват файлов»"]);
  assert.deepEqual(evidenceProblems(complete, proof({ matrix: "# старая матрица\n\n## Находки\n" })), [
    "STAB-SEC-05 is Complete but the matrix has no section «Маршруты API (охват)»", "STAB-SEC-05 is Complete but the matrix has no section «Охват файлов»",
  ]);
});

test("evidenceProblems fixture: STAB-REL-07 Complete needs 20-RECONCILIATION.md", () => {
  const complete = requirementsFixture({ "STAB-REL-07": "Complete" });
  assert.deepEqual(evidenceProblems(complete, proof()), ["STAB-REL-07 is Complete but 20-RECONCILIATION.md does not exist"]);
  assert.deepEqual(evidenceProblems(complete, proof({ reconciliationExists: true })), []);
});

test("evidenceProblems fixture: a checked box alone counts as Complete", () => {
  const boxOnly = requirementsFixture({}, { "STAB-A11Y-01": "Complete" });
  assert.deepEqual(evidenceProblems(boxOnly, proof()), ["STAB-A11Y-01 is Complete but 20-UAT.md has no «Вердикт PC: PASS»"]);
});

// ---------------------------------------------------------------------------------------------------------------------
// The real files.

const realProof = (): Evidence => ({
  uat: read(`${phaseDir}/20-UAT.md`),
  matrix: read(`${phaseDir}/20-SECURITY-MATRIX.md`),
  releaseNotes: exists(`${phaseDir}/20-RELEASE-NOTES.md`) ? read(`${phaseDir}/20-RELEASE-NOTES.md`) : null,
  reconciliationExists: exists(`${phaseDir}/20-RECONCILIATION.md`),
});

test("the roadmap lists the 32 requirement IDs of Phase 20", () => {
  const ids = phaseIds(read(roadmapPath));
  assert.equal(ids.length, 32);
  assert.equal(new Set(ids).size, 32);
});

test("the real REQUIREMENTS.md: checkbox and traceability agree for all 32 IDs of Phase 20", () => {
  assert.deepEqual(ledgerProblems(read(requirementsPath), phaseIds(read(roadmapPath))), []);
});

test("the real REQUIREMENTS.md: nothing is Complete without its proof (20-UAT verdict, MEDIA-01, release notes, matrix, reconciliation)", () => {
  assert.deepEqual(evidenceProblems(read(requirementsPath), realProof()), []);
});
