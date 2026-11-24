// Moving between questions re-renders the card from scratch. The ticks and crosses from the last
// run have to come back with it: a student who glances at A2 and returns to A1 shouldn't have to
// run everything again, on a clock.
import { is, fakeDom, tick } from "./helpers.mjs";
await fakeDom(`<div id="card"></div>`);
const { renderQuestion } = await import("../js/ui/question.js");
const { publishSet } = await import("../js/lib/grade.js");

const set = { sections: [{ id: "s1", title: "A" }], questions: [{
  id: "c1", section: "s1", type: "code", title: "Login", prompt: "Write it", lang: "python", starter: "def login(): pass",
  tests: [{ name: "Correct password", expr: "1", op: "equals", expected: "1" },
          { name: "Wrong password", expr: "1", op: "equals", expected: "1" },
          { name: "Error message", expr: "1", op: "equals", expected: "1" }] }] };
const session = { ...publishSet(set, "salt"), salt: "salt", points: 2, hintPenalty: 0.5, partMarks: true };
const q = session.questions[0], card = document.getElementById("card");
const draw = entry => renderQuestion(card, { q, entry, session, isLocked: () => false, onChange: () => {} });
const marks = () => [...card.querySelectorAll(".checks li")].map(li => li.firstElementChild.textContent);
const whys = () => [...card.querySelectorAll(".checks .why")].map(w => w.textContent);

// ── a fresh question shows nothing run yet ──
draw({}); await tick(20);
is("nothing is ticked before a run", marks(), ["○", "○", "○"]);

// ── what a run leaves behind, and what comes back with it ──
const ran = {
  code: "def login(): return 1", checked: "def login(): return 1", checks: "2/3",
  results: [{ pass: true, why: "" }, { pass: true, why: "" },
            { pass: false, why: "Your code gave back 'Invalid username or password'." }],
};
draw(ran); await tick(20);
is("the last run comes back", marks(), ["✓", "✓", "✗"]);
is("so does the reason it failed", whys(), ["Your code gave back 'Invalid username or password'."]);
is("and the count is said out loud", card.querySelector(".console").textContent.includes("2/3"), true);

// ── but never against code that has been edited since ──
draw({ ...ran, code: "def login(): return 2" }); await tick(20);
is("an edit clears the old result", marks(), ["○", "○", "○"]);
is("and the reason goes with it", whys(), []);

// ── an exam shows the student nothing either way ──
const examS = { ...session, examMode: true };
renderQuestion(card, { q, entry: ran, session: examS, isLocked: () => false, onChange: () => {} });
await tick(20);
is("an exam never shows a result", marks(), ["○", "○", "○"]);

// ── a half-written result can't break the render ──
for (const bad of [{ results: "nonsense" }, { results: [] }, { results: [{ pass: true }], checked: "x", code: "x" }]) {
  draw({ code: "x", checked: "x", checks: "1/3", ...bad }); await tick(20);
  is("a malformed result is survivable", card.querySelectorAll(".checks li").length, 3);
}
