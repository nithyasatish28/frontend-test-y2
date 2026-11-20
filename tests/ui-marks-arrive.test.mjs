import { is, fakeStorage, fakeDom, studentBody } from "./helpers.mjs";
const dom = await fakeDom(studentBody());
fakeStorage();

const { Test } = await import("../js/student/test.js");
const { publishSet, stats } = await import("../js/lib/grade.js");


const set = { sections: [{ id: "s1", title: "W" }], questions: [
  { id: "w1", section: "s1", type: "subjective", title: "Explain", prompt: "Why?", expected: "N", points: 5 }] };
const session = { ...publishSet(set, "salt"), salt: "salt", points: 1, hintPenalty: 0.5,
                  liveMarking: true, minutes: 30, status: "running", startAt: Date.now() };

// a fake store that lets us push an attempt update, as Firestore would
let watcher = null;
const store = {
  NOW: Date.now(), time: ms => ms, serverNow: () => Date.now(),
  getAttempt: async () => null,
  saveAttempt: async () => {},
  syncClock: async () => 0,
  watchAttempt: (sid, uid, cb) => { watcher = cb; return () => { watcher = null; }; },
};

const t = new Test({ store, sid: "s1", user: { uid: "u1", name: "Radhika" }, onSignOut: () => {} });
await t.start();
t.setSession(session);
t.A.q.w1 = { text: "my answer", handed: true };
t.A.cur = "w1";
t.renderQ();

is("before marking, no score", stats(session, t.A.q).score, 0);
is("the card says it is being marked", document.getElementById("qcard").textContent.includes("marking this one"), true);

// the instructor marks it — Firestore pushes the whole attempt back
watcher({ uid: "u1", name: "Radhika", q: { w1: { text: "my answer", handed: true, awarded: 3.5, note: "Nearly." } } });

is("the mark is taken", t.A.q.w1.awarded, 3.5);
is("...and the note", t.A.q.w1.note, "Nearly.");
is("the score updates without a refresh", stats(session, t.A.q).score, 3.5);
is("the chip at the top updates", document.getElementById("scoreTop").textContent, "3.5");
is("the card redraws with the mark", document.getElementById("qcard").textContent.includes("3.5 of 5"), true);
is("...and shows the note", document.getElementById("qcard").textContent.includes("Nearly."), true);
is("it survives a refresh too", JSON.parse(localStorage.getItem("class-test-attempt:s1:u1")).q.w1.awarded, 3.5);

// the student's own answer is never overwritten by the server copy
t.A.q.w1.text = "my answer, now longer";
watcher({ uid: "u1", q: { w1: { text: "my answer", handed: true, awarded: 3.5 } } });
is("their own newer text is kept", t.A.q.w1.text, "my answer, now longer");

// a re-mark comes through too
watcher({ uid: "u1", q: { w1: { text: "my answer", awarded: 5, note: null } } });
is("a changed mark is taken", t.A.q.w1.awarded, 5);
is("a cleared note is taken", t.A.q.w1.note, null);

t.stop();
