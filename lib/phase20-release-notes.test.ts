import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// 20-31: the Phase 20 release notes draft (STAB-SEC-06). The notes are a promise to the owner and to users, so this file
// compares the draft with the evidence it summarizes (security matrix, owner waiver registry) and rejects any wording that
// promises more than is proven. Plan 20-15 finalizes the same file; it must not be created from scratch.

const phaseDir = ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza";
const read = (relative: string) => readFileSync(new URL(`../${relative}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

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

export type Notes = { frontmatter: Record<string, string>; sections: Map<string, string>; text: string };

/** Frontmatter (`key: value` lines between two `---` lines) and the `## ` sections of the notes. */
export function parseNotes(text: string): Notes {
  const normalized = text.replace(/\r\n/g, "\n");
  const frontmatter: Record<string, string> = {};
  const match = /^---\n([\s\S]*?)\n---\n/.exec(normalized);
  if (match) {
    for (const line of match[1].split("\n")) {
      const pair = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
      if (pair) frontmatter[pair[1]] = pair[2].trim();
    }
  }
  const sections = new Map<string, string>();
  const lines = normalized.split("\n");
  let title: string | null = null;
  let body: string[] = [];
  const flush = () => { if (title !== null) sections.set(title, body.join("\n")); };
  for (const line of lines) {
    if (line.startsWith("## ")) {
      flush();
      title = line.slice(3).trim();
      body = [];
    } else if (title !== null) {
      body.push(line);
    }
  }
  flush();
  return { frontmatter, sections, text: normalized };
}

const spoofHeading = "Начальный режим теста подделываем";
const attestationHeading = "Привязка устройства не является аппаратной аттестацией";
const mediumHeading = "Принятые риски (medium, D-09)";
const requiredSections = [spoofHeading, attestationHeading, mediumHeading];

const matrixCommitOf = (matrix: string) => /Проверяемый commit:\s*`([0-9a-f]{40})`/.exec(matrix.split("\n").slice(0, 8).join("\n"))?.[1];
const registryIds = (matrix: string) => tableRows(section(matrix, "Релизный реестр (D-09)")).map((row) => row[0]).filter((id) => /^SEC20-\d+$/.test(id));
const firstLine = (body: string) => body.split("\n").map((line) => line.trim()).find((line) => line.length > 0) ?? "";

// Wording that promises protection. The notes may only describe limits, so these never match a correct draft.
const promisePatterns = [/гарантир/i, /защищ[её]н[аоы]? от подмены/i];

type Context = { matrix: string; waivers: string };

/** Every problem of the draft against the matrix and the waiver registry. An empty list means the draft is acceptable. */
export function notesProblems(notes: Notes, context: Context): string[] {
  const problems: string[] = [];
  const { frontmatter } = notes;

  const status = frontmatter.status;
  if (status !== "draft" && status !== "final") problems.push(`status must be draft or final, got "${status ?? ""}"`);
  if (status === "final" && !/^[0-9a-f]{40}$/.test(frontmatter.release_commit ?? "")) problems.push("status final needs a 40-hex release_commit");

  const expected = matrixCommitOf(context.matrix);
  if (!expected) problems.push("matrix has no 40-hex «Проверяемый commit»");
  else if (frontmatter.matrix_commit !== expected) {
    problems.push(`stale notes: matrix_commit ${frontmatter.matrix_commit ?? "(missing)"} is not the matrix «Проверяемый commit» ${expected}`);
  }

  for (const heading of requiredSections) {
    if (!notes.sections.has(heading)) problems.push(`missing section: ${heading}`);
  }
  if (notes.sections.has(attestationHeading) && firstLine(notes.sections.get(attestationHeading)!) !== `${attestationHeading}.`) {
    problems.push(`section «${attestationHeading}» must start with the exact sentence «${attestationHeading}.»`);
  }
  if (notes.sections.has(spoofHeading) && firstLine(notes.sections.get(spoofHeading)!) !== `${spoofHeading}.`) {
    problems.push(`section «${spoofHeading}» must start with the exact sentence «${spoofHeading}.»`);
  }

  const registry = registryIds(context.matrix);
  if (registry.length === 0) problems.push("matrix «Релизный реестр (D-09)» is empty or missing");
  const medium = notes.sections.get(mediumHeading) ?? "";
  for (const id of registry) {
    if (!medium.includes(id)) problems.push(`${id} from the matrix «Релизный реестр (D-09)» is missing from «${mediumHeading}»`);
  }

  for (const pattern of promisePatterns) {
    if (pattern.test(notes.text)) problems.push(`the notes promise protection (${pattern}); describe the limit instead`);
  }

  return problems;
}

// ---------------------------------------------------------------------------------------------------------------------
// Fixtures: a minimal matrix and a draft that satisfies it, then one rejected variant per rule.

const FIX_COMMIT = "a".repeat(40);
const FIX_RELEASE = "b".repeat(40);

const fixtureMatrix = [
  "# 20 — Security matrix", "", `Дата: 2026-11-04. Проверяемый commit: \`${FIX_COMMIT}\` (HEAD).`, "",
  "## Релизный реестр (D-09)", "", "| ID | Что указать в release notes |", "|---|---|",
  "| SEC20-01 | Оракул email принят. |", "| SEC20-16 | Начальный режим теста подделываем. |", "| SEC20-17 | Привязка устройства не является аппаратной аттестацией. |", "",
].join("\n");

const fixtureWaivers = "";

function fixtureNotes(over: { status?: string; release?: string; matrixCommit?: string; mediumRows?: string[]; attestationFirst?: string; extra?: string; drop?: string } = {}) {
  const status = over.status ?? "draft";
  const mediumRows = over.mediumRows ?? ["| SEC20-01 | Оракул email принят. |", "| SEC20-16 | Начальный режим теста подделываем. |", "| SEC20-17 | Привязка устройства не является аппаратной аттестацией. |"];
  const blocks: Record<string, string> = {
    [spoofHeading]: `## ${spoofHeading}\n\n${spoofHeading}.\n\nРежим задаёт отправитель запроса.\n`,
    [attestationHeading]: `## ${attestationHeading}\n\n${over.attestationFirst ?? `${attestationHeading}.`}\n\nCookie с токеном и грубые бакеты.\n`,
    [mediumHeading]: `## ${mediumHeading}\n\n| ID | Что принято |\n|---|---|\n${mediumRows.join("\n")}\n`,
  };
  if (over.drop) delete blocks[over.drop];
  return [
    "---", `status: ${status}`, `release_commit: ${over.release ?? "ОЖИДАЕТ 20-15"}`, `matrix_commit: ${over.matrixCommit ?? FIX_COMMIT}`, "---", "", "# Release notes", "",
    ...Object.values(blocks), over.extra ?? "",
  ].join("\n");
}

const check = (text: string, matrix = fixtureMatrix, waivers = fixtureWaivers) => notesProblems(parseNotes(text), { matrix, waivers });

test("parseNotes reads the frontmatter and splits the notes into sections by heading", () => {
  const notes = parseNotes(fixtureNotes());
  assert.equal(notes.frontmatter.status, "draft");
  assert.equal(notes.frontmatter.release_commit, "ОЖИДАЕТ 20-15");
  assert.equal(notes.frontmatter.matrix_commit, FIX_COMMIT);
  assert.deepEqual([...notes.sections.keys()], requiredSections);
  assert.match(notes.sections.get(mediumHeading)!, /SEC20-17/);
  assert.deepEqual(parseNotes("без frontmatter\n").frontmatter, {});
});

test("notesProblems: the complete fixture draft is accepted", () => {
  assert.deepEqual(check(fixtureNotes()), []);
});

test("notesProblems fixture: a draft without the device attestation section is rejected", () => {
  assert.deepEqual(check(fixtureNotes({ drop: attestationHeading })), [`missing section: ${attestationHeading}`]);
});

test("notesProblems fixture: a draft that omits one ID of the D-09 release registry is rejected", () => {
  const rows = ["| SEC20-01 | Оракул email принят. |", "| SEC20-16 | Начальный режим теста подделываем. |"];
  assert.deepEqual(check(fixtureNotes({ mediumRows: rows })), [`SEC20-17 from the matrix «Релизный реестр (D-09)» is missing from «${mediumHeading}»`]);
});

test("notesProblems fixture: a matrix_commit that is not the matrix «Проверяемый commit» is a stale draft", () => {
  const problems = check(fixtureNotes({ matrixCommit: "c".repeat(40) }));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /^stale notes: matrix_commit c{40} is not the matrix «Проверяемый commit» a{40}$/);
  assert.match(check(fixtureNotes().replace(/matrix_commit: .*\n/, ""))[0], /^stale notes: matrix_commit \(missing\)/);
  assert.deepEqual(check(fixtureNotes(), "# матрица без commit\n"), ["matrix has no 40-hex «Проверяемый commit»", "matrix «Релизный реестр (D-09)» is empty or missing"]);
});

test("notesProblems fixture: status must be draft or final, and final needs a 40-hex release_commit", () => {
  assert.deepEqual(check(fixtureNotes({ status: "ready" })), ['status must be draft or final, got "ready"']);
  assert.deepEqual(check(fixtureNotes({ status: "final" })), ["status final needs a 40-hex release_commit"]);
  assert.deepEqual(check(fixtureNotes({ status: "final", release: "abc123" })), ["status final needs a 40-hex release_commit"]);
  assert.deepEqual(check(fixtureNotes({ status: "final", release: FIX_RELEASE })), []);
});

test("notesProblems fixture: the two limit sections must open with their exact sentence", () => {
  assert.deepEqual(check(fixtureNotes({ attestationFirst: "Привязка устройства надёжна." })), [`section «${attestationHeading}» must start with the exact sentence «${attestationHeading}.»`]);
  const spoofless = fixtureNotes().replace(`\n${spoofHeading}.\n`, "\nРежим задаёт отправитель запроса.\n");
  assert.deepEqual(check(spoofless), [`section «${spoofHeading}» must start with the exact sentence «${spoofHeading}.»`]);
});

test("notesProblems fixture: wording that promises protection is rejected", () => {
  const promised = check(fixtureNotes({ extra: "Мы гарантируем честный тест.\n" }));
  assert.equal(promised.length, 1);
  assert.match(promised[0], /promise protection/);
  assert.equal(check(fixtureNotes({ extra: "Режим защищён от подмены.\n" })).length, 1);
  assert.equal(check(fixtureNotes({ extra: "Режим защищена от подмены.\n" })).length, 1);
  assert.deepEqual(check(fixtureNotes({ extra: "Режим можно подменить, защиты нет.\n" })), []);
});

test("the real release notes draft is consistent with the real security matrix", () => {
  const notes = parseNotes(read(`${phaseDir}/20-RELEASE-NOTES.md`));
  assert.equal(notes.frontmatter.status, "draft");
  assert.equal(notes.frontmatter.release_commit, "ОЖИДАЕТ 20-15");
  assert.deepEqual(notesProblems(notes, { matrix: read(`${phaseDir}/20-SECURITY-MATRIX.md`), waivers: read(`${phaseDir}/20-PLAYWRIGHT-WAIVERS.md`) }), []);
});
