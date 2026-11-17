// Phase 6 check: a *-REVIEW-DISPOSITION.md keeps frontmatter, table and counts in step.
// Usage: node 06-check-disposition.cjs <file>...  Prints OK/FAIL per file; exit 1 on any FAIL.
const fs = require("fs");
const statuses = ["open", "fixed", "skipped", "deferred"];
const footer = "Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.";
let bad = 0;
for (const file of process.argv.slice(2)) {
  const text = fs.readFileSync(file, "utf8").replace(/\r/g, "");
  const front = text.slice(0, text.indexOf("\n---\n", 4));
  const ids = new Map([...front.matchAll(/^  - id: (\S+)\n    severity: \S+\n    disposition: (\S+)/gm)].map((m) => [m[1], m[2]]));
  const rows = text.split("\n").filter((line) => /^\| [A-Z]{2}-\d/.test(line)).map((line) => line.split("|").map((cell) => cell.trim()));
  const open = Number((front.match(/^open: (\d+)$/m) || [])[1]);
  const total = Number((front.match(/^total: (\d+)$/m) || [])[1]);
  const errors = [];
  // A `|` inside a Source cell adds a column; the review gate escapes it on its next run.
  if (rows.some((row) => row.length !== 6)) errors.push("a row has an extra | (pipe in a Source cell)");
  if (rows.length !== ids.size || rows.length !== total) errors.push(`rows ${rows.length}, frontmatter ids ${ids.size}, total: ${total}`);
  for (const [, id, , status, source] of rows) {
    if (!statuses.includes(status)) errors.push(`${id}: status "${status}" is not one of ${statuses.join("/")}`);
    if (ids.get(id) !== status) errors.push(`${id}: frontmatter says ${ids.get(id)}, table says ${status}`);
    if (status !== "open" && (source === "" || source === "-")) errors.push(`${id}: ${status} without a Source`);
  }
  const openRows = rows.filter((row) => row[3] === "open").length;
  if (openRows !== open) errors.push(`open: ${open} but ${openRows} open rows`);
  if (!text.includes(footer)) errors.push("status footer missing");
  if (errors.length) {
    bad = 1;
    console.log(`FAIL ${file}: ${errors.join("; ")}`);
  } else console.log(`OK ${file} open=${openRows} total=${rows.length}`);
}
process.exit(bad);
