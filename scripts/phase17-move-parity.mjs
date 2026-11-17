import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Phase 17: an increment is accepted only if every line that left the source arrived unchanged in the targets.
const DECLARATION = /^export (?=(?:async function|function|const|let|type|interface|class)\b)/;

export function codeLines(text) {
  const lines = [];
  let inImport = false;
  for (const raw of text.replaceAll("\r\n", "\n").split("\n")) {
    const line = raw.trimEnd();
    if (inImport || line.startsWith("import ")) {
      inImport = !(line.includes('from "') || line.endsWith('";'));
      continue;
    }
    if (line === "" || line === '"use client";') continue;
    lines.push(line.replace(DECLARATION, ""));
  }
  return lines;
}

function counts(lines) {
  const map = new Map();
  for (const line of lines) map.set(line, (map.get(line) ?? 0) + 1);
  return map;
}

// Multiset difference a - b as a list of lines.
function minus(a, b) {
  const rest = counts(b);
  const out = [];
  for (const line of a) {
    const left = rest.get(line) ?? 0;
    if (left > 0) rest.set(line, left - 1);
    else out.push(line);
  }
  return out;
}

export function moveProblems({ sourceBefore, sourceAfter, targets }) {
  const before = codeLines(sourceBefore);
  const after = codeLines(sourceAfter);
  const left = minus(before, after);
  const problems = minus(after, before).map((line) => `problem: source gained: ${line}`);
  const arrived = targets.flatMap((target) => minus(codeLines(target.after), codeLines(target.before)));
  problems.push(...minus(left, arrived).map((line) => `problem: missing in target: ${line}`));
  problems.push(...minus(arrived, left).map((line) => `problem: not from source: ${line}`));
  if (left.length === 0) problems.push("problem: nothing moved");
  return problems;
}

function gitShow(ref, file) {
  try {
    return execFileSync("git", ["show", `${ref}:${file.replaceAll("\\", "/")}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    return "";
  }
}

function runCli(argv) {
  let from;
  let ref = "HEAD";
  const to = [];
  for (let i = 0; i < argv.length; i += 2) {
    const value = argv[i + 1];
    if (value === undefined) break;
    if (argv[i] === "--from") from = value;
    else if (argv[i] === "--to") to.push(value);
    else if (argv[i] === "--ref") ref = value;
  }
  if (!from || to.length === 0) {
    process.stderr.write("usage: phase17-move-parity.mjs --from <path> --to <path> [--to <path>...] [--ref <rev>]\n");
    process.exit(2);
  }
  const sourceBefore = gitShow(ref, from);
  const sourceAfter = readFileSync(from, "utf8");
  const targets = to.map((file) => ({ before: gitShow(ref, file), after: readFileSync(file, "utf8") }));
  const problems = moveProblems({ sourceBefore, sourceAfter, targets });
  if (problems.length > 0) {
    process.stdout.write(problems.join("\n") + "\n");
    process.exit(1);
  }
  const moved = minus(codeLines(sourceBefore), codeLines(sourceAfter)).length;
  process.stdout.write(`pure move: ${moved} lines ${from} -> ${to.join(",")}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli(process.argv.slice(2));
}
