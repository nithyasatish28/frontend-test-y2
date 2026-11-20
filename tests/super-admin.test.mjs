// Only the super admin can let someone in. It is the first account set up (meta/owner), plus
// anyone it has passed the role to — so a database made before roles existed still has one.
import { is, fakeStorage } from "./helpers.mjs";

fakeStorage();
const { create } = await import("../js/store/demo.js");

const boss = await create("admin");
const ownerUid = await boss.adminSignIn("demo@example.com", "demo1234");
is("the seeded owner has no role field", (await boss.adminRole(ownerUid)) && true, true);
is("but is the super admin anyway, via meta/owner", await boss.adminRole(ownerUid), "super");
is("ownerUid() finds them", await boss.ownerUid(), ownerUid);

const her = await create("admin");
const uid = await her.adminSignUp("r.menon@atriauniversity.edu.in", "goodpassword");
await her.requestAccess("Radhika");
await boss.approveRequest(await her.getRequest(uid));
is("someone let in is an ordinary instructor", await her.adminRole(uid), "instructor");

await boss.setRole(uid, "super");
is("the role can be passed on", await her.adminRole(uid), "super");
await boss.setRole(uid, "instructor");
is("and taken back", await her.adminRole(uid), "instructor");

await boss.setRole(uid, "super");
await boss.removeAdmin(uid);
is("removing an instructor clears the role too", await her.adminRole(uid), null);

const him = await create("admin");
const uid2 = await him.adminSignUp("t.rao@atriauniversity.edu.in", "pw12345678");
is("signed up but unapproved has no role at all", await him.adminRole(uid2), null);
