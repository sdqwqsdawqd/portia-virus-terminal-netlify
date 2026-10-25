// Phase 9 check: the normalizer repairs the owner's content export and never deletes from it (STATE Phase 9 blocker).
// Usage: node --experimental-strip-types 09-check-normalize-backup.mjs <export file>
// Reads only; prints counts, lengths and booleans, never content. Exit 1 when any normalized number is lower than its raw
// number, when a second pass changes the result, or when the payload exceeds MAX_CONTENT_BODY_BYTES.
import fs from "node:fs";
import { MAX_CONTENT_BODY_BYTES, MAX_SCIENTIST_LOGS, utf8Bytes } from "../../../lib/content-limits.ts";
import { normalizePortiaContent } from "../../../lib/portia-content-normalize.ts";

const file = process.argv[2];
let value;
try {
  // trimStart also drops the byte-order mark Notepad may add.
  value = JSON.parse(fs.readFileSync(file, "utf8").trimStart());
} catch {
  // The parser's message quotes file content, so it is not printed.
  console.log("FAIL: export unreadable or not valid JSON");
  process.exit(1);
}
// Accept the bare row list and the SQL editor's [{"json_agg": ...}] wrapper, like 06-check-backup.cjs.
if (Array.isArray(value) && value.length === 1 && value[0] && typeof value[0] === "object" && "json_agg" in value[0]) value = value[0].json_agg;
if (!Array.isArray(value) || !value.length) {
  console.log("FAIL: no rows in the export");
  process.exit(1);
}

const list = (x) => (Array.isArray(x) ? x : []);
const len = (x) => (typeof x === "string" ? x.length : 0);
const sum = (items, pick) => items.reduce((total, item) => total + pick(item), 0);

function measure(content) {
  const viruses = [...list(content.viruses), ...list(content.recycledViruses)].filter((virus) => virus && typeof virus === "object");
  const subsections = list(content.infoSections).flatMap((section) => list(section?.subsections));
  const blocks = subsections.flatMap((subsection) => list(subsection?.blocks));
  const tables = blocks.filter((block) => block?.type === "table");
  const documents = Object.values(content.formattedText && typeof content.formattedText === "object" ? content.formattedText : {});
  const runs = documents.flatMap((document) => list(document?.runs));
  const broadcasts = list(content.broadcasts).filter((item) => item && typeof item === "object");
  return {
    viruses: list(content.viruses).length,
    recycledViruses: list(content.recycledViruses).length,
    broadcasts: broadcasts.length,
    infoSections: list(content.infoSections).length,
    subsections: subsections.length,
    blocks: blocks.length,
    tableRows: sum(tables, (table) => list(table.rows).length),
    formattedTextKeys: documents.length,
    runs: runs.length,
    // The cap on scientist logs is intentional (D-25), so the raw side counts at most MAX_SCIENTIST_LOGS per virus.
    scientistLogs: sum(viruses, (virus) => Math.min(list(virus.scientistLogs).length, MAX_SCIENTIST_LOGS)),
    runTextChars: sum(runs, (run) => len(run?.text)),
    blockTextChars: sum(blocks, (block) => len(block?.text)),
    broadcastTitleChars: sum(broadcasts, (item) => len(item.title)),
    broadcastBodyChars: sum(broadcasts, (item) => len(item.body)),
    broadcastConditionChars: sum(broadcasts, (item) => len(item.conditions)),
    virusExternalChars: sum(viruses, (virus) => len(virus.external)),
    virusPhysiologyChars: sum(viruses, (virus) => len(virus.physiology)),
  };
}

let bad = false;
for (const row of value) {
  const raw = row && typeof row === "object" && "payload" in row ? row.payload : row;
  const normalized = normalizePortiaContent(raw);
  if (!normalized) {
    console.log("FAIL: payload rejected by the normalizer");
    bad = true;
    continue;
  }
  const before = measure(raw);
  const after = measure(normalized);
  const idempotent = JSON.stringify(normalizePortiaContent(structuredClone(normalized))) === JSON.stringify(normalized);
  const bytes = utf8Bytes(JSON.stringify({ content: normalized, revision: 0 }));
  for (const key of Object.keys(before)) {
    const lost = after[key] < before[key];
    if (lost) bad = true;
    console.log(`${key} raw=${before[key]} normalized=${after[key]}${lost ? " LOST" : ""}`);
  }
  console.log(`idempotent ${idempotent}`);
  console.log(`bytes ${bytes} limit ${MAX_CONTENT_BODY_BYTES}`);
  if (!idempotent || bytes > MAX_CONTENT_BODY_BYTES) bad = true;
}
console.log(bad ? "FAIL" : "OK");
process.exit(bad ? 1 : 0);
