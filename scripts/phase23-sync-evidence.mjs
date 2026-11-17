// Offline update of the Phase 23 function evidence after editing the forward migration.
// It never connects to a database. Live fingerprint and role checks remain separate gates.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const migrationName = "20261113000000_portia_access_promotion.sql";
const migration = readFileSync(`supabase/migrations/${migrationName}`, "utf8").replace(/\r\n/g, "\n");
const fingerprintPath = "supabase/fingerprint/expected/portia.fingerprint.json";
const matrixPath = "tests/e2e/fixtures/data/expected-authz.json";
const fingerprint = JSON.parse(readFileSync(fingerprintPath, "utf8"));
const matrix = JSON.parse(readFileSync(matrixPath, "utf8"));
const functions = fingerprint.sections.functions;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const identityOf = (args) => args.split(",").map((part) => part.trim().replace(/\s+default\s[\s\S]*$/i, "").replace(/\s+/g, " ")).filter(Boolean).join(", ");
const typesOf = (args) => identityOf(args).split(", ").filter(Boolean).map((part) => part.split(" ").slice(1).join(" ")).join(", ");
const lineAt = (index) => migration.slice(0, index).split("\n").length;
const signature = (name, args) => `public.${name}(${identityOf(args)})`;
const roleName = (role) => role === "public" ? "PUBLIC" : role;
const aclOf = (roles) => [...roles].map((role) => `${role}:EXECUTE`).sort();
const rolesOf = (entry) => new Set(entry.acl.filter((acl) => acl.endsWith(":EXECUTE")).map((acl) => acl.slice(0, -8)));
const phase23Names = /^public\.(?:portia_access_editor_request_status|portia_promo_participant_key|portia_promo_secure_|portia_promo_test_proof_valid)/;
const states = new Map(Object.entries(functions).filter(([key]) => !phase23Names.test(key)).map(([key, entry]) => [key, { ...entry, roles: rolesOf(entry) }]));
const byTypes = new Map([...states.keys()].map((key) => {
  const name = key.slice("public.".length, key.indexOf("("));
  const args = key.slice(key.indexOf("(") + 1, -1);
  return [`${name}(${args.split(", ").filter(Boolean).map((part) => part.split(" ").slice(-1)[0]).join(", ")})`, key];
}));
const events = [];

for (const match of migration.matchAll(/^create or replace function public\.(portia_\w+)\(([^)]*)\)([\s\S]*?)\bas \$\$([\s\S]*?)\$\$;/gm)) {
  events.push({ index: match.index, kind: "create", match });
}
for (const match of migration.matchAll(/^(grant execute|revoke (?:all|execute)) on function public\.(portia_\w+)\(([^)]*)\) (?:to|from) ([^;]+);/gm)) {
  events.push({ index: match.index, kind: match[1].startsWith("grant") ? "grant" : "revoke", match });
}
events.sort((a, b) => a.index - b.index);
const lastSource = new Map();
for (const event of events) {
  const { match, kind } = event;
  if (kind === "create") {
    const [, name, args, header, body] = match;
    const key = signature(name, args);
    const old = states.get(key);
    const rawReturn = /\breturns\s+(\w+)/i.exec(header)?.[1];
    if (!rawReturn) throw new Error(`Missing return type for ${key}`);
    states.set(key, {
      acl: old?.acl ?? ["PUBLIC:EXECUTE"],
      config: /\bset search_path = ''/i.test(header) ? ['search_path=""'] : [],
      kind: "f",
      returns: rawReturn === "timestamptz" ? "timestamp with time zone" : rawReturn === "int" ? "integer" : rawReturn,
      secdef: /\bsecurity definer\b/i.test(header),
      src_sha256: sha256(body.replace(/\r/g, "")),
      volatility: /\bimmutable\b/i.test(header) ? "i" : /\bstable\b/i.test(header) ? "s" : "v",
      roles: old?.roles ?? new Set(["PUBLIC"]),
    });
    byTypes.set(`${name}(${typesOf(args)})`, key);
  } else {
    const [, , name, args, list] = match;
    const key = byTypes.get(`${name}(${identityOf(args)})`);
    if (!key || !states.has(key)) throw new Error(`Unknown grant/revoke ${name}(${args})`);
    for (const role of list.split(",").map((part) => roleName(part.trim()))) {
      if (kind === "grant") states.get(key).roles.add(role);
      else states.get(key).roles.delete(role);
    }
    lastSource.set(key, `supabase/migrations/${migrationName}:${lineAt(event.index)}`);
  }
}

fingerprint.sections.functions = Object.fromEntries([...states].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, entry]) => {
  const { roles, ...record } = entry;
  return [key, { ...record, acl: aclOf(roles) }];
}));

const roles = Object.keys(matrix.roles);
const values = {
  p_access_hash: "{token}", p_token_hash: "{token}", p_kind: "ordinary", p_title_id: "academic",
  p_target_id: "senior", p_risk_bucket: "{prefix}-{role}", p_bucket_key: "{prefix}-{role}", p_ip_bucket: "{prefix}-{role}",
  p_attempt_id: "00000000-0000-4000-8000-000000000000", p_question_id: "00000000-0000-4000-8000-000000000000",
  p_expected_question_index: 0, p_answer: {}, p_nonce: "{prefix}-nonce-12345678", p_client_mode: "desktop", p_reason: "offline",
  p_issued_at: 0, p_signature: "0".repeat(64), p_action: "current",
};
const oldRows = new Map(matrix.functions.map((row) => [row.key, row]));
matrix.functions = [...states].filter(([key]) => key.startsWith("public.portia_")).map(([key, entry]) => {
  const previous = oldRows.get(key);
  const name = key.slice("public.".length, key.indexOf("("));
  const identity = key.slice(key.indexOf("(") + 1, -1);
  const args = previous?.args ?? Object.fromEntries(identity.split(", ").filter(Boolean).map((part) => {
    const param = part.split(" ")[0];
    if (!(param in values)) throw new Error(`No inert value for ${key}.${param}`);
    return [param, values[param]];
  }));
  const source = lastSource.get(key);
  const cells = Object.fromEntries(roles.map((role) => {
    const granted = role === "anon" ? entry.roles.has("anon") || entry.roles.has("PUBLIC") : entry.roles.has("authenticated") || entry.roles.has("PUBLIC");
    const prior = previous?.cells?.[role];
    return [role, source ? { outcome: granted ? "allow" : "42501", source } : prior];
  }));
  return previous ? { ...previous, cells } : {
    key, name, identity, args, creates_rows: name === "portia_promo_secure_submit",
    kind: name === "portia_promo_secure_attempt" || name === "portia_promo_participant_key" || name === "portia_promo_test_proof_valid"
      ? "internal" : name.includes("secure_") ? "participant" : "visitor",
    cells,
  };
}).sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
matrix.migrations = [...new Set([...matrix.migrations, migrationName])].sort();
if (!matrix.generated_from.includes("Phase 23 adds approved-request")) matrix.generated_from += " Phase 23 adds approved-request Promotion RPC wrappers (offline evidence only).";

writeFileSync(fingerprintPath, `${JSON.stringify(fingerprint, null, 2)}\n`);
writeFileSync(matrixPath, `${JSON.stringify(matrix, null, 2)}\n`);
console.log(`Updated ${matrix.functions.length} function matrix rows and ${Object.keys(fingerprint.sections.functions).length} fingerprint functions`);
