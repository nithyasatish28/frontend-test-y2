// Runs every tests/*.test.mjs. No dependencies beyond node itself, except the DOM tests,
// which need jsdom (npm install) and are skipped with a note when it isn't there.
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tally, reset } from "./helpers.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here).filter(f => f.endsWith(".test.mjs")).sort();
let total = 0, broken = 0, skipped = 0;
const bad = [];

for (const f of files) {
  reset();
  console.log(`\n── ${f.replace(".test.mjs", "")} ──`);
  try {
    const mod = await import(join(here, f));
    if (mod.skipped) { console.log("  skipped: " + mod.skipped); skipped++; continue; }
  } catch (e) {
    if (e.needsJsdom) { console.log("  skipped: " + e.message); skipped++; continue; }
    console.log("  CRASHED: " + e.message); broken++; bad.push(f); continue;
  }
  const t = tally();
  total += t.pass + t.fail;
  if (t.fail) { broken++; bad.push(`${f} (${t.failures.join(", ")})`); }
}

console.log(`\n${"─".repeat(50)}`);
console.log(`${files.length} files · ${total} assertions · ${broken ? bad.length + " with failures" : "all passing"}${skipped ? ` · ${skipped} skipped` : ""}`);
if (bad.length) { bad.forEach(b => console.log("  ✗ " + b)); process.exit(1); }
