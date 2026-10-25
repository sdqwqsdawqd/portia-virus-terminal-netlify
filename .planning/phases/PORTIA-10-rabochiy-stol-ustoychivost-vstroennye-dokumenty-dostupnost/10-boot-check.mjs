// Usage: node 10-boot-check.mjs [--url http://localhost:3125]
// Why: THEME-01 / D-11. Proves the boot script Next actually serves (compiled deriveAccentTokens source included)
// applies a valid custom accent and ignores a tampered one. Runs the inline head script in Node against fake storage.
// Prints one JSON object with booleans and counts only. Exit 0 ok, 1 not ok, 2 server unreachable or script not found.
const args = process.argv.slice(2);
const flag = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback; };
const URL_ = flag("url", "http://localhost:3125");
const KEY = "portia-desktop-settings-v1";

let html;
try {
  const res = await fetch(URL_);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  html = await res.text();
} catch {
  console.error("server unreachable");
  process.exit(2);
}
const source = html.match(/<script>(\(function\(\)\{var d=document\.documentElement[\s\S]*?)<\/script>/)?.[1];
if (!source) {
  console.error("head boot script not found");
  process.exit(2);
}

function run(stored) {
  const dataset = {}, props = {}, keys = [];
  const localStorage = { getItem: (key) => { keys.push(key); return JSON.stringify(stored); } };
  const document = { documentElement: { dataset, style: { setProperty: (name, value) => { props[name] = value; } } } };
  new Function("localStorage", "sessionStorage", "document", "matchMedia", source)(localStorage, { getItem: () => null }, document, () => ({ matches: false }));
  return { accent: dataset.accent, props, askedKey: keys.length === 1 && keys[0] === KEY };
}

const custom = run({ accent: "custom", customAccent: "#ff3366" });
const hostile = run({ accent: "custom", customAccent: "\"><script>alert(1)</script>" });
const preset = run({ accent: "ice", customAccent: "#ff3366" });

const cases = {
  custom: custom.accent === "custom" && Object.keys(custom.props).length === 10 && new Set(Object.values(custom.props)).size === 10 && Number.isFinite(Number(custom.props["--accent-hue"])) && custom.askedKey,
  hostile: hostile.accent === undefined && Object.keys(hostile.props).length === 0 && hostile.askedKey,
  preset: preset.accent === "ice" && Object.keys(preset.props).length === 0 && preset.askedKey,
};
const ok = Object.values(cases).every(Boolean);
console.log(JSON.stringify({ ok, cases: { ...cases, customProps: Object.keys(custom.props).length } }));
process.exit(ok ? 0 : 1);
