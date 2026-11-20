import { is, fakeDom } from "./helpers.mjs";
const dom = await fakeDom(`<div id="card"></div>`);

const { renderQuestion } = await import("../js/ui/question.js");
const { publishSet, stats, entryPoints } = await import("../js/lib/grade.js");


const set = { sections: [{ id: "s1", title: "Written" }], questions: [{
  id: "w1", section: "s1", type: "subjective", title: "Why state", prompt: "Explain **why**.",
  code: "let n = 0;", codeLang: "js", rows: 9, guidance: "Four sentences.",
  expected: "SECRET NOTES", points: 5, hint: "Think about redraws." }] };
const session = { ...publishSet(set, "salt"), salt: "salt", points: 1, hintPenalty: 0.5 };
const q = session.questions[0];
const card = document.getElementById("card");

// ── a student opens it ──
const entry = {};
let changes = 0;
let locked = false;
renderQuestion(card, { q, entry, session, isLocked: () => locked, onChange: () => changes++ });

is("the answer box is there", !!card.querySelector("textarea[data-answer]"), true);
is("box is the size the question asked for", card.querySelector("textarea").getAttribute("rows"), "9");
is("the code block is shown", card.querySelector("pre.show").textContent.includes("let n = 0;"), true);
is("the guidance note is shown", card.textContent.includes("Four sentences."), true);
is("marking notes are NOT on the page", card.innerHTML.includes("SECRET NOTES"), false);
is("points shown as 5", card.querySelector(".qhead").textContent.includes("5 points"), true);
is("says the instructor marks it", card.textContent.includes("marks it by hand"), true);
is("starts with nothing written", card.querySelector("[data-count]").textContent, "Nothing written yet");

// ── they type ──
const ta = card.querySelector("textarea[data-answer]");
ta.value = "React runs the function again to draw it.";
ta.dispatchEvent(new dom.window.Event("input"));
is("what they typed is kept", entry.text, "React runs the function again to draw it.");
is("word count updates", card.querySelector("[data-count]").textContent, "8 words");
is("the page told the test to save", changes > 0, true);
is("still unmarked, so no score", entryPoints(entry, session, q), 0);
is("counts as pending", stats(session, { w1: entry }).pending, 1);

// ── the hint still works and still costs ──
const hintBtn = card.querySelector(".hintbtn");
is("a hint is offered", !!hintBtn, true);
hintBtn.click(); hintBtn.click();                       // armed, then confirmed
is("hint taken", entry.h, true);
is("hint costs half a point", entryPoints(entry, session, q), -0.5);

// ── time is up ──
locked = true;
renderQuestion(card, { q, entry, session, isLocked: () => locked, onChange: () => {} });
is("box is disabled once locked", card.querySelector("textarea").disabled, true);
is("tells them it is with the instructor", card.textContent.includes("marks it by hand"), true);

// ── the instructor has marked it ──
entry.awarded = 3.5; entry.note = "Good, but what about redrawing?";
renderQuestion(card, { q, entry, session, isLocked: () => true, onChange: () => {} });
is("the mark is shown", card.textContent.includes("3.5 of 5"), true);
is("the note is shown", card.textContent.includes("what about redrawing"), true);
is("scores the mark, less the hint", entryPoints(entry, session, q), 3);
is("no longer pending", stats(session, { w1: entry }).pending, 0);

