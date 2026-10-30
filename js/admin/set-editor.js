// The question editor: set details, parts, and every question type
// (multiple choice, fill in the blanks, and code in JavaScript, React, Python or terminal commands).
import { esc, uid as randomId, toast, download, confirmClick, debounce } from "../lib/util.js";
import { labelQuestions, publishQuestion, blankNumbers } from "../lib/grade.js";
import { renderQuestion } from "../ui/question.js";
import { createEditor } from "../ui/editor.js";
import { checkCode, LANGS } from "../runner/index.js";
import { DEFAULT_TERMINAL } from "../runner/terminal.js";
import { dialog } from "./dialog.js";

export let leaveGuard = null;

const TYPES = { mcq: "Multiple choice", blanks: "Fill in the blanks", code: "Code" };
const OPS = { equals: "is equal to", includes: "contains the text", matches: "matches the pattern", truthy: "is true", source: "Their code matches the pattern" };
const clone = v => JSON.parse(JSON.stringify(v));
const newQuestion = (type, section) => {
  const base = { id: "q" + randomId(8), section, type, title: "", prompt: "", hint: "" };
  if (type === "mcq") return { ...base, code: "", codeLang: "js", options: ["", "", "", ""], answer: 0 };
  if (type === "blanks") return { ...base, lang: "js", code: "const total = __1__ + 1;", blanks: [{ n: 1, accept: [""] }], anyOrder: false };
  return { ...base, lang: "js", starter: "", solution: "", setup: "", preview: "App", tests: [] };
};

// Problems that would confuse students. Shown above the editor and as a red ! in the list.
export function problems(q) {
  const out = [];
  if (!String(q.title || "").trim()) out.push("has no title");
  if (q.type === "mcq") {
    const opts = q.options || [];
    if (opts.length < 2) out.push("needs at least 2 options");
    if (opts.some(o => !String(o).trim())) out.push("has an empty option");
    if (!(q.answer >= 0 && q.answer < opts.length)) out.push("has no correct option marked");
  } else if (q.type === "blanks") {
    const nums = blankNumbers(q.code);
    if (!nums.length) out.push("has no blanks (write __1__ where a blank goes)");
    if (new Set(nums).size !== nums.length) out.push("uses the same blank number twice");
    for (const n of nums) { const b = (q.blanks || []).find(x => Number(x.n) === n); if (!b || !(b.accept || []).some(a => String(a).trim())) out.push(`blank ${n} has no accepted answer`); }
  } else if (q.lang !== "terminal") {
    if (!(q.tests || []).length) out.push("has no tests, so it can never be marked correct");
    if ((q.tests || []).some(t => t.op !== "source" && !String(t.expr || "").trim())) out.push("has a test with nothing to check");
  } else if (q.terminalError) out.push("has a folder tree that isn’t valid JSON");
  return out;
}

export function mount(view, ctx, setId) {
  const { store } = ctx;
  let set = null, sel = null, dirty = false, saving = false;
  const editors = [];
  view.innerHTML = `<a class="crumb" href="#/questions">← All question sets</a><div class="card"><p class="note" style="margin:0">Loading…</p></div>`;

  leaveGuard = () => !dirty || confirm("You have unsaved changes to this question set. Leave without saving?");
  const onUnload = e => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
  addEventListener("beforeunload", onUnload);
  const onKey = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); } };
  addEventListener("keydown", onKey);

  store.getSet(setId).then(s => {
    if (!s) { view.innerHTML = `<a class="crumb" href="#/questions">← All question sets</a><div class="card"><h2>That question set doesn’t exist</h2></div>`; return; }
    const { id: _id, ...rest } = s;
    set = rest;
    set.sections ||= []; set.questions ||= [];
    if (!set.sections.length) set.sections.push({ id: "s" + randomId(6), title: "Questions" });
    sel = set.questions[0]?.id || null;
    layout();
  }).catch(e => { view.innerHTML = `<div class="card"><h2>Can’t open it</h2><p>${esc(e.message)}</p></div>`; });

  const $ = s => view.querySelector(s);
  const qById = id => set.questions.find(q => q.id === id);
  const labelled = () => labelQuestions(set);
  const markDirty = () => { dirty = true; drawState(); refreshIssues(); };

  function layout() {
    view.innerHTML = `
      <a class="crumb" href="#/questions">← All question sets</a>
      <div class="savebar">
        <span class="state" data-state></span>
        <button class="btn ghost small" data-dl type="button">Download as a file</button>
        <button class="btn ghost small" data-dup type="button">Duplicate set</button>
        <button class="btn ghost small" data-delset type="button">Delete set</button>
        <button class="btn" data-save type="button">Save</button>
      </div>
      <div class="issues" data-issues hidden></div>
      <div class="editor-grid">
        <aside class="card side" data-side></aside>
        <section class="card" data-form></section>
      </div>`;
    $("[data-save]").addEventListener("click", save);
    $("[data-dl]").addEventListener("click", () => download(`${(set.title || "questions").replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.json`, JSON.stringify({ format: "class-test-question-set", version: 1, questionSet: set }, null, 2), "application/json"));
    $("[data-dup]").addEventListener("click", async () => {
      try { const id = await store.saveSet(null, { ...clone(set), title: (set.title || "Untitled") + " (copy)" }); toast("Copied. You’re now editing the copy."); dirty = false; ctx.go("#/questions/" + id); }
      catch (e) { toast(e.message, "err"); }
    });
    $("[data-delset]").addEventListener("click", e => confirmClick(e.currentTarget, async () => {
      try { await store.deleteSet(setId); dirty = false; toast("Question set deleted. Past sessions keep their own copy."); ctx.go("#/questions"); }
      catch (ex) { toast(ex.message, "err"); }
    }, "Click again to delete the set"));
    drawSide(); drawForm(); drawState(); refreshIssues();
  }
  function drawState() {
    const s = $("[data-state]"); if (!s) return;
    s.className = "state" + (dirty ? " dirty" : "");
    s.textContent = saving ? "Saving…" : dirty ? "Unsaved changes (Ctrl + S saves)" : "All changes saved";
    $("[data-save]").disabled = saving || !dirty;
  }
  function refreshIssues() {
    const box = $("[data-issues]"); if (!box) return;
    const list = [];
    if (!String(set.title || "").trim()) list.push("The set has no title.");
    labelled().forEach(q => problems(q).forEach(p => list.push(`${q.label} ${p}.`)));
    box.hidden = !list.length;
    box.innerHTML = `<b>Fix before using this set in a session:</b><ul>${list.slice(0, 8).map(x => `<li>${esc(x)}</li>`).join("")}${list.length > 8 ? `<li>…and ${list.length - 8} more</li>` : ""}</ul>`;
    view.querySelectorAll(".qitem").forEach(b => { const q = qById(b.dataset.id); b.querySelector(".warnmark").textContent = q && problems(q).length ? "!" : ""; });
  }
  async function save() {
    if (!dirty || saving) return;
    saving = true; drawState();
    // drop accepted answers for blanks that are no longer in the code
    for (const q of set.questions) if (q.type === "blanks") { const nums = blankNumbers(q.code); q.blanks = (q.blanks || []).filter(b => nums.includes(Number(b.n))); }
    try { await store.saveSet(setId, clean(set)); dirty = false; toast("Saved"); }
    catch (e) { toast("Couldn’t save: " + e.message, "err"); }
    saving = false; drawState();
  }
  const clean = s => { const c = clone(s); c.questions.forEach(q => { delete q.terminalError; delete q.terminalText; }); return c; };

  /* ─────────── left side: set details, parts, question list ─────────── */
  function drawSide() {
    // keep the list in part order, so moving up/down follows what you see
    const order = new Map(set.sections.map((s, i) => [s.id, i]));
    set.questions = set.questions.map((q, i) => [q, i]).sort((a, b) => (order.get(a[0].section) ?? 1e9) - (order.get(b[0].section) ?? 1e9) || a[1] - b[1]).map(x => x[0]);
    const side = $("[data-side]"), lab = labelled();
    side.innerHTML = `
      <label class="field"><span>Set title</span><input data-k="title" value="${esc(set.title)}"></label>
      <label class="field"><span>Description <small>(only you see it)</small></span><input data-k="description" value="${esc(set.description || "")}"></label>
      <div class="form-grid cols-3">
        <label class="field"><span>Minutes</span><input data-k="minutes" type="number" min="1" max="300" value="${set.minutes ?? 45}"></label>
        <label class="field"><span>Points</span><input data-k="points" type="number" min="0.5" step="0.5" value="${set.points ?? 1}"></label>
        <label class="field"><span>Hint cost</span><input data-k="hintPenalty" type="number" min="0" step="0.25" value="${set.hintPenalty ?? 0.5}"></label>
      </div>
      <h3>Parts and questions</h3>
      ${set.sections.map((s, i) => {
        const qs = lab.filter(q => q.section === s.id);
        return `<div class="sec-row"><b>${String.fromCharCode(65 + i)}</b><input data-sec="${esc(s.id)}" value="${esc(s.title)}" aria-label="Part ${String.fromCharCode(65 + i)} name">
          <button class="icon-btn" data-secup="${i}" type="button" title="Move part up" ${i === 0 ? "disabled" : ""}>↑</button>
          <button class="icon-btn" data-secdel="${i}" type="button" title="${qs.length ? "Move or delete its questions first" : "Delete this part"}" ${qs.length || set.sections.length === 1 ? "disabled" : ""}>✕</button></div>
          <div class="qitems">${qs.map(q => `<button class="qitem${q.id === sel ? " on" : ""}" data-id="${esc(q.id)}" type="button"><span class="lab">${q.label}</span><span class="ttl">${esc(q.title || "(no title)")}</span><span class="warnmark"></span><span class="typ">${q.type === "code" ? esc(q.lang === "react" ? "React" : q.lang === "python" ? "Python" : q.lang === "terminal" ? "Terminal" : "JS") : q.type === "mcq" ? "MCQ" : "Blanks"}</span></button>`).join("")}</div>
          <div class="addrow"><button data-add="mcq" data-to="${esc(s.id)}" type="button">+ Multiple choice</button><button data-add="blanks" data-to="${esc(s.id)}" type="button">+ Blanks</button><button data-add="code" data-to="${esc(s.id)}" type="button">+ Code</button></div>`;
      }).join("")}
      <button class="btn ghost small" data-addsec type="button" style="margin-top:10px">+ Add a part</button>`;
    side.querySelectorAll("[data-k]").forEach(inp => inp.addEventListener("input", () => {
      const k = inp.dataset.k;
      set[k] = inp.type === "number" ? Number(inp.value) : inp.value;
      markDirty();
    }));
    side.querySelectorAll("[data-sec]").forEach(inp => inp.addEventListener("input", () => { set.sections.find(s => s.id === inp.dataset.sec).title = inp.value; markDirty(); }));
    side.querySelectorAll("[data-secup]").forEach(b => b.addEventListener("click", () => { const i = +b.dataset.secup; [set.sections[i - 1], set.sections[i]] = [set.sections[i], set.sections[i - 1]]; markDirty(); drawSide(); drawForm(); }));
    side.querySelectorAll("[data-secdel]").forEach(b => b.addEventListener("click", () => { set.sections.splice(+b.dataset.secdel, 1); markDirty(); drawSide(); }));
    side.querySelector("[data-addsec]").addEventListener("click", () => { set.sections.push({ id: "s" + randomId(6), title: "New part" }); markDirty(); drawSide(); });
    side.querySelectorAll(".qitem").forEach(b => b.addEventListener("click", () => { sel = b.dataset.id; drawSide(); drawForm(); }));
    side.querySelectorAll("[data-add]").forEach(b => b.addEventListener("click", () => {
      const q = newQuestion(b.dataset.add, b.dataset.to);
      // keep the part's questions together: insert after its last question
      const lastIdx = set.questions.map(x => x.section).lastIndexOf(b.dataset.to);
      set.questions.splice(lastIdx === -1 ? set.questions.length : lastIdx + 1, 0, q);
      sel = q.id; markDirty(); drawSide(); drawForm();
      $("[data-form] [data-q='title']")?.focus();
    }));
    refreshIssues();
  }

  /* ─────────── right side: the selected question ─────────── */
  function drawForm() {
    editors.length = 0;
    const form = $("[data-form]"), q = qById(sel);
    if (!q) { form.innerHTML = `<h2>No question selected</h2><p class="sub">Add one with the + buttons under a part.</p>`; return; }
    const lab = labelled().find(x => x.id === q.id), idx = set.questions.indexOf(q);
    form.innerHTML = `
      <div class="page-head" style="margin-bottom:6px">
        <span class="pill">${lab.label}</span>
        <h2 style="margin:0;margin-right:auto">${TYPES[q.type]}${q.type === "code" ? " · " + esc(LANGS[q.lang] || "") : ""}</h2>
        <button class="icon-btn" data-up type="button" title="Move up" ${idx === 0 ? "disabled" : ""}>↑</button>
        <button class="icon-btn" data-down type="button" title="Move down" ${idx === set.questions.length - 1 ? "disabled" : ""}>↓</button>
        <button class="btn ghost small" data-preview type="button">Preview as a student</button>
        <button class="btn ghost small" data-dupq type="button">Duplicate</button>
        <button class="btn ghost small" data-delq type="button">Delete</button>
      </div>
      <div class="form-grid cols-2">
        <label class="field"><span>Part</span><select data-part>${set.sections.map((s, i) => `<option value="${esc(s.id)}" ${s.id === q.section ? "selected" : ""}>${String.fromCharCode(65 + i)} · ${esc(s.title)}</option>`).join("")}</select></label>
        <label class="field"><span>Type</span><select data-type>${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${k === q.type ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      </div>
      <label class="field"><span>Title</span><input data-q="title" value="${esc(q.title)}" placeholder="A few words, e.g. Destructuring an object"></label>
      <label class="field"><span>Question</span><textarea data-q="prompt" rows="4" placeholder="What students read. You can use **bold**, \`code\`, lists and code blocks.">${esc(q.prompt)}</textarea></label>
      <details class="help"><summary>Formatting</summary><p><code>**bold**</code> · <code>\`code\`</code> · lines starting with <code>- </code> or <code>1. </code> make lists · <code>&gt; </code> makes a tip box · three backticks on their own lines make a code block (<code>\`\`\`python</code> for Python).</p></details>
      <div data-typed></div>
      <label class="field"><span>Hint <small>(students lose the hint cost when they open it; leave empty for no hint)</small></span><textarea data-q="hint" rows="2">${esc(q.hint || "")}</textarea></label>`;
    form.querySelectorAll("[data-q]").forEach(inp => inp.addEventListener("input", () => {
      q[inp.dataset.q] = inp.value; markDirty();
      if (inp.dataset.q === "title") { const it = view.querySelector(`.qitem[data-id="${q.id}"] .ttl`); if (it) it.textContent = inp.value || "(no title)"; }
    }));
    form.querySelector("[data-part]").addEventListener("change", e => {
      set.questions.splice(idx, 1);
      q.section = e.target.value;
      const last = set.questions.map(x => x.section).lastIndexOf(q.section);
      set.questions.splice(last === -1 ? set.questions.length : last + 1, 0, q);
      markDirty(); drawSide(); drawForm();
    });
    form.querySelector("[data-type]").addEventListener("change", e => {
      const fresh = newQuestion(e.target.value, q.section);
      const keep = { id: q.id, title: q.title, prompt: q.prompt, hint: q.hint };
      for (const k of Object.keys(q)) delete q[k];
      Object.assign(q, fresh, keep);
      markDirty(); drawSide(); drawForm();
    });
    form.querySelector("[data-up]").addEventListener("click", () => move(-1));
    form.querySelector("[data-down]").addEventListener("click", () => move(1));
    form.querySelector("[data-dupq]").addEventListener("click", () => {
      const c = { ...clone(q), id: "q" + randomId(8), title: (q.title || "") + " (copy)" };
      set.questions.splice(idx + 1, 0, c); sel = c.id; markDirty(); drawSide(); drawForm();
    });
    form.querySelector("[data-delq]").addEventListener("click", e => confirmClick(e.currentTarget, () => {
      set.questions.splice(idx, 1); sel = set.questions[Math.min(idx, set.questions.length - 1)]?.id || null; markDirty(); drawSide(); drawForm();
    }, "Click again to delete"));
    form.querySelector("[data-preview]").addEventListener("click", () => preview(q));
    const typed = form.querySelector("[data-typed]");
    if (q.type === "mcq") mcqForm(typed, q); else if (q.type === "blanks") blanksForm(typed, q); else codeForm(typed, q);
  }
  // Move within the same part; at the edge, move into the next/previous part.
  function move(dir) {
    const q = qById(sel), i = set.questions.indexOf(q), j = i + dir;
    if (j < 0 || j >= set.questions.length) return;
    const other = set.questions[j];
    if (other.section !== q.section) q.section = other.section;
    else [set.questions[i], set.questions[j]] = [set.questions[j], set.questions[i]];
    markDirty(); drawSide(); drawForm();
  }

  function mcqForm(box, q) {
    box.innerHTML = `
      <div class="form-grid cols-2">
        <label class="field"><span>Code shown above the options <small>(optional)</small></span></label>
        <label class="field"><span>Code language</span><select data-lang><option value="js">JavaScript / React</option><option value="python">Python</option><option value="shell">Terminal</option><option value="text">Plain text</option></select></label>
      </div>
      <textarea class="input mono" data-code rows="${Math.min(10, Math.max(2, (q.code || "").split("\n").length + 1))}" placeholder="const { price } = dish;">${esc(q.code || "")}</textarea>
      <div class="field"><span>Options <small>(pick the correct one)</small></span><div data-opts></div>
      <div><button class="btn ghost small" data-addopt type="button">+ Add an option</button></div></div>`;
    box.querySelector("[data-lang]").value = q.codeLang || "js";
    box.querySelector("[data-lang]").addEventListener("change", e => { q.codeLang = e.target.value; markDirty(); });
    box.querySelector("[data-code]").addEventListener("input", e => { q.code = e.target.value; markDirty(); });
    const drawOpts = () => {
      const o = box.querySelector("[data-opts]");
      o.innerHTML = q.options.map((t, i) => `<div class="opt-row"><label><input type="radio" name="right-${q.id}" value="${i}" ${q.answer === i ? "checked" : ""}> ${"ABCDEFGH"[i]} correct</label><input type="text" data-o="${i}" value="${esc(t)}" placeholder="Option ${"ABCDEFGH"[i]} (use \`backticks\` for code)"><button class="icon-btn" data-delopt="${i}" type="button" title="Remove" ${q.options.length <= 2 ? "disabled" : ""}>✕</button></div>`).join("");
      o.querySelectorAll("[data-o]").forEach(inp => inp.addEventListener("input", () => { q.options[+inp.dataset.o] = inp.value; markDirty(); }));
      o.querySelectorAll("input[type=radio]").forEach(r => r.addEventListener("change", () => { q.answer = +r.value; markDirty(); }));
      o.querySelectorAll("[data-delopt]").forEach(b => b.addEventListener("click", () => {
        const i = +b.dataset.delopt; q.options.splice(i, 1);
        if (q.answer === i) q.answer = 0; else if (q.answer > i) q.answer--;
        markDirty(); drawOpts();
      }));
      box.querySelector("[data-addopt]").disabled = q.options.length >= 8;
    };
    box.querySelector("[data-addopt]").addEventListener("click", () => { q.options.push(""); markDirty(); drawOpts(); });
    drawOpts();
  }

  function blanksForm(box, q) {
    box.innerHTML = `
      <div class="form-grid cols-2">
        <label class="field"><span>Language</span><select data-lang><option value="js">JavaScript / React</option><option value="python">Python</option><option value="shell">Terminal</option></select></label>
        <label class="field"><span>&nbsp;</span><span class="switch"><input type="checkbox" data-any ${q.anyOrder ? "checked" : ""}> The blanks can be filled in any order</span></label>
      </div>
      <div class="field"><span>Code with blanks <small>— write <code>__1__</code>, <code>__2__</code>… where each blank goes</small></span>
        <textarea class="input mono" data-code rows="${Math.min(16, Math.max(4, q.code.split("\n").length + 1))}">${esc(q.code)}</textarea>
        <div><button class="btn ghost small" data-ins type="button">Insert a blank at the cursor</button></div></div>
      <div class="field"><span>Accepted answers <small>— one per line. Spaces and a final ; are ignored; capitals count.</small></span><div data-blanks></div></div>`;
    const lang = box.querySelector("[data-lang]"), code = box.querySelector("[data-code]");
    lang.value = q.lang || "js";
    lang.addEventListener("change", () => { q.lang = lang.value; markDirty(); });
    box.querySelector("[data-any]").addEventListener("change", e => { q.anyOrder = e.target.checked; markDirty(); });
    const drawBlanks = () => {
      const nums = blankNumbers(q.code);
      q.blanks ||= [];
      for (const n of nums) if (!q.blanks.some(b => Number(b.n) === n)) q.blanks.push({ n, accept: [""] });
      box.querySelector("[data-blanks]").innerHTML = nums.length ? nums.map(n => {
        const b = q.blanks.find(x => Number(x.n) === n);
        return `<div class="blank-row"><b>__${n}__</b><textarea rows="${Math.max(1, b.accept.length)}" data-n="${n}" placeholder="e.g. useState">${esc(b.accept.join("\n"))}</textarea></div>`;
      }).join("") : `<p class="note">No blanks yet.</p>`;
      box.querySelectorAll("[data-n]").forEach(t => t.addEventListener("input", () => { q.blanks.find(x => Number(x.n) === +t.dataset.n).accept = t.value.split("\n"); markDirty(); }));
    };
    const redraw = debounce(drawBlanks, 400);
    code.addEventListener("input", () => { q.code = code.value; markDirty(); redraw(); });
    box.querySelector("[data-ins]").addEventListener("click", () => {
      const used = blankNumbers(q.code), n = used.length ? Math.max(...used) + 1 : 1;
      code.focus(); code.setRangeText(`__${n}__`, code.selectionStart, code.selectionEnd, "end");
      q.code = code.value; markDirty(); drawBlanks();
    });
    drawBlanks();
  }

  function codeForm(box, q) {
    const term = q.lang === "terminal", py = q.lang === "python", react = q.lang === "react";
    if (term && !q.terminal) q.terminal = clone(DEFAULT_TERMINAL);
    box.innerHTML = `
      <div class="form-grid cols-2">
        <label class="field"><span>Language</span><select data-lang>${Object.entries(LANGS).map(([k, v]) => `<option value="${k}" ${k === q.lang ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        ${react ? `<label class="field"><span>Component to show in the preview</span><input class="mono" data-preview-name value="${esc(q.preview || "App")}"></label>` : ""}
        ${py ? `<label class="field"><span>Sample input for input() <small>(one line each; tests see it as OUTPUT)</small></span><textarea class="mono" rows="2" data-stdin>${esc(q.stdin || "")}</textarea></label>` : ""}
      </div>
      ${term ? `
        <div class="form-grid cols-3">
          <label class="field"><span>The terminal opens in</span><input class="mono" data-t="start" value="${esc(q.terminal.start)}"></label>
          <label class="field"><span>The app’s folder</span><input class="mono" data-t="app" value="${esc(q.terminal.app)}"></label>
          <label class="field"><span>The app starts with</span><select data-t="script"><option value="dev">npm run dev (Vite)</option><option value="start">npm start (Create React App)</option></select></label>
        </div>
        <label class="field"><span>Folders on the pretend computer <small>(JSON: folders are { }, files are 1)</small></span><textarea class="mono" rows="6" data-tree>${esc(q.terminalText ?? JSON.stringify(q.terminal.tree, null, 2))}</textarea></label>
        <p class="note">The checks are built in: they end in the app’s folder, install the packages, and start the app, in that order.</p>` : ""}
      <div class="field"><span>Starter code <small>(what students begin with)</small></span><div data-ed="starter"></div></div>
      <div class="field"><span>Model answer <small>(only you see it; used to test your tests)</small></span><div data-ed="solution"></div></div>
      ${term ? "" : `
      <details class="field" ${q.setup ? "open" : ""}><summary><b>Hidden test setup</b> <small class="note">— sample data or helpers the tests use; runs before each test, students don’t see it</small></summary><div data-ed="setup" style="margin-top:6px"></div></details>
      <div class="field"><span>Tests <small>(each one is a check students see by name)</small></span>
        ${testHelp(q.lang)}
        <div data-tests></div>
        <div class="actions"><button class="btn ghost small" data-addtest type="button">+ Add a test</button><button class="btn small" data-runsol type="button">Run the tests on the model answer</button><button class="btn ghost small" data-runstart type="button">…on the starter code</button><span class="note" data-runnote></span></div>
      </div>`}`;
    box.querySelector("[data-lang]").addEventListener("change", e => {
      q.lang = e.target.value;
      if (q.lang === "terminal") q.terminal ||= clone(DEFAULT_TERMINAL);
      markDirty(); drawSide(); drawForm();
    });
    box.querySelector("[data-preview-name]")?.addEventListener("input", e => { q.preview = e.target.value.trim(); markDirty(); });
    box.querySelector("[data-stdin]")?.addEventListener("input", e => { q.stdin = e.target.value; markDirty(); });
    if (term) {
      box.querySelector('[data-t="script"]').value = q.terminal.script || "dev";
      box.querySelectorAll("[data-t]").forEach(inp => inp.addEventListener("input", () => { q.terminal[inp.dataset.t] = inp.value.trim(); markDirty(); }));
      box.querySelector("[data-tree]").addEventListener("input", e => {
        q.terminalText = e.target.value;
        try { q.terminal.tree = JSON.parse(e.target.value); delete q.terminalError; } catch { q.terminalError = true; }
        markDirty();
      });
    }
    for (const k of ["starter", "solution", "setup"]) {
      const host = box.querySelector(`[data-ed="${k}"]`); if (!host) continue;
      const lines = Math.max(6, Math.min(22, String(q[k] || "").split("\n").length + 2));
      editors.push(createEditor(host, { value: q[k] || "", lang: k === "setup" && q.lang === "react" ? "js" : q.lang, label: k, height: lines * 22 + 30, onChange: v => { q[k] = v; markDirty(); } }));
    }
    if (term) return;
    const drawTests = results => {
      const t = box.querySelector("[data-tests]");
      q.tests ||= [];
      t.innerHTML = q.tests.length ? q.tests.map((x, i) => {
        const r = results && results[i];
        return `<div class="test-card ${r ? (r.pass ? "pass" : "fail") : ""}">
          <div class="test-top"><b class="mono">${i + 1}</b><input data-f="name" data-i="${i}" value="${esc(x.name || "")}" placeholder="What students see, e.g. cheapTitles(products, 50) → [&quot;Notebook&quot;, &quot;Pen&quot;]">
            <button class="icon-btn" data-tup="${i}" type="button" title="Move up" ${i === 0 ? "disabled" : ""}>↑</button><button class="icon-btn" data-tdel="${i}" type="button" title="Delete test">✕</button></div>
          <div class="test-body">
            <input class="mono" data-f="expr" data-i="${i}" value="${esc(x.expr || "")}" placeholder="${esc(exprPlaceholder(q.lang))}" ${x.op === "source" ? "hidden" : ""} aria-label="What to check">
            <select data-f="op" data-i="${i}" aria-label="How to compare" ${x.op === "source" ? 'style="grid-column:1/3"' : ""}>${Object.entries(OPS).map(([k, v]) => `<option value="${k}" ${k === (x.op || "equals") ? "selected" : ""}>${v}</option>`).join("")}</select>
            <input class="mono" data-f="expected" data-i="${i}" value="${esc(x.expected || "")}" placeholder="${x.op === "equals" || !x.op ? (q.lang === "python" ? "[2, 4]" : '["Notebook", "Pen"]') : x.op === "includes" ? "text" : "regular expression"}" ${x.op === "truthy" ? "hidden" : ""} aria-label="Expected">
          </div>
          <div class="test-msg"><input data-f="msg" data-i="${i}" value="${esc(x.msg || "")}" placeholder="Message when it fails (optional). {got} shows what came out."></div>
          ${r ? `<div class="test-res ${r.pass ? "ok" : "no"}">${r.pass ? "✓ passes" : "✗ " + esc(r.why)}</div>` : ""}
        </div>`;
      }).join("") : `<p class="note">No tests yet. Add one, then press “Run the tests on the model answer”.</p>`;
      t.querySelectorAll("[data-f]").forEach(inp => inp.addEventListener(inp.tagName === "SELECT" ? "change" : "input", () => {
        q.tests[+inp.dataset.i][inp.dataset.f] = inp.value; markDirty();
        if (inp.dataset.f === "op") drawTests();
      }));
      t.querySelectorAll("[data-tdel]").forEach(b => b.addEventListener("click", () => { q.tests.splice(+b.dataset.tdel, 1); markDirty(); drawTests(); }));
      t.querySelectorAll("[data-tup]").forEach(b => b.addEventListener("click", () => { const i = +b.dataset.tup; [q.tests[i - 1], q.tests[i]] = [q.tests[i], q.tests[i - 1]]; markDirty(); drawTests(); }));
    };
    box.querySelector("[data-addtest]").addEventListener("click", () => { q.tests.push({ name: "", expr: "", op: "equals", expected: "", msg: "" }); markDirty(); drawTests(); box.querySelector(".test-card:last-child [data-f=name]")?.focus(); });
    const runOn = async (which, btn) => {
      const note = box.querySelector("[data-runnote]");
      if (!q.tests.length) { note.textContent = "Add a test first."; return; }
      btn.disabled = true; note.textContent = q.lang === "python" ? "Running (Python takes a few seconds the first time)…" : "Running…";
      const pq = publishQuestion({ ...labelled().find(x => x.id === q.id) }, "editor");
      const res = await checkCode(pq, q[which] || "", { tests: q.tests });
      const passed = res.filter(r => r.pass).length;
      note.textContent = which === "solution"
        ? (passed === res.length ? `All ${res.length} pass on the model answer.` : `${passed} of ${res.length} pass on the model answer. Fix the tests or the answer.`)
        : `${passed} of ${res.length} pass on the starter code${passed === res.length ? ": students would get it right without doing anything!" : "."}`;
      btn.disabled = false;
      drawTests(res);
    };
    box.querySelector("[data-runsol]").addEventListener("click", e => runOn("solution", e.currentTarget));
    box.querySelector("[data-runstart]").addEventListener("click", e => runOn("starter", e.currentTarget));
    drawTests();
  }

  function preview(q) {
    const lab = labelled().find(x => x.id === q.id), pq = publishQuestion(lab, "preview");
    const sec = set.sections.find(s => s.id === q.section);
    const d = dialog(`<div class="dlg-body"><h2>Preview as a student</h2><p class="note" style="margin-top:0">Try it: nothing here is saved.</p><div class="preview-frame"><article class="qcard" data-card></article></div></div><div class="dlg-foot"><button class="btn" data-close type="button">Close</button></div>`, { wide: true });
    const entry = { s: null, h: false };
    const draw = () => renderQuestion(d.el.querySelector("[data-card]"), {
      q: pq, entry, session: { points: set.points ?? 1, hintPenalty: set.hintPenalty ?? 0.5, salt: "preview" }, isLocked: () => false,
      meta: { sectionTitle: sec?.title }, onChange: () => {},
    });
    draw();
  }

  return () => { leaveGuard = null; removeEventListener("beforeunload", onUnload); removeEventListener("keydown", onKey); };
}

function exprPlaceholder(lang) {
  return lang === "python" ? "even_numbers([1, 2, 3, 4])" : lang === "react" ? "(await render(App)).text" : "cheapTitles(products, 50)";
}
function testHelp(lang) {
  if (lang === "python") return `<details class="help"><summary>How Python tests work</summary>
    <p>Each test runs a Python expression after the student’s program, and compares what comes out. It can use their functions and variables, and:</p>
    <p><code>OUTPUT</code> what the program printed (with the sample input) · <code>run("3\\n4")</code> runs the program again with this input and gives what it printed · <code>SOURCE</code> their code</p>
    <p>Examples: <code>even_numbers([1, 2, 3, 4])</code> is equal to <code>[2, 4]</code> · <code>OUTPUT</code> contains the text <code>Sum: 7</code> · their code matches the pattern <code>\\bfor\\b</code></p></details>`;
  if (lang === "react") return `<details class="help"><summary>How React tests work</summary>
    <p>Each test is a JavaScript expression (you can use <code>await</code>). <code>render(Component, props, options)</code> puts a component on a hidden page and gives back:</p>
    <p><code>.text</code> all the text · <code>.count("li")</code> how many · <code>.texts("li")</code> each one’s text · <code>.attr("img", "src")</code> · <code>.fetchCalls</code> the URLs it fetched · <code>await .click("Add")</code> · <code>await .type("input", "hi")</code></p>
    <p>Options: <code>{ reply: DATA }</code> makes <code>fetch</code> answer with DATA (put DATA in the hidden setup) · <code>{ wait: 300 }</code> waits longer.</p>
    <p>Examples: <code>(await render(Menu)).count("li")</code> is equal to <code>4</code> · <code>(await render(UserList, {}, { reply: USERS })).text</code> contains the text <code>Grace</code></p></details>`;
  return `<details class="help"><summary>How JavaScript tests work</summary>
    <p>Each test is a JavaScript expression run after the student’s code; it can call their functions. Compare with <b>is equal to</b> (a JavaScript value, like <code>["Notebook", "Pen"]</code> or <code>110</code> or <code>"Sold out"</code>), <b>contains the text</b>, <b>matches the pattern</b> (a regular expression), or <b>is true</b>.</p>
    <p><code>LOGS</code> is every line their code printed with console.log. Put sample data in the hidden setup, e.g. <code>const products = [...]</code>.</p></details>`;
}
