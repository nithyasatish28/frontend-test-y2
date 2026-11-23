// Question sets: the list, and the two ways to start one.
//
// Every instructor finds the starter sets already in their list the first time they look. They
// are copies, owned by them, to change or delete as they like — so this runs once per person and
// remembers that it has, rather than putting them back each time the page is opened.
import { esc, day, uid as randomId, toast } from "../lib/util.js";
import { STARTER_SETS } from "../data/starter-sets.js";
import { downloadTemplate, uploadCSV } from "./csv-questions.js";

const TYPE_NAMES = { mcq: "multiple choice", blanks: "fill in the blanks", code: "code" };
export const blankSet = () => ({
  title: "New question set", description: "", minutes: 45, points: 1, hintPenalty: 0.5, partMarks: true,
  // A neutral name: a part can hold any mix of question types, and naming it after one of
  // them reads like a contradiction the moment you add another kind.
  sections: [{ id: "s" + randomId(6), title: "Part A" }], questions: [],
});

export function mount(view, ctx) {
  const { store } = ctx;
  view.innerHTML = `
    <div class="page-head"><h1>Question sets</h1>
      <button class="btn ghost" data-tpl type="button">Download CSV template</button>
      <button class="btn ghost" data-csv type="button">Upload CSV</button>
      <button class="btn" data-new type="button">New question set</button></div>
    <p class="sub" style="margin:-6px 0 0">A question set is a test you can reuse. The two starter sets are yours to change or delete. To write questions in Excel or Google Sheets, download the CSV template, fill it in, and upload it. Each session copies the questions when it’s created, so editing a set never changes past results.</p>
    <div class="set-cards" data-cards></div>
    <input type="file" accept=".csv,text/csv" data-csvfile hidden>`;
  const $ = s => view.querySelector(s);
  let sets = [];
  const draw = () => {
    $("[data-cards]").innerHTML = sets.length ? sets.map(s => {
      const qs = s.questions || [], counts = {};
      qs.forEach(q => { const k = q.type === "code" ? (q.lang === "python" ? "Python" : q.lang === "terminal" ? "terminal" : q.lang === "react" ? "React" : "JavaScript") + " code" : TYPE_NAMES[q.type]; counts[k] = (counts[k] || 0) + 1; });
      return `<a class="set-card" href="#/questions/${esc(s.id)}"><h3>${esc(s.title || "Untitled")}</h3>
        <div class="meta">${qs.length} question${qs.length === 1 ? "" : "s"} · ${s.minutes || 45} min${s.updatedAt ? " · edited " + day(s.updatedAt) : ""}${
          ctx.role === "super" && s.ownerUid && s.ownerUid !== ctx.user.uid ? ` · <b>${esc(s.ownerName || "another instructor")}</b>` : ""}</div>
        ${s.description ? `<div>${esc(s.description)}</div>` : ""}
        <div class="meta">${Object.entries(counts).map(([k, n]) => `${n} ${esc(k)}`).join(" · ")}</div></a>`;
    }).join("") : `<div class="card"><p style="margin:0">Setting up your question sets…</p></div>`;
  };
  let seeding = false;
  const off = store.watchSets(async (l, err) => {
    if (err) return toast(err.message, "err");
    sets = l; draw();
    // Nothing of their own, and they have never been given the starters: hand them over once.
    if (sets.length || seeding || ctx.settings.starters || !ctx.user) return;
    seeding = true;
    try {
      for (const starter of STARTER_SETS) {
        await store.saveSet(null, { ...JSON.parse(JSON.stringify(starter)), ownerUid: ctx.user.uid, ownerName: ctx.user.email || "" });
      }
      await store.setSettings({ starters: true }, ctx.user.uid);
    } catch (e) { toast(e.message, "err"); seeding = false; }
  }, ctx.scope());

  $("[data-new]").addEventListener("click", async () => {
    try { const id = await store.saveSet(null, { ...blankSet(), ownerUid: ctx.user.uid, ownerName: ctx.user.email || "" }); ctx.go("#/questions/" + id); } catch (e) { toast(e.message, "err"); }
  });
  $("[data-tpl]").addEventListener("click", downloadTemplate);
  $("[data-csv]").addEventListener("click", () => $("[data-csvfile]").click());
  $("[data-csvfile]").addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; if (f) uploadCSV(ctx, f); });
  return off;
}
