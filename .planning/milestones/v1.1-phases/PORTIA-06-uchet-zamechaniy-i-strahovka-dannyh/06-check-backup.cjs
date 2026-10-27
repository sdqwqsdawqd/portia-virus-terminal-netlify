// Phase 6 check: each owner export parses as JSON and holds a list of rows. Prints row counts only, never data.
// Accepts the bare json_agg value (array or null) and the SQL editor's "Copy as JSON" wrapper [{"json_agg": ...}].
// Usage: node 06-check-backup.cjs <file>...  Exit 1 if any file is missing, truncated or not a row list.
const fs = require("fs");
let bad = 0;
for (const file of process.argv.slice(2)) {
  let value;
  try {
    // trimStart also drops the byte-order mark Notepad may add.
    value = JSON.parse(fs.readFileSync(file, "utf8").trimStart());
  } catch {
    // The parser's message quotes file content, so it is not printed.
    console.log(`FAIL ${file}: unreadable or not valid JSON`);
    bad = 1;
    continue;
  }
  if (Array.isArray(value) && value.length === 1 && value[0] && typeof value[0] === "object" && "json_agg" in value[0]) value = value[0].json_agg;
  else if (value && typeof value === "object" && !Array.isArray(value) && "json_agg" in value) value = value.json_agg;
  if (value !== null && !Array.isArray(value)) {
    console.log(`FAIL ${file}: not a list of rows`);
    bad = 1;
    continue;
  }
  // json_agg over an empty table is null: zero rows, not a failed export.
  console.log(`OK ${file} rows=${value ? value.length : 0}`);
}
process.exit(bad);
