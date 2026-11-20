// Part marks: a blanks question is worth the share of blanks filled in right, and a code
// question the share of checks that pass. Only when the set asks for it, and never taking
// away a mark a student had already earned.
import { is } from "./helpers.mjs";
const { publishSet, entryPoints, partPoints, stats, cellCode } = await import("../js/lib/grade.js");

const set = { sections: [{ id: "s1", title: "A" }], questions: [
  { id: "b1", section: "s1", type: "blanks", title: "Fill", prompt: "", code: "__1__ __2__ __3__ __4__",
    blanks: [1, 2, 3, 4].map(n => ({ n, accept: ["x"] })) },
  { id: "c1", section: "s1", type: "code", title: "Code", prompt: "", lang: "js", starter: "",
    tests: [1, 2, 3, 4].map(i => ({ name: "t" + i, expr: "1", op: "equals", expected: "1" })) },
] };
const base = publishSet(set, "salt");
const on = { ...base, salt: "salt", points: 4, hintPenalty: 0.5, partMarks: true };
const off = { ...on, partMarks: false };
const Q = Object.fromEntries(on.questions.map(q => [q.id, q]));

const threeOfFour = { s: "w", marks: [true, true, true, false] };
is("three blanks of four is worth three quarters", entryPoints(threeOfFour, on, Q.b1), 3);
is("...and nothing when the set says whole answers only", entryPoints(threeOfFour, off, Q.b1), 0);
is("all four is the whole mark", entryPoints({ s: "c", marks: [true, true, true, true] }, on, Q.b1), 4);
is("none of them is nothing", entryPoints({ s: "w", marks: [false, false, false, false] }, on, Q.b1), 0);

is("two checks of four is worth half", entryPoints({ checks: "2/4" }, on, Q.c1), 2);
is("...nothing with part marks off", entryPoints({ checks: "2/4" }, off, Q.c1), 0);
is("all four checks is the whole mark", entryPoints({ s: "c", checks: "4/4" }, on, Q.c1), 4);

// the promise made when they passed: passing once keeps the whole mark
is("passed once, then broke it: still the whole mark", entryPoints({ s: "c", checks: "1/4" }, on, Q.c1), 4);
is("...and the same with part marks off", entryPoints({ s: "c", checks: "1/4" }, off, Q.c1), 4);

is("a hint still costs, on top of a part mark", entryPoints({ s: "w", marks: [true, true, true, false], h: true }, on, Q.b1), 2.5);
is("a hand mark still wins over everything", entryPoints({ s: "w", marks: [false, false, false, false], awarded: 3 }, on, Q.b1), 3);

is("the grid shows partly-right, not wrong", cellCode(Q.b1, threeOfFour, on), "p");
is("...and plain wrong when part marks are off", cellCode(Q.b1, threeOfFour, off), "w");

const st = stats(on, { b1: threeOfFour, c1: { checks: "2/4" } });
is("the total adds the parts", st.score, 5);
is("out of the full marks", st.max, 8);
is("neither counts as a correct answer", st.correct, 0);

is("an untouched question scores nothing", partPoints(undefined, on, Q.b1), 0);
is("a blanks question with no marks recorded scores nothing", partPoints({ s: "w" }, on, Q.b1), 0);
