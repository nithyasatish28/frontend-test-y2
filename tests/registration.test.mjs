// Instructors sign themselves up, but only with a work email, and only an existing super admin
// can let them in. The domain test here mirrors the one in firestore.rules, which is the one
// that actually enforces it.
import { is, fakeStorage } from "./helpers.mjs";

fakeStorage();
const { create } = await import("../js/store/demo.js");
const { isWorkEmail } = await import("../js/admin/login.js");

is("a work address is accepted", isWorkEmail("r.menon@atriauniversity.edu.in"), true);
is("capitals don't matter", isWorkEmail("R.Menon@AtriaUniversity.edu.in"), true);
is("a personal address is refused", isWorkEmail("someone@gmail.com"), false);
is("a lookalike domain is refused", isWorkEmail("x@atriauniversity.edu.in.evil.com"), false);
is("a subdomain is refused", isWorkEmail("x@mail.atriauniversity.edu.in"), false);
is("an empty address is refused", isWorkEmail(""), false);

const boss = await create("admin");
await boss.adminSignIn("demo@example.com", "demo1234");
is("an instructor already exists", await boss.hasOwner(), true);

const her = await create("admin");                      // a second browser
const uid = await her.adminSignUp("r.menon@atriauniversity.edu.in", "goodpassword");
is("signing up alone gets you nothing", await her.isAdmin(uid), false);
await her.requestAccess("Radhika Menon");
is("the request records her own address", (await her.getRequest(uid)).email, "r.menon@atriauniversity.edu.in");
is("still nothing while she waits", await her.isAdmin(uid), false);

const seen = await new Promise(r => { const off = boss.watchRequests(l => { if (l.length) { off(); r(l); } }); });
is("the super admin sees one request", seen.length, 1);
await boss.approveRequest(seen[0]);
is("approved: she is an instructor", await her.isAdmin(uid), true);
is("and the request is gone", await her.getRequest(uid), null);

const him = await create("admin");
const uid2 = await him.adminSignUp("t.rao@atriauniversity.edu.in", "anotherpassword");
await him.requestAccess("Tejas Rao");
await boss.cancelRequest(uid2);
is("declined: no request, no access", [await him.getRequest(uid2), await him.isAdmin(uid2)], [null, false]);

await boss.removeAdmin(uid);
is("a removed instructor loses access", await her.isAdmin(uid), false);
