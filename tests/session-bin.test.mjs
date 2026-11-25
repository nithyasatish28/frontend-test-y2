// Deleting a session puts it in the bin rather than destroying it. Firestore has no undo, so a
// real delete is final — and the thing being deleted holds other people's work.
import { is, fakeStorage, fakeDom, tick } from "./helpers.mjs";
fakeStorage();
await fakeDom(`<div id="view"></div>`);
const { create } = await import("../js/store/demo.js");
const sessions = await import("../js/admin/sessions.js");

const store = await create("admin");
const uid = await store.adminSignIn("demo@example.com", "demo1234");
const base = { minutes: 30, status: "waiting", questions: [], sections: [], ownerUid: uid, stats: { joined: 3, submitted: 1 } };
const keepId = await store.createSession({ ...base, title: "Keep me" });
const binId = await store.createSession({ ...base, title: "Bin me" });
await store.saveAttempt(binId, "stu1", { uid: "stu1", name: "A student", q: { x: { s: "c" } } });

// ── deleting keeps everything ──
await store.deleteSession(binId);
const after = await store.getSession(binId);
is("the session is still there", !!after, true);
is("marked as deleted", !!after.deletedAt, true);
is("its title is untouched", after.title, "Bin me");
const attempts = sid => new Promise(r => { const off = store.watchAttempts(sid, l => { off(); r(l || []); }); });
const att = await attempts(binId);
is("the students' answers are untouched", att.length, 1);
is("including what they answered", att[0].q.x.s, "c");

// ── and students are shut out at once, whatever time was left ──
const student = await create("student");
const suid = await student.studentSignIn();          // a student writes under their own uid
is("a student can't save to a binned session",
   await student.saveAttempt(binId, suid, { uid: suid, name: "B" }).then(() => "saved", () => "refused"), "refused");
is("nor read it to begin with",
   await student.getSession(binId).then(() => "open", () => "closed"), "closed");

// ── the tab shows the live ones, and the bin separately ──
const view = document.getElementById("view");
const ctx = { store, user: { uid, email: "demo@example.com" }, role: "super",
  settings: { starters: true, activeSessionId: null }, onSettings: () => () => {}, scope: () => null, go: () => {} };
let off = sessions.mount(view, ctx);
await tick(140);
const titles = () => [...view.querySelectorAll("[data-table] td.name")].map(td => td.childNodes[0].textContent.trim());
is("the live list leaves out the deleted one", titles(), ["Keep me"]);
is("the bin says how many are in it", view.querySelector("[data-bin]").textContent.includes("Show 1"), true);
is("and doesn't list them until asked", !!view.querySelector("[data-bintable]"), false);

view.querySelector("[data-bin] [data-toggle]").click();
await tick(20);
is("opening it lists them", view.querySelector("[data-bintable]").textContent.includes("Bin me"), true);
is("with a way back", !!view.querySelector("[data-put]"), true);
is("and a way to finish the job", !!view.querySelector("[data-burn]"), true);

// ── putting it back ──
view.querySelector("[data-put]").click();
await tick(160);
is("it returns to the live list", titles().sort(), ["Bin me", "Keep me"]);
is("and the bin empties", view.querySelector("[data-bin]").textContent.trim(), "");
is("with its results intact", (await attempts(binId)).length, 1);

// ── emptying the bin really does destroy it ──
await store.deleteSession(binId);
await store.destroySession(binId);
is("the session is gone", await store.getSession(binId), null);
is("and so are its attempts", (await attempts(binId)).length, 0);
is("the other one is untouched", (await store.getSession(keepId)).title, "Keep me");
off();
