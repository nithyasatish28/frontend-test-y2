// The super admin's own tabs show their own work. A colleague's sets and sessions are only
// ever shown when asked for, from the Instructors tab.
import { is, fakeStorage, fakeDom, tick } from "./helpers.mjs";

fakeStorage();
await fakeDom(`<div id="view"></div>`);
const { create } = await import("../js/store/demo.js");
const sets = await import("../js/admin/sets.js");
const instructors = await import("../js/admin/instructors.js");

const boss = await create("admin");
const bossUid = await boss.adminSignIn("demo@example.com", "demo1234");
const her = await create("admin");
const herUid = await her.adminSignUp("r.menon@atriauniversity.edu.in", "goodpassword");
await her.requestAccess("Radhika Menon");
await boss.approveRequest(await her.getRequest(herUid));

await boss.adoptUnowned(bossUid);                                  // the seeded sets become his
await her.saveSet(null, { title: "Her private set", ownerUid: herUid, ownerName: "r.menon@…",
  minutes: 45, sections: [{ id: "s1", title: "A" }], questions: [{ id: "q1", section: "s1", type: "subjective", title: "T", prompt: "P", expected: "n" }] });
await her.createSession({ title: "Her class", ownerUid: herUid, minutes: 30, status: "waiting", questions: [], sections: [], stats: { joined: 4, submitted: 2 } });

const view = document.getElementById("view");
const ctx = { store: boss, user: { uid: bossUid, email: "demo@example.com" }, role: "super",
  settings: { starters: true }, scope: () => null, go: () => {} };

// ── the super admin's own Questions tab ──
let off = sets.mount(view, ctx);
await tick(120);
const titles = [...view.querySelectorAll(".set-card h3")].map(h => h.textContent);
is("their own sets are listed", titles.length > 0, true);
is("a colleague's set is NOT there by default", titles.includes("Her private set"), false);
off();

// ── asking for hers, by uid ──
off = sets.mount(view, ctx, herUid);
await tick(120);
is("asking for hers shows hers", [...view.querySelectorAll(".set-card h3")].map(h => h.textContent), ["Her private set"]);
off();

// ── the instructor's own page ──
off = instructors.mount(view, ctx, herUid);
await tick(200);
const text = view.textContent;
is("her name is shown", text.includes("Radhika Menon"), true);
is("her question set is shown", text.includes("Her private set"), true);
is("her session is shown", text.includes("Her class"), true);
is("with a way back", !!view.querySelector('a[href="#/instructors"]'), true);
off();

// ── and the roster links to each of them ──
off = instructors.mount(view, ctx);
await tick(120);
is("every instructor links to their own page", !!view.querySelector(`a[href="#/instructors/${herUid}"]`), true);
off();

// ── the label bug that showed "undefined" on every card with a written answer ──
const src = (await import("node:fs")).readFileSync(new URL("../js/admin/sets.js", import.meta.url), "utf8");
is("written answers have a name", /subjective:\s*"written"/.test(src), true);
is("and an unknown type falls back to its own name", src.includes('(TYPE_NAMES[q.type] || q.type)'), true);
