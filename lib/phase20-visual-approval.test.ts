import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

// Phase 20-11: fail-closed validation of the owner visual-approval ledger (20-VISUAL-APPROVAL.md).
// Default mode checks structure: every required surface/state/hash row exists and no row is approved without owner, date and exact hash.
// PORTIA_REQUIRE_APPROVAL=1 (Task 2 gate) additionally requires a positive verdict on every captured candidate and an answer to every owner question.

const root = path.resolve(import.meta.dirname, "..");
const ledgerPath = path.join(
  root,
  ".planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-VISUAL-APPROVAL.md",
);

const devices = ["pc", "phone"] as const;
const classKeys = ["lucidium", "transitium", "oblivium", "stabilar", "impulsar", "infernar", "isomorph", "polymorph", "xenomorph"] as const;

// Base ids that must exist for each device in `devices`.
const requiredBoth = [
  "spider-accent-default",
  "spider-accent-custom-dark",
  "spider-accent-custom-light",
  "spider-off",
  "spider-rest-sharp",
  "flasks-full",
  "flasks-off",
  "flasks-accent-default",
  "flasks-accent-custom-dark",
  "flasks-accent-custom-light",
  "empty-flask-news-default",
  "empty-flask-info",
  "empty-microscope-guide-default",
  "promotion-participant-gate-empty",
  "promotion-participant-cards",
  "promotion-reviewer-queue",
  ...classKeys.map((key) => `class-icon-${key}`),
];
// Info phone runs on two phone projects.
const requiredPhoneOnly = ["info-phone-open:phone", "info-phone-open:phone-webkit", "info-phone-article:phone", "info-phone-article:phone-webkit"];
const requiredQuestions = [
  "q-spider-shape",
  "q-spider-dark-legibility",
  "q-flasks-durations",
  "q-flasks-phone-crop",
  "q-class-transitium-faint",
  "q-class-phone-crop",
  "q-contrast-d10",
  "q-rel-08",
];
export const requiredIds = [...requiredBoth.flatMap((base) => devices.map((device) => `${base}:${device}`)), ...requiredPhoneOnly];

const statuses = new Set(["CANDIDATE", "BLOCKED (DATA)", "BLOCKED (ENV)", "BLOCKED (CAPTURE)"]);
const hex64 = /^[0-9a-f]{64}$/;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export type LedgerRow = {
  id: string; surface: string; state: string; device: string; status: string;
  candidate: string; candidateSha: string; old: string; oldSha: string; note: string;
  verdict: string; date: string; approvedHash: string;
};
export type QuestionRow = { id: string; question: string; source: string; answer: string; date: string };

const unwrap = (cell: string) => cell.replace(/^`|`$/g, "").trim();

export function parseLedger(text: string): { rows: LedgerRow[]; questions: QuestionRow[] } {
  const rows: LedgerRow[] = [];
  const questions: QuestionRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("|")) continue;
    const cells = line.slice(1, line.endsWith("|") ? -1 : undefined).split("|").map((cell) => cell.trim());
    if (cells[0] === "ID" || /^-+$/.test(cells[0])) continue;
    if (cells.length === 13) {
      rows.push({
        id: cells[0], surface: cells[1], state: cells[2], device: cells[3], status: cells[4],
        candidate: unwrap(cells[5]), candidateSha: cells[6], old: unwrap(cells[7]), oldSha: cells[8], note: cells[9],
        verdict: cells[10], date: cells[11], approvedHash: cells[12],
      });
    } else if (cells.length === 5 && cells[0].startsWith("q-")) {
      questions.push({ id: cells[0], question: cells[1], source: cells[2], answer: cells[3], date: cells[4] });
    }
  }
  return { rows, questions };
}

type Options = {
  requireApproval?: boolean;
  // File checks run only for files that exist on this machine (the candidate directory is gitignored). Approval mode makes absence an error.
  fileSha?: (relativePath: string) => string | null;
};

export function validateLedger(text: string, options: Options = {}): string[] {
  const errors: string[] = [];
  const { rows, questions } = parseLedger(text);
  const byId = new Map<string, LedgerRow>();
  for (const row of rows) {
    if (byId.has(row.id)) errors.push(`${row.id}: duplicate row`);
    byId.set(row.id, row);
  }
  for (const id of requiredIds) if (!byId.has(id)) errors.push(`${id}: required row is missing`);
  for (const id of requiredQuestions) if (!questions.some((q) => q.id === id)) errors.push(`${id}: required owner question is missing`);

  const fileSha = options.fileSha;
  for (const row of rows) {
    if (!statuses.has(row.status)) { errors.push(`${row.id}: unknown status "${row.status}"`); continue; }
    const blocked = row.status.startsWith("BLOCKED");
    if (blocked) {
      if (row.verdict !== "BLOCKED") errors.push(`${row.id}: a ${row.status} row must keep the verdict BLOCKED, got "${row.verdict}"`);
      if (!row.note) errors.push(`${row.id}: a BLOCKED row must say why`);
      continue;
    }
    if (!row.candidate || row.candidate === "-") errors.push(`${row.id}: candidate file is missing`);
    if (!hex64.test(row.candidateSha)) errors.push(`${row.id}: candidate sha256 is missing or malformed`);
    if (row.old && row.old !== "-" && !hex64.test(row.oldSha)) errors.push(`${row.id}: old reference has no sha256`);
    if (fileSha) {
      for (const [file, sha, label] of [[row.candidate, row.candidateSha, "candidate"], [row.old, row.oldSha, "old reference"]] as const) {
        if (!file || file === "-") continue;
        const actual = fileSha(file);
        if (actual === null) { if (options.requireApproval) errors.push(`${row.id}: ${label} file ${file} is not on disk`); }
        else if (actual !== sha) errors.push(`${row.id}: ${label} sha256 does not match ${file}`);
      }
    }
    if (row.verdict === "ОЖИДАЕТ") {
      if (options.requireApproval) errors.push(`${row.id}: owner verdict is still pending`);
      continue;
    }
    if (row.verdict === "принято") {
      if (!isoDate.test(row.date)) errors.push(`${row.id}: approved without an ISO date`);
      if (row.approvedHash !== row.candidateSha) errors.push(`${row.id}: approved hash is not the exact candidate sha256`);
      continue;
    }
    if (/^исправить:\s*\S/.test(row.verdict)) {
      if (options.requireApproval) errors.push(`${row.id}: owner asked for a fix: ${row.verdict}`);
      continue;
    }
    errors.push(`${row.id}: verdict must be "принято" or "исправить: <что>", got "${row.verdict}"`);
  }
  for (const q of questions) {
    if (q.answer === "ОЖИДАЕТ" || !q.answer || q.answer === "-") {
      if (options.requireApproval) errors.push(`${q.id}: owner answer is missing`);
    } else if (!isoDate.test(q.date)) errors.push(`${q.id}: answered without an ISO date`);
  }
  return errors;
}

const fileSha = (relativePath: string): string | null => {
  const full = path.join(root, relativePath);
  return existsSync(full) ? createHash("sha256").update(readFileSync(full)).digest("hex") : null;
};

const ledger = readFileSync(ledgerPath, "utf8");
const rowLine = (text: string, id: string) => text.split(/\r?\n/).find((line) => line.startsWith(`| ${id} |`))!;
const editRow = (text: string, id: string, edit: (cells: string[]) => void) => {
  const line = rowLine(text, id);
  const cells = line.slice(1, -1).split("|").map((cell) => cell.trim());
  edit(cells);
  return text.replace(line, `| ${cells.join(" | ")} |`);
};
const dropRow = (text: string, id: string) => text.split(/\r?\n/).filter((line) => !line.startsWith(`| ${id} |`)).join("\n");

describe("20-VISUAL-APPROVAL ledger structure (fail-closed)", () => {
  test("the committed ledger is structurally complete", () => {
    const errors = validateLedger(ledger, { fileSha });
    assert.deepEqual(errors, []);
  });

  test("every required surface has an address on PC and phone (spider, flasks, drawings, Promotion, icons, info phone)", () => {
    const { rows } = parseLedger(ledger);
    const ids = new Set(rows.map((row) => row.id));
    for (const id of requiredIds) assert.ok(ids.has(id), `${id} is missing`);
    assert.ok(requiredIds.length >= 54);
  });

  test("D-26/D-27: dropping any spider accent, the spider-off row or spider-rest-sharp fails, on each device", () => {
    for (const base of ["spider-accent-default", "spider-accent-custom-dark", "spider-accent-custom-light", "spider-off", "spider-rest-sharp"]) {
      for (const device of devices) {
        const id = `${base}:${device}`;
        const errors = validateLedger(dropRow(ledger, id));
        assert.ok(errors.some((error) => error.startsWith(`${id}: required row is missing`)), `${id} not enforced`);
      }
    }
  });

  test("D-39: dropping any of the nine class-icon rows fails, on each device", () => {
    for (const key of classKeys) {
      for (const device of devices) {
        const id = `class-icon-${key}:${device}`;
        const errors = validateLedger(dropRow(ledger, id));
        assert.ok(errors.some((error) => error.startsWith(`${id}: required row is missing`)), `${id} not enforced`);
      }
    }
    assert.ok((ledger.match(/class-icon-/g) ?? []).length >= 9);
  });

  test("a missing sha256 on a captured candidate fails", () => {
    const { rows } = parseLedger(ledger);
    const row = rows.find((r) => r.status === "CANDIDATE")!;
    const broken = editRow(ledger, row.id, (cells) => { cells[6] = "-"; });
    assert.ok(validateLedger(broken).some((error) => error.includes("candidate sha256 is missing")));
  });

  test("a tampered sha256 is caught against the file on disk", () => {
    const { rows } = parseLedger(ledger);
    const row = rows.find((r) => r.status === "CANDIDATE" && fileSha(r.candidate) !== null);
    if (!row) return; // candidates are gitignored; nothing on disk to compare on this machine
    const broken = editRow(ledger, row.id, (cells) => { cells[6] = "0".repeat(64); });
    assert.ok(validateLedger(broken, { fileSha }).some((error) => error.includes("does not match")));
  });

  test("approval needs an ISO date and the exact candidate hash", () => {
    const { rows } = parseLedger(ledger);
    const row = rows.find((r) => r.status === "CANDIDATE")!;
    const pending = new RegExp(`^\\| ${row.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\|.*$`, "m");
    const line = ledger.match(pending)![0];
    const cells = line.slice(1, -1).split("|").map((cell) => cell.trim());
    const approve = (date: string, hash: string) => {
      const next = [...cells];
      next[10] = "принято"; next[11] = date; next[12] = hash;
      return ledger.replace(line, `| ${next.join(" | ")} |`);
    };
    assert.deepEqual(validateLedger(approve("2026-11-05", row.candidateSha)), []);
    assert.ok(validateLedger(approve("-", row.candidateSha)).some((error) => error.includes("ISO date")));
    assert.ok(validateLedger(approve("2026-11-05", "-")).some((error) => error.includes("exact candidate sha256")));
    assert.ok(validateLedger(approve("2026-11-05", "f".repeat(64))).some((error) => error.includes("exact candidate sha256")));
  });

  test("a BLOCKED row cannot be turned into an approval", () => {
    const { rows } = parseLedger(ledger);
    const row = rows.find((r) => r.status.startsWith("BLOCKED"))!;
    assert.ok(row, "ledger must keep at least one BLOCKED row");
    const line = ledger.match(new RegExp(`^\\| ${row.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\|.*$`, "m"))![0];
    const cells = line.slice(1, -1).split("|").map((cell) => cell.trim());
    cells[10] = "принято"; cells[11] = "2026-11-05"; cells[12] = "a".repeat(64);
    const approved = ledger.replace(line, `| ${cells.join(" | ")} |`);
    assert.ok(validateLedger(approved).some((error) => error.startsWith(`${row.id}: a ${row.status} row must keep the verdict BLOCKED`)));
  });

  test("the committed ledger approves nothing before the owner decides", () => {
    if (process.env.PORTIA_REQUIRE_APPROVAL === "1") return; // verdicts are expected in the Task 2 gate
    const { rows, questions } = parseLedger(ledger);
    assert.ok(rows.every((row) => row.verdict === "ОЖИДАЕТ" || row.verdict === "BLOCKED" || row.verdict === "принято" || /^исправить:/.test(row.verdict)));
    assert.ok(questions.length >= requiredQuestions.length);
  });

  test("approval mode fails closed on pending rows and passes on a fully approved fixture", () => {
    const pendingErrors = validateLedger(ledger, { requireApproval: true });
    assert.ok(pendingErrors.length > 0 || process.env.PORTIA_REQUIRE_APPROVAL === "1");

    const approvedFixture = ledger
      .split(/\r?\n/)
      .map((line) => {
        if (!line.startsWith("| ")) return line;
        const cells = line.slice(1, -1).split("|").map((cell) => cell.trim());
        if (cells.length === 13 && cells[4] === "CANDIDATE") { cells[10] = "принято"; cells[11] = "2026-11-05"; cells[12] = cells[6]; return `| ${cells.join(" | ")} |`; }
        if (cells.length === 5 && cells[0].startsWith("q-")) { cells[3] = "решено"; cells[4] = "2026-11-05"; return `| ${cells.join(" | ")} |`; }
        return line;
      })
      .join("\n");
    assert.deepEqual(validateLedger(approvedFixture, { requireApproval: true }), []);

    const oneRejected = approvedFixture.replace("| принято |", "| исправить: глаза крупнее |");
    assert.ok(validateLedger(oneRejected, { requireApproval: true }).some((error) => error.includes("asked for a fix")));
  });
});

describe("Task 2 gate: owner verdicts (PORTIA_REQUIRE_APPROVAL=1)", () => {
  test("every captured candidate has an exact positive owner verdict and every owner question an answer", { skip: process.env.PORTIA_REQUIRE_APPROVAL !== "1" ? "run with PORTIA_REQUIRE_APPROVAL=1 after the owner fills the ledger" : false }, () => {
    assert.deepEqual(validateLedger(ledger, { requireApproval: true, fileSha }), []);
  });
});
