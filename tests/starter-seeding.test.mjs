// Every instructor should find the starter sets already in their list, once, as their own
// copies. It must not happen twice, and must not come back after they delete them.
import { is, fakeStorage, fakeDom, tick } from "./helpers.mjs";

fakeStorage();
await fakeDom(`<div id="view"></div>`);
const { create } = await import("../js/store/demo.js");
const { mount } = await import("../js/admin/sets.js");
const { STARTER_SETS } = await import("../js/data/starter-sets.js");

const store = await create("admin");
const uid = await store.adminSignUp("r.menon@atriauniversity.edu.in", "goodpassword");
const view = document.getElementById("view");
const ctxFor = settings => ({
  store, user: { uid, email: "r.menon@atriauniversity.edu.in" }, role: "instructor",
  settings, scope: () => uid, go: () => {},
});
const mine = () => new Promise(r => { const off = store.watchSets(l => { off(); r(l || []); }, uid); });

is("a new instructor starts with nothing", (await mine()).length, 0);

// first visit to Questions
let settings = {};
let off = mount(view, ctxFor(settings));
await tick(600);   // the demo store fakes network latency on every write
const after = await mine();
is("both starter sets appear", after.length, STARTER_SETS.length);
is("...with the right titles", after.map(s => s.title).sort(), STARTER_SETS.map(s => s.title).sort());
is("...owned by them, not shared", after.every(s => s.ownerUid === uid), true);
is("...and it was remembered", (await new Promise(r => { const o = store.watchSettings(v => { o(); r(v); }, uid); })).starters, true);
off();

// visiting again must not pile up more copies
settings = { starters: true };
off = mount(view, ctxFor(settings));
await tick(600);   // the demo store fakes network latency on every write
is("opening the page again adds nothing", (await mine()).length, STARTER_SETS.length);
off();

// and deleting them is allowed to stick
for (const s of await mine()) await store.deleteSet(s.id);
is("deleted", (await mine()).length, 0);
off = mount(view, ctxFor({ starters: true }));
await tick(600);   // the demo store fakes network latency on every write
is("they don't come back uninvited", (await mine()).length, 0);
off();

// the buttons that went
const src = (await import("node:fs")).readFileSync(new URL("../js/admin/sets.js", import.meta.url), "utf8");
is("no 'Add a starter set' button", src.includes("data-starter"), false);
is("no 'Import a file' button", src.includes("data-import"), false);
is("CSV upload is still there", src.includes("data-csv"), true);

// JSON is gone from both ends: nothing writes it, nothing reads it
const editor = (await import("node:fs")).readFileSync(new URL("../js/admin/set-editor.js", import.meta.url), "utf8");
is("no JSON export in the editor", /data-dl\b|application\/json/.test(editor), false);
is("CSV export is still there", editor.includes("data-dlcsv"), true);
