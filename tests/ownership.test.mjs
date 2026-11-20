import { is, fakeStorage } from "./helpers.mjs";
fakeStorage();
const { create } = await import("../js/store/demo.js");

const once = (fn, owner) => new Promise(r => { const off = fn(l => { off(); r(l || []); }, owner); });

// ── the super admin, and a colleague they let in ──
const boss = await create("admin");
const bossUid = await boss.adminSignIn("demo@example.com", "demo1234");
const her = await create("admin");
const herUid = await her.adminSignUp("r.menon@atriauniversity.edu.in", "goodpassword");
await her.requestAccess("Radhika");
await boss.approveRequest(await her.getRequest(herUid));
is("she is an ordinary instructor", await her.adminRole(herUid), "instructor");

// ── the seeded starter sets have no owner at all ──
const loose = await once(boss.watchSets.bind(boss), null);
is("seeded sets start unowned", loose.filter(s => !s.ownerUid).length, 2);
is("she sees none of them", (await once(her.watchSets.bind(her), herUid)).length, 0);

// ── the super admin adopts them ──
const adopted = await boss.adoptUnowned(bossUid);
is("adoption reports what it took", adopted.sets, 2);
is("they are the super admin's now", (await once(boss.watchSets.bind(boss), bossUid)).length, 2);
is("she still sees none", (await once(her.watchSets.bind(her), herUid)).length, 0);

// ── each makes their own work ──
await her.saveSet(null, { title: "Her set", ownerUid: herUid, ownerName: "r.menon@…", questions: [], sections: [] });
await boss.saveSet(null, { title: "His set", ownerUid: bossUid, ownerName: "demo@…", questions: [], sections: [] });
is("she sees only hers", (await once(her.watchSets.bind(her), herUid)).map(s => s.title), ["Her set"]);
is("he sees only his, plus the adopted two", (await once(boss.watchSets.bind(boss), bossUid)).length, 3);
is("the super admin can see everything", (await once(boss.watchSets.bind(boss), null)).length, 4);

// ── sessions behave the same ──
await her.createSession({ title: "Her class", ownerUid: herUid, minutes: 30, status: "waiting", questions: [], sections: [] });
await boss.createSession({ title: "His class", ownerUid: bossUid, minutes: 30, status: "waiting", questions: [], sections: [] });
is("she sees only her session", (await once(her.watchSessions.bind(her), herUid)).map(s => s.title), ["Her class"]);
is("he sees only his", (await once(boss.watchSessions.bind(boss), bossUid)).map(s => s.title), ["His class"]);
is("unfiltered shows both", (await once(boss.watchSessions.bind(boss), null)).length, 2);

// ── the Live tab is per instructor, not shared ──
await her.setSettings({ activeSessionId: "hers" }, herUid);
await boss.setSettings({ activeSessionId: "his" }, bossUid);
const hers = await new Promise(r => { const off = her.watchSettings(v => { off(); r(v); }, herUid); });
const his  = await new Promise(r => { const off = boss.watchSettings(v => { off(); r(v); }, bossUid); });
is("her Live tab is her own", hers.activeSessionId, "hers");
is("his is untouched by hers", his.activeSessionId, "his");

