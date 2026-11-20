import { is, fakeStorage } from "./helpers.mjs";
fakeStorage();
const { create } = await import("../js/store/demo.js");


const s = await create("admin");
await s.adminSignIn("demo@example.com", "demo1234");
const sid = await s.createSession({ title: "T", minutes: 30, status: "running", startAt: Date.now(), points: 1, questions: [], sections: [] });

// student writes an answer (their whole q map, as test.js does)
await s.saveAttempt(sid, "u1", { name: "Radhika", status: "working", q: { w1: { text: "first draft" } }, t: 1 });
// instructor marks it live
await s.saveAttempt(sid, "u1", { q: { w1: { awarded: 3.5, note: "good" } } });
is("mark is stored", (await s.getAttempt(sid, "u1")).q.w1.awarded, 3.5);

// student keeps typing and saves again — the whole map, with no awarded in it
await s.saveAttempt(sid, "u1", { name: "Radhika", status: "working", q: { w1: { text: "second draft" } }, t: 2 });
const after = (await s.getAttempt(sid, "u1")).q.w1;
is("the student's save keeps the mark", after.awarded, 3.5);
is("...and the note", after.note, "good");
is("...and their new text is saved", after.text, "second draft");

