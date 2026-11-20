import { is, fakeDom } from "./helpers.mjs";
const dom = await fakeDom(`<div id="card"></div>`);

const { renderQuestion } = await import("../js/ui/question.js");
const { publishSet, sessionSecret, answerKeyFor, stats, isDone } = await import("../js/lib/grade.js");
const { auditSession } = await import("../js/admin/regrade.js");


const set = { sections: [{ id: "s1", title: "A" }], questions: [
  { id: "m1", section: "s1", type: "mcq", title: "Pick", prompt: "?", options: ["no", "yes", "maybe"], answer: 1 },
  { id: "b1", section: "s1", type: "blanks", title: "Fill", prompt: "?", code: "const __1__ = 2;",
    blanks: [{ n: 1, accept: ["total", "sum"] }] },
] };
const salt = "exam-salt";
const secret = sessionSecret(set, salt);
let session = { ...publishSet(set, salt, { exam: true }), examMode: true, points: 2, hintPenalty: 0.5, minutes: 30 };
const card = document.getElementById("card");
const draw = (q, entry) => renderQuestion(card, { q, entry, session, isLocked: () => false, onChange: () => {} });

/* ── during the exam ── */
const mine = { m1: {}, b1: {} };
const Q = Object.fromEntries(session.questions.map(q => [q.id, q]));
draw(Q.m1, mine.m1);
is("no key reached the browser", "key" in Q.m1, false);
card.querySelectorAll(".opt")[2].click();                 // pick the WRONG option
card.querySelector("[data-submit]").click();
is("the answer is locked in", mine.m1.handed, true);
is("but nothing is marked", mine.m1.s, undefined);
is("the student is told so", card.textContent.includes("releases the results"), true);
is("it counts as done", isDone(Q.m1, mine.m1, session), true);
is("score stays zero while unmarked", stats(session, mine).score, 0);

draw(Q.b1, mine.b1);
card.querySelector("input[data-k]").value = "sum";
card.querySelector("input[data-k]").dispatchEvent(new dom.window.Event("input"));
card.querySelector("[data-submit]").click();
is("blanks lock in too, unmarked", [mine.b1.handed, mine.b1.s], [true, undefined]);

/* ── the instructor marks it from the kept-back copy ── */
const rows = [{ id: "u1", name: "Radhika", status: "submitted", q: mine }];
const { rows: marked } = await auditSession(session, rows, { keys: secret });
const fixes = Object.fromEntries(marked[0].fixes.map(f => [f.q.id, f.fix]));
is("marking produced a verdict for each", Object.keys(fixes).sort(), ["b1", "m1"]);
is("the wrong MCQ is marked wrong", fixes.m1.s, "w");
is("the right blank is marked correct", fixes.b1.s, "c");
is("...with the per-blank detail", fixes.b1.marks, [true]);
is("the score after marking", marked[0].true_.score, 2);

/* ── released ── */
Object.assign(mine.m1, fixes.m1); Object.assign(mine.b1, fixes.b1);
session = { ...session, resultsReleased: true, answers: answerKeyFor(secret) };
draw(Q.m1, mine.m1);
is("the student now sees it was wrong", card.textContent.includes("Not correct"), true);
is("...and which one was right", card.textContent.includes("The answer was B"), true);
is("...with the right option highlighted", !!card.querySelector(".opt.was-right"), true);
draw(Q.b1, mine.b1);
is("a correct blank just says so", card.textContent.includes("All blanks right"), true);

// a wrong blank is told what was accepted
const wrongB = { vals: ["nope"], s: "w", marks: [false], handed: true };
draw(Q.b1, wrongB);
is("a wrong blank shows the accepted answers", card.textContent.includes("total / sum"), true);

