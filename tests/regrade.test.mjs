// Marking is done in the student's browser, so a saved mark is a claim. Everything needed to
// check it is already stored, so it can be marked again here and the two compared.
import { is } from "./helpers.mjs";
const { publishSet } = await import("../js/lib/grade.js");
const { auditEntry, auditSession } = await import("../js/admin/regrade.js");

const salt = "testsalt1234";
const set = { sections: [{ id: "s1", title: "Part one" }], questions: [
  { id: "q1", section: "s1", type: "mcq", title: "Pick", prompt: "", options: ["no", "yes", "maybe"], answer: 1 },
  { id: "q2", section: "s1", type: "blanks", title: "Fill", prompt: "", code: "const __1__ = __2__;",
    blanks: [{ n: 1, accept: ["x"] }, { n: 2, accept: ["5", "five"] }] },
  { id: "q3", section: "s1", type: "code", title: "Code", prompt: "", lang: "js", starter: "",
    tests: [{ name: "t", expr: "1", op: "equals", expected: "1" }] },
] };
const session = { ...publishSet(set, salt), salt, points: 2, hintPenalty: 0.5, minutes: 30 };
const Q = Object.fromEntries(session.questions.map(q => [q.id, q]));

is("an honest correct answer agrees", (await auditEntry(session, Q.q1, { s: "c", pick: 1 })).status, "agrees");
const forged = await auditEntry(session, Q.q1, { s: "c", pick: 0 });
is("a forged verdict is caught", forged.status, "disagrees");
is("...and carries the correction", forged.fix, { s: "w" });
is("...and says why", forged.why, "A is wrong");
is("a mark with no choice saved is caught", (await auditEntry(session, Q.q1, { s: "c" })).status, "disagrees");
is("an honest wrong answer agrees", (await auditEntry(session, Q.q1, { s: "w", pick: 2 })).status, "agrees");
is("an untouched question is left alone", (await auditEntry(session, Q.q1, undefined)).status, "unchecked");

is("a second accepted spelling is honoured", (await auditEntry(session, Q.q2, { s: "c", vals: ["x", "five"] })).status, "agrees");
const badBlanks = await auditEntry(session, Q.q2, { s: "c", vals: ["x", "9"] });
is("a forged blanks verdict is caught", badBlanks.status, "disagrees");
is("...with the per-blank detail", badBlanks.fix.marks, [true, false]);
const spaced = await auditEntry(session, Q.q2, { s: "w", vals: ["x", "5 ;"] });
is("spaces and a trailing ; are ignored", spaced.computed, "c");

is("code that passed then changed is ambiguous, not guessed",
   (await auditEntry(session, Q.q3, { s: "c", checked: "x", checks: "2/3" })).status, "unchecked");
is("correct with no code saved is caught",
   (await auditEntry(session, Q.q3, { s: "c", checks: "1/1" })).status, "disagrees");
is("code tests are not re-run unless asked",
   (await auditEntry(session, Q.q3, { s: "c", checked: "x", checks: "1/1" })).status, "unchecked");

const attempts = [
  { id: "u1", name: "Honest", q: { q1: { s: "c", pick: 1 }, q2: { s: "c", vals: ["x", "5"] } } },
  { id: "u2", name: "Forged", q: { q1: { s: "c", pick: 0 }, q2: { s: "c", vals: ["x", "9"] }, q3: { s: "c", h: true } } },
];
const { rows } = await auditSession(session, attempts);
is("the honest student has nothing flagged", rows[0].disagree.length, 0);
is("...and their score is unchanged", rows[0].saved.score === rows[0].true_.score, true);
is("the forged student has three flagged", rows[1].disagree.length, 3);
is("their claimed score", rows[1].saved.score, 5.5);
is("their real score, hint still charged", rows[1].true_.score, -0.5);
