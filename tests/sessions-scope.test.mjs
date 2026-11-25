// What each tab shows whom.
//
// Both tabs are personal: your own question sets, your own sessions. A colleague's are read from
// the Instructors tab, by clicking their name. The one thing the super admin's own list must also
// hold is the sessions made before instructors had accounts, which carry no owner at all — those
// are theirs, and scoping the query to one uid made them look deleted.
import { is, fakeStorage, fakeDom, tick } from "./helpers.mjs";
fakeStorage();
await fakeDom(`<div id="view"></div>`);
const { create } = await import("../js/store/demo.js");
const sessions = await import("../js/admin/sessions.js");
const sets = await import("../js/admin/sets.js");

const boss = await create("admin");
const bossUid = await boss.adminSignIn("demo@example.com", "demo1234");
const her = await create("admin");
const herUid = await her.adminSignUp("r.menon@atriauniversity.edu.in", "goodpassword");
await her.requestAccess("Radhika Menon");
await boss.approveRequest(await her.getRequest(herUid));

const base = { minutes: 30, status: "waiting", questions: [], sections: [], stats: { joined: 0, submitted: 0 } };
await boss.createSession({ ...base, title: "Mine", ownerUid: bossUid });
await her.createSession({ ...base, title: "Hers", ownerUid: herUid });
await boss.createSession({ ...base, title: "From before accounts existed" });   // no ownerUid at all

const view = document.getElementById("view");
const titles = () => [...view.querySelectorAll("td.name")].map(td => td.textContent.trim());
const ctxFor = (store, uid, role) => ({ store, user: { uid, email: "x@atriauniversity.edu.in" }, role,
  settings: { starters: true, activeSessionId: null }, onSettings: () => () => {}, scope: () => null, go: () => {} });

// ── the super admin ──
let off = sessions.mount(view, ctxFor(boss, bossUid, "super"));
await tick(140);
const seen = titles().join(" | ");
is("their own session is there", seen.includes("Mine"), true);
is("a colleague's session is NOT there", seen.includes("Hers"), false);
is("and one from before accounts existed", seen.includes("From before accounts existed"), true);
is("so nothing needs an owner's name on it", seen.includes("another instructor"), false);
is("an unowned one says so, so it can be claimed", seen.includes("no owner yet"), true);
off();

// ── an ordinary instructor sees only her own ──
off = sessions.mount(view, ctxFor(her, herUid, "admin"));
await tick(140);
is("she sees hers", titles().some(t => t.includes("Hers")), true);
is("and nobody else's", titles().some(t => t.includes("Mine")), false);
is("not even an unowned one", titles().some(t => t.includes("before accounts")), false);
off();

// ── asking for one instructor still narrows it ──
off = sessions.mount(view, ctxFor(boss, bossUid, "super"), herUid);
await tick(140);
// the owner note is a child of the same cell, so read just the title text
const names = [...view.querySelectorAll("td.name")].map(td => td.childNodes[0].textContent.trim());
is("the super admin can still look at one instructor alone", names, ["Hers"]);
off();

// ── while question sets stay personal, which is what was asked for ──
await her.saveSet(null, { title: "Her set", ownerUid: herUid, minutes: 45, sections: [], questions: [] });
await boss.saveSet(null, { title: "His set", ownerUid: bossUid, minutes: 45, sections: [], questions: [] });
off = sets.mount(view, ctxFor(boss, bossUid, "super"));
await tick(140);
const cards = [...view.querySelectorAll(".set-card h3")].map(h => h.textContent);
is("the Questions tab is still their own", cards.includes("Her set"), false);
is("their own set is there", cards.includes("His set"), true);
off();
