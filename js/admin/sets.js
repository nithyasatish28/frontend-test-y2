// Question sets: the list, new / starter / import.
import { esc, day, uid as randomId, toast } from "../lib/util.js";
import { STARTER_SETS } from "../data/starter-sets.js";
import { dialog } from "./dialog.js";
import { downloadTemplate, uploadCSV } from "./csv-questions.js";

const TYPE_NAMES = { mcq: "multiple choice", blanks: "fill in the blanks", code: "code" };
export const blankSet = () => ({
  title: "New question set", description: "", minutes: 45, points: 1, hintPenalty: 0.5,
  sections: [{ id: "s" + randomId(6), title: "Multiple choice" }], questions: [],
});

export function mount(view, ctx) {
  const { store } = ctx;
  view.innerHTML = `
    <div class="page-head"><h1>Question sets</h1>
      <button class="btn ghost" data-tpl type="button">Download CSV template</button>
      <button class="btn ghost" data-csv type="button">Upload CSV</button>
      <button class="btn ghost" data-import type="button">Import a file</button>
      <button class="btn ghost" data-starter type="button">Add a starter set</button>
      <button class="btn" data-new type="button">New question set</button></div>
    <p class="sub" style="margin:-6px 0 0">A question set is a test you can reuse. To write questions in Excel or Google Sheets, download the CSV template, fill it in, and upload it. Each session copies the questions when it’s created, so editing a set never changes past results.</p>
    <div class="set-cards" data-cards></div>
    <input type="file" accept=".json,application/json" data-file hidden>
    <input type="file" accept=".csv,text/csv" data-csvfile hidden>`;
  const $ = s => view.querySelector(s);
  let sets = [];
  const draw = () => {
    $("[data-cards]").innerHTML = sets.length ? sets.map(s => {
      const qs = s.questions || [], counts = {};
      qs.forEach(q => { const k = q.type === "code" ? (q.lang === "python" ? "Python" : q.lang === "terminal" ? "terminal" : q.lang === "react" ? "React" : "JavaScript") + " code" : TYPE_NAMES[q.type]; counts[k] = (counts[k] || 0) + 1; });
      return `<a class="set-card" href="#/questions/${esc(s.id)}"><h3>${esc(s.title || "Untitled")}</h3>
        <div class="meta">${qs.length} question${qs.length === 1 ? "" : "s"} · ${s.minutes || 45} min${s.updatedAt ? " · edited " + day(s.updatedAt) : ""}</div>
        ${s.description ? `<div>${esc(s.description)}</div>` : ""}
        <div class="meta">${Object.entries(counts).map(([k, n]) => `${n} ${esc(k)}`).join(" · ")}</div></a>`;
    }).join("") : `<div class="card"><p style="margin:0">No question sets yet. Start from a <b>starter set</b> (the original JS + React test, or a Python sample), or make a new one.</p></div>`;
  };
  const off = store.watchSets((l, err) => { if (err) toast(err.message, "err"); sets = l; draw(); });

  $("[data-new]").addEventListener("click", async () => {
    try { const id = await store.saveSet(null, blankSet()); ctx.go("#/questions/" + id); } catch (e) { toast(e.message, "err"); }
  });
  $("[data-starter]").addEventListener("click", async () => {
    const d = dialog(`<div class="dlg-body"><h2>Add a starter set</h2><p class="note" style="margin-top:0">This makes your own copy, which you can change.</p>
      ${STARTER_SETS.map((s, i) => `<button class="set-card" style="width:100%;text-align:left;margin:8px 0;cursor:pointer" data-close="${i}" type="button"><h3>${esc(s.title)}</h3><div class="meta">${s.questions.length} questions · ${s.minutes} min</div><div>${esc(s.description)}</div></button>`).join("")}
      </div><div class="dlg-foot"><button class="btn ghost" data-close type="button">Cancel</button></div>`);
    const pick = await d.done;
    if (pick == null || pick === "") return;
    try { const id = await store.saveSet(null, JSON.parse(JSON.stringify(STARTER_SETS[Number(pick)]))); toast("Added"); ctx.go("#/questions/" + id); }
    catch (e) { toast(e.message, "err"); }
  });
  $("[data-tpl]").addEventListener("click", downloadTemplate);
  $("[data-csv]").addEventListener("click", () => $("[data-csvfile]").click());
  $("[data-csvfile]").addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; if (f) uploadCSV(ctx, f); });
  $("[data-import]").addEventListener("click", () => $("[data-file]").click());
  $("[data-file]").addEventListener("change", async e => {
    const file = e.target.files[0]; e.target.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const set = data.questionSet || data;
      if (!Array.isArray(set.questions) || !Array.isArray(set.sections)) throw new Error("That file isn’t a question set. Use a file from “Download as a file” in the question editor.");
      const { id: _x, createdAt: _c, updatedAt: _u, ...clean } = set;
      const id = await store.saveSet(null, { ...clean, title: (clean.title || "Imported set") });
      toast("Imported"); ctx.go("#/questions/" + id);
    } catch (ex) { toast(ex.message.startsWith("Unexpected") ? "That file isn’t valid JSON." : ex.message, "err"); }
  });
  return off;
}
