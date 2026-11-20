import { is } from "./helpers.mjs";
const { publishSet, stats, entryPoints, cellCode, answerText, isDone, needsMarking, qPoints } = await import("../js/lib/grade.js");
const { auditEntry } = await import("../js/admin/regrade.js");
const { subjectiveQuestions, unmarkedCount } = await import("../js/admin/marking.js");


const salt = "s4lt";
const set = { sections: [{ id: "s1", title: "Part one" }], questions: [
  { id: "m1", section: "s1", type: "mcq", title: "Pick", prompt: "", options: ["no", "yes"], answer: 1 },
  { id: "w1", section: "s1", type: "subjective", title: "Explain state", prompt: "Why useState?",
    code: "let n = 0;", codeLang: "js", rows: 10, guidance: "Four sentences.",
    expected: "SECRET MARKING NOTES: mentions re-render", points: 5 },
] };
const session = { ...publishSet(set, salt), salt, points: 1, hintPenalty: 0.5, minutes: 30 };
const W = session.questions.find(q => q.id === "w1");

// ── what reaches the student ──
is("type survives publishing", W.type, "subjective");
is("marking notes never leave the instructor", W.expected, undefined);
is("no answer key of any kind", [W.key, W.keys], [undefined, undefined]);
is("the readable extras do ship", [W.code, W.rows, W.guidance], ["let n = 0;", 10, "Four sentences."]);
is("its own points carry over", qPoints(W, session), 5);

// ── before it is marked ──
const wrote = { text: "Because React re-runs the component." };
is("writing counts as done", isDone(W, wrote), true);
is("an empty box is not done", isDone(W, { text: "   " }), false);
is("it is waiting to be marked", needsMarking(W, wrote), true);
is("scores nothing yet", entryPoints(wrote, session, W), 0);
is("grid shows 'to mark'", cellCode(W, wrote, session), "m");
is("stats count it as pending", stats(session, { w1: wrote }).pending, 1);

// ── after the instructor marks it ──
const part = { ...wrote, awarded: 3.5, note: "Good, but what about re-drawing?" };
is("part marks count", entryPoints(part, session, W), 3.5);
is("grid shows partly right", cellCode(W, part, session), "p");
is("no longer pending", stats(session, { w1: part }).pending, 0);
is("full marks read as correct", cellCode(W, { ...wrote, awarded: 5 }, session), "c");
is("zero reads as wrong", cellCode(W, { ...wrote, awarded: 0 }, session), "w");

// ── the hint still costs, even on a marked answer ──
is("hint comes off the marks given", entryPoints({ ...part, h: true }, session, W), 3);

// ── totals ──
const full = stats(session, { m1: { s: "c", pick: 1 }, w1: part });
is("total out of", full.max, 6);                 // mcq 1 + written 5
is("score adds the hand mark", full.score, 4.5); // 1 + 3.5
is("CSV gets the written text", answerText(W, part), "Because React re-runs the component.");

// ── re-grading leaves it alone ──
is("re-grade won't touch a hand mark", (await auditEntry(session, W, part)).status, "unchecked");
is("...and says why", (await auditEntry(session, W, part)).why, "marked by hand");
is("...and flags an unmarked one", (await auditEntry(session, W, wrote)).why, "written, not marked yet");

// ── the marking screen's own helpers ──
is("finds the written questions", subjectiveQuestions(session).map(q => q.id), ["w1"]);
is("counts what is ready and still to mark", unmarkedCount(session, [{ status: "submitted", q: { w1: wrote } }, { status: "submitted", q: { w1: part } }, { q: {} }]), 1);
is("...and ignores an answer still being written", unmarkedCount(session, [{ status: "working", q: { w1: wrote } }]), 0);

