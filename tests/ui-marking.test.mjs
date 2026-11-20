import { is, fakeDom } from "./helpers.mjs";
const dom = await fakeDom(``);
// jsdom has no <dialog> behaviour

const { markingDialog, unmarkedCount, subjectiveQuestions } = await import("../js/admin/marking.js");
const { publishSet, stats } = await import("../js/lib/grade.js");


const set = { sections: [{ id: "s1", title: "Written" }], questions: [
  { id: "w1", section: "s1", type: "subjective", title: "Why state", prompt: "Explain why.", expected: "MY MARKING NOTES", points: 5 },
  { id: "w2", section: "s1", type: "subjective", title: "Debugging", prompt: "Your steps?", expected: "notes 2", points: 4 },
] };
const session = { ...publishSet(set, "salt"), salt: "salt", points: 1, hintPenalty: 0.5, id: "sess1", setId: "set1" };

const rows = [
  { id: "u1", name: "Radhika", status: "submitted", q: { w1: { text: "React re-runs the function." } } },
  { id: "u2", name: "Tejas",   status: "submitted", q: { w1: { text: "Because state.", h: true }, w2: { text: "Read the error first." } } },
  { id: "u3", name: "Priya",   status: "working",   q: { w1: { text: "Not finished yet" } } },
  { id: "u4", name: "Arjun",   status: "submitted", q: {} },
];

const writes = [];
const originalSet = { id: "set1", questions: [
  { id: "w1", type: "subjective", expected: "MY MARKING NOTES" },
  { id: "w2", type: "subjective", expected: "notes 2" },
] };
const ctx = { store: {
  saveAttempt: async (sid, uid, patch) => { writes.push({ sid, uid, patch }); },
  getSet: async id => (id === "set1" ? originalSet : null),
} };

is("finds both written questions", subjectiveQuestions(session).length, 2);
is("counts the unmarked answers that are ready", unmarkedCount(session, rows), 3);

// ── open it, mid-test: only submitted students ──
markingDialog(ctx, "sess1", session, rows, { ended: false });
await new Promise(r => setTimeout(r, 10));        // the notes are fetched, then it redraws
let dlg = document.querySelector("dialog.dlg");
is("the dialog opened", !!dlg, true);
is("shows the first question", dlg.textContent.includes("Why state"), true);
is("shows MY marking notes", dlg.textContent.includes("MY MARKING NOTES"), true);
is("and the student never could have", JSON.stringify(session.questions).includes("MY MARKING NOTES"), false);
is("lists the submitted students who wrote", [...dlg.querySelectorAll(".markrow .who b")].map(b => b.textContent), ["Radhika", "Tejas"]);
is("leaves out the one still working", dlg.textContent.includes("Priya"), false);
is("leaves out the one who wrote nothing", dlg.textContent.includes("Arjun"), false);
is("counts the one still being written", dlg.textContent.includes("1 still being written"), true);
is("flags who used a hint", dlg.querySelectorAll(".markrow")[1].textContent.includes("used the hint"), true);
is("two still to mark", dlg.textContent.includes("<b>2</b>") || dlg.querySelector("p.note").innerHTML.includes("2</b>"), true);

// ── give a part mark ──
const first = dlg.querySelectorAll(".markrow")[0];
const award = first.querySelector("[data-award]");
award.value = "3.5";
first.querySelector("[data-note]").value = "Good, but say more about redrawing.";
award.dispatchEvent(new dom.window.Event("change"));
await new Promise(r => setTimeout(r, 10));
is("one write went to the store", writes.length, 1);
is("...for the right student", writes[0].uid, "u1");
const { cyrb53 } = await import("../js/lib/grade.js");
is("...with the mark and note", writes[0].patch, { q: { w1: { awarded: 3.5, note: "Good, but say more about redrawing.", markedHash: cyrb53("React re-runs the function.") } } });
is("the row says it is marked", first.querySelector("[data-state]").textContent, "Marked 3.5 / 5");
is("the row turns green", first.classList.contains("done"), true);

// ── the Full and 0 shortcuts ──
const second = dlg.querySelectorAll(".markrow")[1];
second.querySelector("[data-full]").click();
await new Promise(r => setTimeout(r, 10));
is("Full gives full marks", writes[1].patch.q.w1.awarded, 5);
second.querySelector("[data-zero]").click();
await new Promise(r => setTimeout(r, 10));
is("0 gives zero", writes[2].patch.q.w1.awarded, 0);

// ── marks outside the range are refused ──
award.value = "99";
award.dispatchEvent(new dom.window.Event("change"));
await new Promise(r => setTimeout(r, 10));
is("too many marks is refused", writes.length, 3);
is("...and says so", first.querySelector("[data-state]").textContent.includes("between 0 and 5"), true);

// ── move to the next question ──
dlg.querySelector("[data-next]").click();
is("second question opens", dlg.textContent.includes("Debugging"), true);
is("out of 4 marks this time", dlg.textContent.includes("4 marks"), true);
is("only Tejas answered it", [...dlg.querySelectorAll(".markrow .who b")].map(b => b.textContent), ["Tejas"]);

// ── once the test has ended, everyone is markable ──
dlg.querySelector('[data-close=""]').click();
markingDialog(ctx, "sess1", session, rows, { ended: true });
dlg = [...document.querySelectorAll("dialog.dlg")].pop();
is("now the unfinished student is listed too", [...dlg.querySelectorAll(".markrow .who b")].map(b => b.textContent), ["Radhika", "Tejas", "Priya"]);

// ── a session with nothing to mark ──
dlg.querySelector('[data-close=""]').click();
markingDialog(ctx, "sess1", { ...session, questions: [] }, rows, { ended: true });
dlg = [...document.querySelectorAll("dialog.dlg")].pop();
is("says there is nothing to mark", dlg.textContent.includes("No written answers here"), true);

