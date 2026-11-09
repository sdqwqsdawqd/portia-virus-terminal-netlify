import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// 20-31: the Phase 20 release notes draft (STAB-SEC-06). The notes are a promise to the owner and to users, so this file
// compares the draft with the evidence it summarizes (security matrix, owner waiver registry) and rejects any wording that
// promises more than is proven. Plan 20-15 finalizes the same file; it must not be created from scratch.

const phaseDir = ".planning/milestones/v1.3-phases/PORTIA-20-security-accessibility-i-priemka-reliza";
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
const lowHeading = "Находки low и info";
const d33Heading = "Перенесённые находки 19-REVIEW (D-33)";
const dependenciesHeading = "Зависимости";
const cspHeading = "CSP и HTTPS (D-05, D-08, D-14)";
const migrationsHeading = "Миграции, ожидающие владельца";
const playwrightHeading = "Playwright: waivers и ожидаемые неисправности";
const outsideHeading = "Изменения вне планов";
const inheritedHeading = "Унаследованные пробелы Phase 19";
const unprovenHeading = "Не доказано";
const requiredSections = [
  spoofHeading, attestationHeading, mediumHeading, lowHeading, d33Heading, dependenciesHeading, cspHeading,
  migrationsHeading, playwrightHeading, outsideHeading, inheritedHeading, unprovenHeading,
];

/** Migrations whose production application the owner still owes; the notes must name them and never call them proven. */
const pendingMigrations = ["20261104000000", "20261104000100"];
/** The real list: 20-33 added the migration that drops the editor notes table. */
const realPendingMigrations = [...pendingMigrations, "20261106000000"];
const pendingMark = "ОЖИДАЕТ ВЛАДЕЛЬЦА";

const matrixCommitOf = (matrix: string) => /Проверяемый commit:\s*`([0-9a-f]{40})`/.exec(matrix.split("\n").slice(0, 8).join("\n"))?.[1];
const registryIds = (matrix: string) => tableRows(section(matrix, "Релизный реестр (D-09)")).map((row) => row[0]).filter((id) => /^SEC20-\d+$/.test(id));
const firstLine = (body: string) => body.split("\n").map((line) => line.trim()).find((line) => line.length > 0) ?? "";
const linesWith = (text: string, token: string) => text.split("\n").filter((line) => line.includes(token));
const unwrap = (cell: string) => cell.replace(/`/g, "").trim();

/** `| SEC20-NN | severity |` rows of the findings table of the matrix. */
function findingsOf(matrix: string) {
  return tableRows(section(matrix, "Находки"))
    .filter((row) => /^SEC20-\d+$/.test(row[0]))
    .map((row) => ({ id: row[0], severity: row[1] }));
}

/** Rows of the 19-REVIEW transfer table (D-33): id, status and the fixing commit. */
function d33Rows(matrix: string) {
  return tableRows(section(matrix, d33Heading))
    .filter((row) => /^[A-Z]{2}-\d+$/.test(row[0]))
    .map((row) => ({ id: row[0], status: row[3], commit: unwrap(row[4] ?? "") }));
}

/** Migration versions whose production cell still says the owner has to apply them. */
function pendingMigrationsOf(matrix: string) {
  return tableRows(section(matrix, "Миграции (охват)"))
    .filter((row) => (row[5] ?? "").includes(pendingMark))
    .map((row) => /\/(\d{14})_/.exec(unwrap(row[0]))?.[1])
    .filter((version): version is string => Boolean(version));
}

/** Rows of the owner waiver registry: id, class (fixed | expected-fault | waiver) and the owner verdict with its date. */
function waiverRows(waivers: string) {
  return tableRows(section(waivers, "Реестр"))
    .filter((row) => /^PW-\d+$/.test(row[0]))
    .map((row) => ({ id: row[0], klass: row[5], verdict: `${row[8] ?? ""} ${row[9] ?? ""}` }));
}

// Wording that promises protection. The notes may only describe limits, so these never match a correct draft.
const promisePatterns = [/гарантир/i, /защищ[её]н[аоы]? от подмены/i];

type Context = { matrix: string; waivers: string };

/** Every problem of the draft against the matrix and the waiver registry. An empty list means the draft is acceptable. */
export function notesProblems(notes: Notes, context: Context): string[] {
  const problems: string[] = [];
  const { frontmatter } = notes;
  const sectionText = (heading: string) => notes.sections.get(heading) ?? "";

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
  for (const heading of [attestationHeading, spoofHeading]) {
    if (notes.sections.has(heading) && firstLine(sectionText(heading)) !== `${heading}.`) {
      problems.push(`section «${heading}» must start with the exact sentence «${heading}.»`);
    }
  }

  const registry = registryIds(context.matrix);
  if (registry.length === 0) problems.push("matrix «Релизный реестр (D-09)» is empty or missing");
  for (const id of registry) {
    if (!sectionText(mediumHeading).includes(id)) problems.push(`${id} from the matrix «Релизный реестр (D-09)» is missing from «${mediumHeading}»`);
  }

  // Every finding of the matrix is in the draft; low and info findings sit in their own section.
  for (const { id, severity } of findingsOf(context.matrix)) {
    if (!notes.text.includes(id)) problems.push(`${id} (${severity}) is missing from the notes`);
    else if ((severity === "low" || severity === "info") && !sectionText(lowHeading).includes(id)) {
      problems.push(`${id} (${severity}) is missing from «${lowHeading}»`);
    }
  }

  // D-33: each carried-over 19-REVIEW finding keeps its status, and a fix keeps its commit.
  for (const row of d33Rows(context.matrix)) {
    const lines = linesWith(sectionText(d33Heading), row.id);
    if (lines.length === 0) {
      problems.push(`${row.id} from the matrix D-33 table is missing from «${d33Heading}»`);
      continue;
    }
    if (!lines.some((line) => line.includes(row.status))) problems.push(`${row.id}: the notes do not state the matrix status "${row.status}"`);
    if (row.status === "fixed" && !lines.some((line) => line.includes(row.commit))) problems.push(`${row.id}: the notes do not name the fixing commit ${row.commit}`);
  }

  // Every row of the owner waiver registry is mirrored with its class; a waiver without the owner's verdict stays a blocker.
  for (const row of waiverRows(context.waivers)) {
    const lines = linesWith(sectionText(playwrightHeading), row.id);
    if (lines.length === 0) {
      problems.push(`${row.id} from the waiver registry is missing from «${playwrightHeading}»`);
      continue;
    }
    const line = lines[0];
    if (!line.includes(row.klass)) problems.push(`${row.id}: the notes do not state the class "${row.klass}"`);
    if (row.klass === "waiver") {
      const accepted = /принято/i.test(row.verdict) && /\d{4}-\d{2}-\d{2}/.test(row.verdict);
      if (accepted && !/принято/i.test(line)) problems.push(`${row.id}: the owner accepted the waiver but the notes do not say "принято"`);
      if (!accepted && /принято/i.test(line)) problems.push(`${row.id}: the notes claim owner acceptance that the registry does not have`);
      if (!accepted && !/блокер/i.test(line)) problems.push(`${row.id}: a waiver without the owner's verdict must be called a blocker`);
    }
  }

  // Migrations the owner still has to apply: named, marked pending, never described as passed.
  for (const version of new Set([...pendingMigrations, ...pendingMigrationsOf(context.matrix)])) {
    const lines = linesWith(notes.text, version);
    if (lines.length === 0) {
      problems.push(`migration ${version} is missing from the notes`);
      continue;
    }
    if (!linesWith(sectionText(migrationsHeading), version).some((line) => line.includes(pendingMark))) {
      problems.push(`migration ${version} is not marked ${pendingMark} in «${migrationsHeading}»`);
    }
    if (lines.some((line) => /\bPASS\b/.test(line))) problems.push(`migration ${version}: a line that names it must not say PASS`);
  }

  for (const token of ["CR-01", "STAB-PROM-15"]) {
    if (!sectionText(inheritedHeading).includes(token)) problems.push(`${token} is missing from «${inheritedHeading}»`);
  }

  for (const pattern of promisePatterns) {
    if (pattern.test(notes.text)) problems.push(`the notes promise protection (${pattern}); describe the limit instead`);
  }

  return problems;
}

// ---------------------------------------------------------------------------------------------------------------------
// Fixtures: a minimal matrix, a waiver registry and a draft that satisfies them, then one rejected variant per rule.

const FIX_COMMIT = "a".repeat(40);
const FIX_RELEASE = "b".repeat(40);

const fixtureMatrix = [
  "# 20 — Security matrix", "", `Дата: 2026-11-04. Проверяемый commit: \`${FIX_COMMIT}\` (HEAD).`, "",
  "## Миграции (охват)", "", "| Миграция | Назначение | RLS | Ревью | Staging | Production |", "|---|---|---|---|---|---|",
  "| `supabase/migrations/20261101000000_base.sql` | база | - | - | - | Применена владельцем |",
  "| `supabase/migrations/20261104000000_classes.sql` | классы | - | - | - | ОЖИДАЕТ ВЛАДЕЛЬЦА |",
  "| `supabase/migrations/20261104000100_notes.sql` | заметки | - | - | - | ОЖИДАЕТ ВЛАДЕЛЬЦА |", "",
  "## Находки", "", "| ID | Severity | Area | Source | Evidence | Status | Fix | Owner |", "|---|---|---|---|---|---|---|---|",
  "| SEC20-01 | medium | auth | s | e | release-ledger | f | o |", "| SEC20-02 | low | api | s | e | recorded | f | o |",
  "| SEC20-11 | info | rls | s | e | recorded | f | o |", "| SEC20-16 | medium | api | s | e | release-ledger | f | o |",
  "| SEC20-17 | medium | auth | s | e | release-ledger | f | o |", "",
  "## Релизный реестр (D-09)", "", "| ID | Что указать в release notes |", "|---|---|",
  "| SEC20-01 | Оракул email принят. |", "| SEC20-16 | Начальный режим теста подделываем. |", "| SEC20-17 | Привязка устройства не является аппаратной аттестацией. |", "",
  "## Перенесённые находки 19-REVIEW (D-33)", "", "| ID | Severity | Файл | Статус | Коммит | Тест | Правило | Обоснование |", "|---|---|---|---|---|---|---|---|",
  "| WR-03 | Warning | `f.ts` | fixed | `2bb0b38` | t | — | o |", "| IN-05 | Info | `g.ts` | disposition | — | нет | D-09 | o |", "",
].join("\n");

const fixtureWaivers = [
  "# реестр", "", "## Реестр", "",
  "| ID | Спек | Проект | Наблюдение | Причина | Класс | Изменение | Команда | Вердикт владельца | Дата |", "|----|---|---|---|---|---|---|---|---|---|",
  "| PW-01 | s | p | o | c | fixed | ch | cmd | не требуется (fixed) | 2026-11-04 |",
  "| PW-07 | s | p | o | c | waiver | ch | cmd | принято (владелец, 2026-11-04) | 2026-11-04 |",
  "| PW-10 | s | p | o | c | waiver | ch | cmd | ОЖИДАЕТ ВЛАДЕЛЬЦА | 2026-11-04 |", "",
].join("\n");

const defaultBlocks: Record<string, string> = {
  [spoofHeading]: `${spoofHeading}.\n\nРежим задаёт отправитель запроса (SEC20-16).`,
  [attestationHeading]: `${attestationHeading}.\n\nCookie с токеном и грубые бакеты (SEC20-17).`,
  [mediumHeading]: "| ID | Что принято |\n|---|---|\n| SEC20-01 | Оракул email принят. |\n| SEC20-16 | Начальный режим теста подделываем. |\n| SEC20-17 | Привязка устройства не является аппаратной аттестацией. |",
  [lowHeading]: "| ID | Суть |\n|---|---|\n| SEC20-02 | Сбой auth даёт 403 вместо 503 (recorded). |\n| SEC20-11 | Платформенная функция (recorded). |",
  [d33Heading]: "| ID | Статус |\n|---|---|\n| WR-03 | fixed, `2bb0b38` |\n| IN-05 | disposition, D-09 |",
  [dependenciesHeading]: "Production audit 0; 16 moderate только в dev.",
  [cspHeading]: "Enforced CSP сохраняет `unsafe-inline`; HSTS на опубликованном HTTPS не проверялся.",
  [migrationsHeading]: `- \`20261104000000\`: ${pendingMark}.\n- \`20261104000100\`: ${pendingMark}.`,
  [playwrightHeading]: "| ID | Класс | Вердикт |\n|---|---|---|\n| PW-01 | fixed | не требуется |\n| PW-07 | waiver | принято (владелец, 2026-11-04) |\n| PW-10 | waiver | блокер: ОЖИДАЕТ ВЛАДЕЛЬЦА |",
  [outsideHeading]: "- 97d7abb: сохранение банка без проверки пула.",
  [inheritedHeading]: "- CR-01 не закрыт.\n- STAB-PROM-15 не закрыт.\n- BLOCKED (DATA): нет данных на staging.",
  [unprovenHeading]: "- Физические устройства.",
};

function fixtureNotes(over: { status?: string; release?: string; matrixCommit?: string; blocks?: Record<string, string>; drop?: string[]; extra?: string } = {}) {
  const blocks = { ...defaultBlocks, ...over.blocks };
  for (const heading of over.drop ?? []) delete blocks[heading];
  return [
    "---", `status: ${over.status ?? "draft"}`, `release_commit: ${over.release ?? "ОЖИДАЕТ 20-15"}`, `matrix_commit: ${over.matrixCommit ?? FIX_COMMIT}`, "---", "", "# Release notes", "",
    ...Object.entries(blocks).map(([heading, body]) => `## ${heading}\n\n${body}\n`), over.extra ?? "",
  ].join("\n");
}

const check = (text: string, matrix = fixtureMatrix, waivers = fixtureWaivers) => notesProblems(parseNotes(text), { matrix, waivers });
const swap = (text: string, from: string, to: string) => {
  assert.ok(text.includes(from), `fixture text lost «${from}»`);
  return text.replace(from, to);
};

test("parseNotes reads the frontmatter and splits the notes into sections by heading", () => {
  const notes = parseNotes(fixtureNotes());
  assert.equal(notes.frontmatter.status, "draft");
  assert.equal(notes.frontmatter.release_commit, "ОЖИДАЕТ 20-15");
  assert.equal(notes.frontmatter.matrix_commit, FIX_COMMIT);
  assert.deepEqual([...notes.sections.keys()], requiredSections);
  assert.match(notes.sections.get(mediumHeading)!, /SEC20-17/);
  assert.deepEqual(parseNotes("без frontmatter\n").frontmatter, {});
});

test("matrix readers: findings, D-33 rows, pending migrations and waiver rows come out of the fixtures", () => {
  assert.deepEqual(findingsOf(fixtureMatrix).map((row) => `${row.id}:${row.severity}`), ["SEC20-01:medium", "SEC20-02:low", "SEC20-11:info", "SEC20-16:medium", "SEC20-17:medium"]);
  assert.deepEqual(d33Rows(fixtureMatrix), [{ id: "WR-03", status: "fixed", commit: "2bb0b38" }, { id: "IN-05", status: "disposition", commit: "—" }]);
  assert.deepEqual(pendingMigrationsOf(fixtureMatrix), pendingMigrations);
  assert.deepEqual(waiverRows(fixtureWaivers).map((row) => `${row.id}:${row.klass}`), ["PW-01:fixed", "PW-07:waiver", "PW-10:waiver"]);
});

test("notesProblems: the complete fixture draft is accepted", () => {
  assert.deepEqual(check(fixtureNotes()), []);
});

test("notesProblems fixture: a draft without the device attestation section is rejected", () => {
  assert.deepEqual(check(fixtureNotes({ drop: [attestationHeading] })), [`missing section: ${attestationHeading}`]);
});

test("notesProblems fixture: every required section is checked", () => {
  for (const heading of requiredSections.filter((name) => name !== attestationHeading && name !== spoofHeading && name !== mediumHeading)) {
    assert.ok(check(fixtureNotes({ drop: [heading] })).includes(`missing section: ${heading}`), heading);
  }
});

test("notesProblems fixture: a draft that omits one ID of the D-09 release registry is rejected", () => {
  const blocks = { [mediumHeading]: "| SEC20-01 | Оракул email принят. |\n| SEC20-16 | Начальный режим теста подделываем. |" };
  assert.deepEqual(check(fixtureNotes({ blocks })), [`SEC20-17 from the matrix «Релизный реестр (D-09)» is missing from «${mediumHeading}»`]);
});

test("notesProblems fixture: a matrix_commit that is not the matrix «Проверяемый commit» is a stale draft", () => {
  const problems = check(fixtureNotes({ matrixCommit: "c".repeat(40) }));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /^stale notes: matrix_commit c{40} is not the matrix «Проверяемый commit» a{40}$/);
  assert.match(check(fixtureNotes().replace(/matrix_commit: .*\n/, ""))[0], /^stale notes: matrix_commit \(missing\)/);
  assert.deepEqual(check(fixtureNotes(), "# матрица без commit\n").slice(0, 2), ["matrix has no 40-hex «Проверяемый commit»", "matrix «Релизный реестр (D-09)» is empty or missing"]);
});

test("notesProblems fixture: status must be draft or final, and final needs a 40-hex release_commit", () => {
  assert.deepEqual(check(fixtureNotes({ status: "ready" })), ['status must be draft or final, got "ready"']);
  assert.deepEqual(check(fixtureNotes({ status: "final" })), ["status final needs a 40-hex release_commit"]);
  assert.deepEqual(check(fixtureNotes({ status: "final", release: "abc123" })), ["status final needs a 40-hex release_commit"]);
  assert.deepEqual(check(fixtureNotes({ status: "final", release: FIX_RELEASE })), []);
});

test("notesProblems fixture: the two limit sections must open with their exact sentence", () => {
  const wrongAttestation = fixtureNotes({ blocks: { [attestationHeading]: "Привязка устройства надёжна.\n\nCookie." } });
  assert.deepEqual(check(wrongAttestation), [`section «${attestationHeading}» must start with the exact sentence «${attestationHeading}.»`]);
  const wrongSpoof = fixtureNotes({ blocks: { [spoofHeading]: "Режим задаёт отправитель запроса." } });
  assert.deepEqual(check(wrongSpoof), [`section «${spoofHeading}» must start with the exact sentence «${spoofHeading}.»`]);
});

test("notesProblems fixture: wording that promises protection is rejected", () => {
  const promised = check(fixtureNotes({ extra: "Мы гарантируем честный тест.\n" }));
  assert.equal(promised.length, 1);
  assert.match(promised[0], /promise protection/);
  assert.equal(check(fixtureNotes({ extra: "Режим защищён от подмены.\n" })).length, 1);
  assert.equal(check(fixtureNotes({ extra: "Режим защищена от подмены.\n" })).length, 1);
  assert.deepEqual(check(fixtureNotes({ extra: "Режим можно подменить, защиты нет.\n" })), []);
});

test("notesProblems fixture: a finding of the matrix that the draft never mentions is rejected, low and info belong to their section", () => {
  const dropped = swap(defaultBlocks[lowHeading], "| SEC20-02 | Сбой auth даёт 403 вместо 503 (recorded). |\n", "");
  assert.deepEqual(check(fixtureNotes({ blocks: { [lowHeading]: dropped } })), ["SEC20-02 (low) is missing from the notes"]);
  const moved = fixtureNotes({ blocks: { [lowHeading]: dropped, [dependenciesHeading]: "SEC20-02 упомянут не там." } });
  assert.deepEqual(check(moved), [`SEC20-02 (low) is missing from «${lowHeading}»`]);
  const noInfo = swap(defaultBlocks[lowHeading], "\n| SEC20-11 | Платформенная функция (recorded). |", "");
  assert.deepEqual(check(fixtureNotes({ blocks: { [lowHeading]: noInfo } })), ["SEC20-11 (info) is missing from the notes"]);
});

test("notesProblems fixture: a carried 19-REVIEW finding keeps its status, and a fix keeps its commit", () => {
  const noWr = swap(defaultBlocks[d33Heading], "| WR-03 | fixed, `2bb0b38` |\n", "");
  assert.deepEqual(check(fixtureNotes({ blocks: { [d33Heading]: noWr } })), [`WR-03 from the matrix D-33 table is missing from «${d33Heading}»`]);
  const noCommit = swap(defaultBlocks[d33Heading], "| WR-03 | fixed, `2bb0b38` |", "| WR-03 | fixed |");
  assert.deepEqual(check(fixtureNotes({ blocks: { [d33Heading]: noCommit } })), ["WR-03: the notes do not name the fixing commit 2bb0b38"]);
  const noStatus = swap(defaultBlocks[d33Heading], "| IN-05 | disposition, D-09 |", "| IN-05 | оставлено |");
  assert.deepEqual(check(fixtureNotes({ blocks: { [d33Heading]: noStatus } })), ['IN-05: the notes do not state the matrix status "disposition"']);
});

test("notesProblems fixture: every waiver registry row is mirrored with its class, and a waiver without a verdict is a blocker", () => {
  const noRow = swap(defaultBlocks[playwrightHeading], "\n| PW-01 | fixed | не требуется |", "");
  assert.deepEqual(check(fixtureNotes({ blocks: { [playwrightHeading]: noRow } })), [`PW-01 from the waiver registry is missing from «${playwrightHeading}»`]);
  const wrongClass = swap(defaultBlocks[playwrightHeading], "| PW-01 | fixed |", "| PW-01 | expected-fault |");
  assert.deepEqual(check(fixtureNotes({ blocks: { [playwrightHeading]: wrongClass } })), ['PW-01: the notes do not state the class "fixed"']);
  const softened = swap(defaultBlocks[playwrightHeading], "| PW-10 | waiver | блокер: ОЖИДАЕТ ВЛАДЕЛЬЦА |", "| PW-10 | waiver | ОЖИДАЕТ ВЛАДЕЛЬЦА |");
  assert.deepEqual(check(fixtureNotes({ blocks: { [playwrightHeading]: softened } })), ["PW-10: a waiver without the owner's verdict must be called a blocker"]);
  const invented = swap(defaultBlocks[playwrightHeading], "| PW-10 | waiver | блокер: ОЖИДАЕТ ВЛАДЕЛЬЦА |", "| PW-10 | waiver | принято |");
  assert.deepEqual(check(fixtureNotes({ blocks: { [playwrightHeading]: invented } })), [
    "PW-10: the notes claim owner acceptance that the registry does not have", "PW-10: a waiver without the owner's verdict must be called a blocker",
  ]);
  const forgotten = swap(defaultBlocks[playwrightHeading], "| PW-07 | waiver | принято (владелец, 2026-11-04) |", "| PW-07 | waiver | см. реестр |");
  assert.deepEqual(check(fixtureNotes({ blocks: { [playwrightHeading]: forgotten } })), ['PW-07: the owner accepted the waiver but the notes do not say "принято"']);
});

test("notesProblems fixture: both pending migrations are named, marked pending and never described as passed", () => {
  const unnamed = fixtureNotes({ blocks: { [migrationsHeading]: `- \`20261104000000\`: ${pendingMark}.` } });
  assert.deepEqual(check(unnamed), ["migration 20261104000100 is missing from the notes"]);
  const unmarked = fixtureNotes({ blocks: { [migrationsHeading]: `- \`20261104000000\`: ${pendingMark}.\n- \`20261104000100\`: применена.` } });
  assert.deepEqual(check(unmarked), [`migration 20261104000100 is not marked ${pendingMark} in «${migrationsHeading}»`]);
  const passed = fixtureNotes({ blocks: { [migrationsHeading]: `- \`20261104000000\`: ${pendingMark}.\n- \`20261104000100\`: ${pendingMark}; на production PASS.` } });
  assert.deepEqual(check(passed), ["migration 20261104000100: a line that names it must not say PASS"]);
  const elsewhere = fixtureNotes({ extra: "20261104000000 PASS на staging.\n" });
  assert.deepEqual(check(elsewhere), ["migration 20261104000000: a line that names it must not say PASS"]);
  assert.deepEqual(check(fixtureNotes({ blocks: { [migrationsHeading]: `- \`20261104000000\`: ${pendingMark}; прошло на staging.\n- \`20261104000100\`: ${pendingMark}.` } })), []);
});

test("notesProblems fixture: the inherited Phase 19 gaps CR-01 and STAB-PROM-15 must be named", () => {
  assert.deepEqual(check(fixtureNotes({ blocks: { [inheritedHeading]: "- STAB-PROM-15 не закрыт." } })), [`CR-01 is missing from «${inheritedHeading}»`]);
  assert.deepEqual(check(fixtureNotes({ blocks: { [inheritedHeading]: "- CR-01 не закрыт." } })), [`STAB-PROM-15 is missing from «${inheritedHeading}»`]);
});

test("the real release notes draft is consistent with the real security matrix and waiver registry", () => {
  const matrix = read(`${phaseDir}/20-SECURITY-MATRIX.md`);
  const waivers = read(`${phaseDir}/20-PLAYWRIGHT-WAIVERS.md`);
  const notes = parseNotes(read(`${phaseDir}/20-RELEASE-NOTES.md`));
  // 20-15: the notes are final and bound to the final release commit of the reconciliation (D-70 revision).
  assert.equal(notes.frontmatter.status, "final");
  assert.equal(notes.frontmatter.release_commit, /^final_release_commit: ([0-9a-f]{40})$/m.exec(read(`${phaseDir}/20-RECONCILIATION.md`))?.[1]);
  assert.ok(findingsOf(matrix).length >= 25, "the matrix has at least the 25 findings SEC20-01..SEC20-25");
  assert.ok(waiverRows(waivers).length >= 10, "the waiver registry has at least PW-01..PW-10");
  assert.deepEqual(d33Rows(matrix).map((row) => row.id), ["WR-03", "WR-05", "IN-01", "IN-02", "IN-03", "IN-04", "IN-05"]);
  assert.deepEqual(pendingMigrationsOf(matrix), realPendingMigrations);
  assert.deepEqual(notesProblems(notes, { matrix, waivers }), []);
});
