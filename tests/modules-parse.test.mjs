// Every module must parse as JavaScript.
//
// This exists because a Python comment inside the worker's String.raw harness contained a
// backtick, which ended the template literal and made the whole file invalid JavaScript. The
// harness still compiled as Python and every other test passed, so it shipped, and every Python
// question on the live site failed with "Python didn't load: worker error". A browser only
// reports that at load time, which no unit test reaches — so the parse itself is the test.
import { is } from "./helpers.mjs";
import { readdirSync, statSync, writeFileSync, mkdtempSync, rmSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";

const root = new URL("..", import.meta.url).pathname;
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name[0] === ".") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (name.endsWith(".js") || name.endsWith(".mjs")) files.push(full);
  }
})(join(root, "js"));
for (const extra of ["sw.js"]) { try { statSync(join(root, extra)); files.push(join(root, extra)); } catch {} }

is("there are modules to check", files.length > 20, true);

const tmp = mkdtempSync(join(tmpdir(), "parse-"));
const broken = [];
for (const f of files) {
  const copy = join(tmp, "m.mjs");
  writeFileSync(copy, readFileSync(f, "utf8"));
  try { execFileSync("node", ["--check", copy], { stdio: ["pipe", "pipe", "pipe"] }); }
  catch (e) {
    const why = String(e.stderr).split("\n").find(l => /Error/.test(l)) || "unknown";
    broken.push(`${relative(root, f)}: ${why.trim()}`);
  }
}
rmSync(tmp, { recursive: true, force: true });
is("every module parses as JavaScript", broken, []);

// The specific trap: a backtick anywhere inside a String.raw template ends it early.
const withRaw = files.filter(f => readFileSync(f, "utf8").includes("String.raw`"));
is("the files holding a String.raw block are still found", withRaw.length > 0, true);
for (const f of withRaw) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/String\.raw`([\s\S]*?)`;/g)) {
    is(`no stray backtick in the String.raw block of ${relative(root, f)}`, m[1].includes("`"), false);
  }
}
