// The two data backends must offer exactly the same methods. demo.js is what a new user sees
// first, and the only thing keeping it in step with firebase.js is this file.
import { is, fakeStorage } from "./helpers.mjs";
import { readFileSync } from "node:fs";

fakeStorage();
const demo = await (await import("../js/store/demo.js")).create("admin");

// firebase.js can't run here (it fetches the SDK), so its surface is read from the source.
const src = readFileSync(new URL("../js/store/firebase.js", import.meta.url), "utf8");
const live = new Set(src.split("const store = {")[1].split(/\n  \};/)[0].split("\n")
  .map(l => (l.match(/^    (?:get |async )?([A-Za-z_]\w*)\s*[:(]/) || [])[1]).filter(Boolean));

const DEMO_ONLY = new Set(["resetDemo"]);         // deliberately demo-mode only
const mine = new Set(Object.keys(demo));
const missing = [...live].filter(k => !mine.has(k)).sort();
const extra = [...mine].filter(k => !live.has(k) && !DEMO_ONLY.has(k)).sort();

is("demo.js is missing nothing firebase.js has", missing, []);
is("demo.js adds nothing firebase.js lacks", extra, []);
is("both are a real surface, not an empty one", live.size > 40, true);
