import { is, fakeDom, tick } from "./helpers.mjs";
const dom = await fakeDom(`<div id="card"></div>`);

const { renderQuestion } = await import("../js/ui/question.js");
const { markingDialog, unmarkedCount, readyToMark } = await import("../js/admin/marking.js");
const { publishSet } = await import("../js/lib/grade.js");


const set = { sections: [{ id: "s1", title: "W" }], questions: [
  { id: "w1", section: "s1", type: "subjective", title: "Explain", prompt: "Why?", expected: "NOTES", points: 5 }] };
const pub = publishSet(set, "salt");
const liveS = { ...pub, salt: "salt", points: 1, hintPenalty: 0.5, setId: "set1", liveMarking: true };
const plainS = { ...pub, salt: "salt", points: 1, hintPenalty: 0.5, setId: "set1", liveMarking: false };
const q = liveS.questions[0], card = document.getElementById("card");

/* ── the student, in a live-marked session ── */
const entry = {};
let kinds = [];
const draw = (sess, e) => renderQuestion(card, { q, entry: e, session: sess, isLocked: () => false, onChange: k => kinds.push(k) });

draw(liveS, entry);
is("live: a Hand in button appears", !!card.querySelector("[data-hand]"), true);
is("live: explains it can't be changed after", card.textContent.includes("can’t change it afterwards"), true);

// pressing it with an empty box does nothing
card.querySelector("[data-hand]").click();
is("won't hand in an empty answer", entry.handed, undefined);
is("...and says so", card.querySelector("[data-count]").textContent, "Write something first.");

// write, then hand in — two presses
const ta = card.querySelector("textarea[data-answer]");
ta.value = "A trend is the long-term direction.";
ta.dispatchEvent(new dom.window.Event("input"));
const hand = card.querySelector("[data-hand]");
hand.click();
is("first press only arms it", entry.handed, undefined);
is("...and asks to confirm", hand.textContent.includes("Sure?"), true);
hand.click();
is("second press hands it in", entry.handed, true);
is("saved straight away, not on a debounce", kinds.includes("answer"), true);
is("the box is now read-only", card.querySelector("textarea").disabled, true);
is("tells them it is being marked", card.textContent.includes("can’t change it now"), true);
is("the button is gone", !!card.querySelector("[data-hand]"), false);

/* ── the same question in a normal session ── */
const entry2 = { text: "something" };
draw(plainS, entry2);
is("not live: no Hand in button", !!card.querySelector("[data-hand]"), false);
is("not live: still says nothing to submit", card.textContent.includes("nothing to submit"), true);
is("not live: the box stays open", card.querySelector("textarea").disabled, false);

/* ── what the instructor can mark ── */
const rows = [
  { id: "u1", name: "Handed",    status: "working",   q: { w1: { text: "done writing", handed: true } } },
  { id: "u2", name: "Writing",   status: "working",   q: { w1: { text: "still going" } } },
  { id: "u3", name: "Submitted", status: "submitted", q: { w1: { text: "whole test in" } } },
];
is("live: only handed-in and submitted are ready",
   rows.filter(r => readyToMark(liveS, r, r.q.w1, false)).map(r => r.name), ["Handed", "Submitted"]);
is("not live: only the submitted student",
   rows.filter(r => readyToMark(plainS, r, r.q.w1, false)).map(r => r.name), ["Submitted"]);
is("once the test ends: everyone",
   rows.filter(r => readyToMark(plainS, r, r.q.w1, true)).map(r => r.name), ["Handed", "Writing", "Submitted"]);
is("the button count follows the same rule", unmarkedCount(liveS, rows, false), 2);

const ctx = { store: { saveAttempt: async () => {}, updateSession: async () => {}, getSet: async () => ({ id: "set1", questions: [{ id: "w1", expected: "NOTES" }] }) } };
markingDialog(ctx, "s1", liveS, rows, { ended: false });
await tick();
const dlg = [...document.querySelectorAll("dialog.dlg")].pop();
is("the dialog lists only those two", [...dlg.querySelectorAll(".markrow .who b")].map(b => b.textContent), ["Handed", "Submitted"]);
is("marks who handed in", dlg.querySelectorAll(".markrow")[0].textContent.includes("handed in"), true);
is("counts the one still writing", dlg.textContent.includes("1 still being written"), true);

