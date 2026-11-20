import { is, fakeDom, tick } from "./helpers.mjs";
const dom = await fakeDom(``);

const { markingDialog } = await import("../js/admin/marking.js");
const { publishSet, cyrb53 } = await import("../js/lib/grade.js");


const set = { sections: [{ id: "s1", title: "W" }], questions: [
  { id: "w1", section: "s1", type: "subjective", title: "Explain", prompt: "Why?", expected: "NOTES", points: 5 }] };
const base = { ...publishSet(set, "salt"), salt: "salt", points: 1, hintPenalty: 0.5, setId: "set1" };
const originalSet = { id: "set1", questions: [{ id: "w1", expected: "NOTES" }] };

const writes = [], sessionWrites = [];
const ctx = { store: {
  saveAttempt: async (sid, uid, patch) => { writes.push({ uid, patch }); },
  updateSession: async (sid, patch) => { sessionWrites.push(patch); },
  getSet: async () => originalSet,
} };

const rows = () => [
  { id: "u1", name: "Radhika", status: "working",   q: { w1: { text: "halfway through", handed: true } } },
  { id: "u2", name: "Tejas",   status: "submitted", q: { w1: { text: "all done" } } },
];

// ── live off: only the submitted student ──
markingDialog(ctx, "s1", { ...base, liveMarking: false }, rows(), { ended: false });
await tick();
let dlg = [...document.querySelectorAll("dialog.dlg")].pop();
is("live off: a handed-in answer is ignored, only submitted", [...dlg.querySelectorAll(".markrow .who b")].map(b => b.textContent), ["Tejas"]);
is("the switch is off", dlg.querySelector("[data-live]").checked, false);
is("explains the off mode", dlg.textContent.includes("once they submit"), true);

// ── flipping it writes to the session ──
const sw = dlg.querySelector("[data-live]");
sw.checked = true; sw.dispatchEvent(new dom.window.Event("change"));
await tick();
is("flipping saves liveMarking", sessionWrites, [{ liveMarking: true }]);

// ── live on: everyone, finished or not ──
markingDialog(ctx, "s1", { ...base, liveMarking: true }, rows(), { ended: false });
await tick();
dlg = [...document.querySelectorAll("dialog.dlg")].pop();
is("live on: handed in, plus submitted", [...dlg.querySelectorAll(".markrow .who b")].map(b => b.textContent), ["Radhika", "Tejas"]);
is("marks who handed in", dlg.querySelectorAll(".markrow")[0].textContent.includes("handed in"), true);
is("the switch is on", dlg.querySelector("[data-live]").checked, true);

// ── mark a student who is still typing ──
const first = dlg.querySelectorAll(".markrow")[0];
first.querySelector("[data-award]").value = "2";
first.querySelector("[data-award]").dispatchEvent(new dom.window.Event("change"));
await tick();
is("the mark is saved", writes[0].patch.q.w1.awarded, 2);
is("...with the text it was given for", writes[0].patch.q.w1.markedHash, cyrb53("halfway through"));

// ── they carry on writing: the mark is flagged as stale ──
const later = rows();
later[0].q.w1 = { text: "halfway through, plus much more", handed: true, awarded: 2, markedHash: cyrb53("halfway through") };
markingDialog(ctx, "s1", { ...base, liveMarking: true }, later, { ended: false });
await tick();
dlg = [...document.querySelectorAll("dialog.dlg")].pop();
is("warns the answer changed after marking", dlg.querySelectorAll(".markrow")[0].textContent.includes("answered again since you marked"), true);

// ── unchanged since marking: no warning ──
const same = rows();
same[0].q.w1 = { text: "halfway through", handed: true, awarded: 2, markedHash: cyrb53("halfway through") };
markingDialog(ctx, "s1", { ...base, liveMarking: true }, same, { ended: false });
await tick();
dlg = [...document.querySelectorAll("dialog.dlg")].pop();
is("no warning when it is unchanged", dlg.textContent.includes("answered again since you marked"), false);

