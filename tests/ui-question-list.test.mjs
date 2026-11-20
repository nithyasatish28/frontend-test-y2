import { is, fakeStorage, fakeDom, studentBody } from "./helpers.mjs";
const dom = await fakeDom(studentBody());
fakeStorage();

const { Test } = await import("../js/student/test.js");
const { publishSet } = await import("../js/lib/grade.js");


const set = { sections: [{ id: "s1", title: "W" }], questions: [
  { id: "w1", section: "s1", type: "subjective", title: "One",   prompt: "?", expected: "n", points: 4 },
  { id: "w2", section: "s1", type: "subjective", title: "Two",   prompt: "?", expected: "n", points: 4 },
  { id: "w3", section: "s1", type: "subjective", title: "Three", prompt: "?", expected: "n", points: 4 },
  { id: "w4", section: "s1", type: "subjective", title: "Four",  prompt: "?", expected: "n", points: 4 },
  { id: "m1", section: "s1", type: "mcq", title: "Five", prompt: "?", options: ["a","b"], answer: 1 },
] };
const session = { ...publishSet(set, "salt"), salt: "salt", points: 1, hintPenalty: 0.5,
                  liveMarking: true, minutes: 30, status: "running", startAt: Date.now() };
const store = { NOW: 0, time: m => m, serverNow: () => Date.now(), getAttempt: async () => null,
  saveAttempt: async () => {}, syncClock: async () => 0, watchAttempt: () => () => {} };

const t = new Test({ store, sid: "s1", user: { uid: "u1", name: "R" }, onSignOut: () => {} });
await t.start();
t.setSession(session);
t.A.q = {
  w1: { text: "typing away" },                       // written, not handed
  w2: { text: "done", handed: true },                // handed, not marked
  w3: { text: "done", handed: true, awarded: 4 },    // marked, full
  w4: { text: "done", handed: true, awarded: 1.5 },  // marked, part
  m1: { s: "c", pick: 1 },
};
t.renderList();
const btn = i => document.getElementById("qlist").querySelectorAll(".qb")[i];
const cls = i => [...btn(i).classList].filter(c => c !== "qb" && c !== "now").sort().join(" ");

is("still writing: no colour",            cls(0), "");
is("handed in: green",                    cls(1), "sent");
is("marked full: green with a tick",      cls(2), "correct marked");
is("marked part: green with a tick",      cls(3), "marked sent");
is("a correct MCQ is unchanged",          cls(4), "correct");

is("screen readers hear 'handed in'",     btn(1).getAttribute("aria-label").includes("handed in, waiting to be marked"), true);
is("...and hear the mark",                btn(2).getAttribute("aria-label").includes("marked 4 out of 4"), true);
is("...including a part mark",            btn(3).getAttribute("aria-label").includes("marked 1.5 out of 4"), true);

const legend = document.getElementById("qlist").querySelector(".legend").textContent;
is("legend explains green covers handed in", legend.includes("correct or handed in"), true);
is("legend explains the tick",              legend.includes("marked by your instructor"), true);

// zero marks reads as wrong
t.A.q.w4 = { text: "done", handed: true, awarded: 0 };
t.renderList();
is("zero marks: red with a tick", cls(3), "marked wrong");

// a test with no written answers keeps the old, shorter legend
const plain = { ...publishSet({ sections: [{ id: "s1", title: "A" }], questions: [set.questions[4]] }, "salt"),
                salt: "salt", points: 1, minutes: 30, status: "running", startAt: Date.now() };
t.setSession(plain); t.A.q = { m1: {} }; t.renderList();
const legend2 = document.getElementById("qlist").querySelector(".legend").textContent;
is("no written answers: no tick in the legend", legend2.includes("marked by your instructor"), false);
is("...and green just means correct", legend2.includes("Green correct"), true);

t.stop();
