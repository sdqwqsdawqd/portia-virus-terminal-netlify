import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Pure offline comparator for supabase/fingerprint/portia_schema_fingerprint.sql output.
// No allow-list of "expected" differences on purpose: a human classifies deltas (plan 16-14).

export const FINGERPRINT_SCHEMA = "portia-fingerprint-v1";

export class FingerprintError extends Error {
  constructor(code, message) {
    super(`[PORTIA_FINGERPRINT:${code}] ${message}`);
    this.name = "FingerprintError";
    this.code = code;
  }
}

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

const stable = (value) => JSON.stringify(canonicalize(value === undefined ? null : value));

// Accepts: the fingerprint object, a JSON string (SQL Editor paste), or a one-column result in any of
// the CLI shapes: [row], [string], [{ column: object|string }], { rows: [...] }.
export function extractFingerprint(input, depth = 0) {
  const bad = () => new FingerprintError("fingerprint-format", "input is not a single-column fingerprint result");
  if (depth > 4) throw bad();
  if (typeof input === "string") {
    try {
      return extractFingerprint(JSON.parse(input), depth + 1);
    } catch (error) {
      if (error instanceof FingerprintError) throw error;
      throw bad();
    }
  }
  if (Array.isArray(input)) {
    if (input.length !== 1) throw bad();
    return extractFingerprint(input[0], depth + 1);
  }
  if (isObject(input)) {
    if ("schema" in input) return input;
    const keys = Object.keys(input);
    if (keys.length === 1) return extractFingerprint(input[keys[0]], depth + 1);
  }
  throw bad();
}

function validate(fingerprint) {
  if (
    !isObject(fingerprint) ||
    fingerprint.schema !== FINGERPRINT_SCHEMA ||
    !Number.isInteger(fingerprint.pg_major) ||
    !isObject(fingerprint.sections)
  ) {
    throw new FingerprintError("fingerprint-schema", `expected ${FINGERPRINT_SCHEMA} with pg_major and sections`);
  }
  return fingerprint;
}

const sha256 = (text) => createHash("sha256").update(text).digest("hex");

export function sectionHashes(fingerprint) {
  const { sections } = validate(fingerprint);
  return Object.fromEntries(Object.keys(sections).sort().map((name) => [name, sha256(stable(sections[name]))]));
}

// Key count per section; null stays null (e.g. cron on a project without pg_cron).
export function inventory(fingerprint) {
  const { sections } = validate(fingerprint);
  return Object.fromEntries(
    Object.keys(sections)
      .sort()
      .map((name) => [name, isObject(sections[name]) ? Object.keys(sections[name]).length : null]),
  );
}

// The privileged Supabase API role differs between hosted projects and default-privilege eras; a diff that
// touches only its ACL entries is still listed (and still exit 1) but tagged as info.
const PRIVILEGED_ACL_PREFIX = "service_role:";

function withoutPrivilegedAcl(value) {
  if (!isObject(value) || !Array.isArray(value.acl)) return value;
  return { ...value, acl: value.acl.filter((entry) => !String(entry).startsWith(PRIVILEGED_ACL_PREFIX)) };
}

export function diffFingerprints(a, b) {
  validate(a);
  validate(b);
  if (a.pg_major !== b.pg_major) return { comparable: false, reason: "pg-major" };
  // Type and expression text from the catalog depends on search_path, so a mismatch cannot be compared.
  if (a.search_path !== b.search_path) return { comparable: false, reason: "search-path" };
  const diff = {};
  const info = {};
  for (const section of [...new Set([...Object.keys(a.sections), ...Object.keys(b.sections)])].sort()) {
    const left = a.sections[section] ?? null;
    const right = b.sections[section] ?? null;
    if (!isObject(left) || !isObject(right)) {
      // null vs object (or scalar) must not read as equal: absent pg_cron != pg_cron without the job.
      if (stable(left) !== stable(right)) diff[section] = ["<section>"];
      continue;
    }
    for (const key of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) {
      if (stable(left[key]) === stable(right[key])) continue;
      (diff[section] ??= []).push(key);
      if (stable(withoutPrivilegedAcl(left[key])) === stable(withoutPrivilegedAcl(right[key]))) {
        (info[section] ??= []).push(key);
      }
    }
  }
  return { comparable: true, equal: Object.keys(diff).length === 0, diff, info };
}

function load(file) {
  // Windows PowerShell 5 `Set-Content -Encoding utf8` prepends a BOM.
  return validate(extractFingerprint(readFileSync(file, "utf8").replace(/^﻿/, "")));
}

function main(args) {
  if (args[0] === "--summary" && args.length === 2) {
    const fingerprint = load(args[1]);
    process.stdout.write(
      `${JSON.stringify({ pg_major: fingerprint.pg_major, search_path: fingerprint.search_path ?? null, inventory: inventory(fingerprint), sha256: sectionHashes(fingerprint) }, null, 2)}\n`,
    );
    return 0;
  }
  if (args.length !== 2) {
    process.stderr.write("usage: phase16-fingerprint-compare.mjs <a.json> <b.json> | --summary <a.json>\n");
    return 2;
  }
  const result = diffFingerprints(load(args[0]), load(args[1]));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.comparable) return 2;
  return result.equal ? 0 : 1;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    // Messages carry only codes; fingerprint content is never echoed.
    process.stderr.write(
      error instanceof FingerprintError ? `${error.message}\n` : "[PORTIA_FINGERPRINT:io] could not read input file\n",
    );
    process.exitCode = 2;
  }
}
