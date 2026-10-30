// Draws one question and lets the student answer it.
// Used by the student test and by the instructor's "Preview as a student".
//
// renderQuestion(card, opts)
//   q          the question as students receive it (see lib/grade.js publishQuestion)
//   entry      this student's state for the question; changed in place
//   session    { points, hintPenalty, salt }
//   isLocked   () => true when answers can't change any more
//   meta       { index, total, sectionTitle }
//   nav        { prevLabel, nextLabel, onPrev, onNext }
//   onChange   (kind, detail) after anything changes: "pick", "answer", "hint", "code", "check"
import { esc, fmtPts } from "../lib/util.js";
import { markdown, inline } from "../lib/markdown.js";
import { highlight } from "../lib/highlight.js";
import { mcqRight, blanksMarks, qPoints } from "../lib/grade.js";
import { createEditor } from "./editor.js";
import { runCode, checkCode, checkNames } from "../runner/index.js";

const LETTERS = "ABCDEFGH";

export function renderQuestion(card, opts) {
  const { q, entry, session, isLocked, meta = {}, nav = {}, onChange = () => {} } = opts;
  const pts = qPoints(q, session), pen = session.hintPenalty ?? 0.5;
  const status = entry.s === "c" ? `<span class="pill status-correct">Correct · +${fmtPts(pts)}</span>` : entry.s === "w" ? `<span class="pill status-wrong">Not correct</span>` : "";
  card.innerHTML = `
    <div class="qhead"><span class="pill">${esc(q.label || "")}</span>${meta.sectionTitle ? `<span>Part ${esc(q.sectionKey || "")} · ${esc(meta.sectionTitle)}</span>` : ""}${meta.total ? `<span>Question ${meta.index + 1} of ${meta.total}</span>` : ""}<span>${fmtPts(pts)} point${pts === 1 ? "" : "s"}</span>${status}</div>
    <h2>${esc(q.title)}</h2>
    <div class="prompt">${markdown(q.prompt)}</div>
    <div class="qbody"></div>
    <div class="hintbox"></div>
    <div class="actions qnav">
      ${nav.prevLabel ? `<button class="btn ghost" data-nav="prev" type="button">← ${esc(nav.prevLabel)}</button>` : ""}
      ${nav.nextLabel ? `<button class="btn ghost" data-nav="next" type="button">${esc(nav.nextLabel)} →</button>` : ""}
    </div>`;
  card.querySelector('[data-nav="prev"]')?.addEventListener("click", () => nav.onPrev());
  card.querySelector('[data-nav="next"]')?.addEventListener("click", () => nav.onNext());
  const body = card.querySelector(".qbody"), hintbox = card.querySelector(".hintbox");
  const rerender = () => renderQuestion(card, opts);
  const ctx = { q, entry, session, isLocked, onChange, body, rerender, pts };
  if (q.type === "mcq") mcq(ctx); else if (q.type === "blanks") blanks(ctx); else code(ctx);
  hint(hintbox, ctx, pen);
}

function hint(box, ctx, pen) {
  const { q, entry, isLocked, onChange } = ctx;
  if (!q.hint) { box.innerHTML = ""; return; }
  if (entry.h) { box.innerHTML = `<div class="hinttext"><b>Hint (−${fmtPts(pen)}).</b> ${inline(q.hint)}</div>`; return; }
  if (isLocked() || entry.s === "c" || (q.type !== "code" && entry.s)) { box.innerHTML = ""; return; }
  box.innerHTML = `<button class="hintbtn" type="button">Show the hint (−${fmtPts(pen)})</button>`;
  const b = box.querySelector("button"); let armed = false;
  b.addEventListener("click", () => {
    if (!armed) {
      armed = true; b.classList.add("armed"); b.textContent = `Sure? Click again: you lose ${fmtPts(pen)}`;
      setTimeout(() => { if (armed && b.isConnected) { armed = false; b.classList.remove("armed"); b.textContent = `Show the hint (−${fmtPts(pen)})`; } }, 4000);
      return;
    }
    if (isLocked()) return;
    entry.h = true; onChange("hint");
    hint(box, ctx, pen);
  });
}

function mcq({ q, entry, session, isLocked, onChange, body, rerender, pts }) {
  const done = entry.s != null || isLocked();
  body.innerHTML = (q.code ? `<pre class="show">${highlight(q.code, q.codeLang || "js")}</pre>` : "") +
    `<div class="opts">${q.options.map((o, i) => {
      let cls = "opt";
      if (entry.s && entry.pick === i) cls += entry.s === "c" ? " picked-good" : " picked-bad";
      return `<button class="${cls}" type="button" data-i="${i}" aria-pressed="${entry.pick === i}" ${done ? "disabled" : ""}><span class="l">${LETTERS[i]}</span><span class="x">${inline(o)}</span></button>`;
    }).join("")}</div>
    ${entry.s ? `<div class="result ${entry.s === "c" ? "good" : "bad"}">${entry.s === "c" ? `Correct! +${fmtPts(pts)}` : "Not correct. Your answer is locked in."}</div>` :
      isLocked() ? `<div class="result bad">The test is over.</div>` :
      `<div class="actions"><button class="btn" data-submit type="button" ${entry.pick == null ? "disabled" : ""}>Submit answer</button><span class="note">One try only.</span></div>`}`;
  body.querySelectorAll(".opt").forEach(b => b.addEventListener("click", () => {
    if (entry.s || isLocked()) return;
    entry.pick = Number(b.dataset.i); onChange("pick"); rerender();
  }));
  body.querySelector("[data-submit]")?.addEventListener("click", () => {
    if (entry.pick == null || entry.s || isLocked()) return;
    entry.s = mcqRight(q, session.salt, entry.pick) ? "c" : "w";
    onChange("answer"); rerender();
  });
}

function blanks({ q, entry, session, isLocked, onChange, body, rerender, pts }) {
  const parts = q.code.split(/__(\d+)__/);
  const n = (parts.length - 1) / 2;
  if (!Array.isArray(entry.vals) || entry.vals.length !== n) entry.vals = Array.from({ length: n }, (_, i) => (entry.vals || [])[i] || "");
  const done = entry.s != null || isLocked();
  let html = "";
  parts.forEach((p, i) => {
    if (i % 2 === 0) { html += highlight(p, q.lang || "js"); return; }
    const k = (i - 1) / 2, mark = entry.marks ? (entry.marks[k] ? "ok" : "no") : "";
    html += `<span class="num">${p}</span><input data-k="${k}" class="${mark}" value="${esc(entry.vals[k])}" aria-label="Blank ${p}" spellcheck="false" autocapitalize="off" autocomplete="off" ${done ? "disabled" : ""} style="width:${Math.max(8, (entry.vals[k] || "").length + 3)}ch">`;
  });
  body.innerHTML = `<pre class="show blanks">${html}</pre>
    ${entry.s ? `<div class="result ${entry.s === "c" ? "good" : "bad"}">${entry.s === "c" ? `All blanks right! +${fmtPts(pts)}` : `Not all right: ${(entry.marks || []).filter(Boolean).length} of ${n} blanks. Your answers are locked in.`}</div>` :
      isLocked() ? `<div class="result bad">The test is over.</div>` :
      `<div class="actions"><button class="btn" data-submit type="button">Submit answers</button><span class="note">One try only. Every blank must be right.</span></div>`}`;
  body.querySelectorAll("input").forEach(inp => inp.addEventListener("input", () => {
    entry.vals[Number(inp.dataset.k)] = inp.value; inp.style.width = Math.max(8, inp.value.length + 3) + "ch"; onChange("pick");
  }));
  body.querySelector("[data-submit]")?.addEventListener("click", e => {
    if (entry.s || isLocked()) return;
    if (entry.vals.some(v => !String(v).trim())) {
      const note = document.createElement("p"); note.className = "note bad-text"; note.textContent = "Fill in every blank first.";
      e.currentTarget.parentElement.append(note); setTimeout(() => note.remove(), 2500); return;
    }
    entry.marks = blanksMarks(q, session.salt, entry.vals);
    entry.s = entry.marks.every(Boolean) ? "c" : "w";
    onChange("answer"); rerender();
  });
}

function code(ctx) {
  const { q, entry, isLocked, onChange, body, pts } = ctx;
  if (entry.code == null) entry.code = q.starter || "";
  const react = q.lang === "react", term = q.lang === "terminal", py = q.lang === "python";
  const names = checkNames(q);
  body.innerHTML = `
    <div class="bench">
      <div class="ed"></div>
      ${py ? `<details class="stdin"${q.stdin ? " open" : ""}><summary>Input for <code>input()</code></summary><textarea rows="3" spellcheck="false" placeholder="One line for each input() call">${esc(q.stdin || "")}</textarea></details>` : ""}
      <div class="actions">
        <button class="btn ghost" data-run type="button">Run</button>
        <button class="btn" data-check type="button" ${isLocked() || !names.length ? "disabled" : ""}>Check my answer</button>
        <button class="btn ghost" data-reset type="button" ${isLocked() ? "disabled" : ""}>Reset code</button>
        <span class="note">Ctrl + Enter checks. ${entry.s === "c" ? "Already correct: you can keep improving it." : `+${fmtPts(pts)} the first time every check passes.`}</span>
      </div>
      <div class="panes ${react ? "two" : ""}">
        ${react ? `<div class="pane"><h4>Preview</h4><div class="preview"></div></div>` : ""}
        <div class="pane"><h4>${term ? "Terminal" : "Console"}</h4><div class="console"></div></div>
      </div>
      <div class="pane"><h4>Checks</h4><ul class="checks">${names.map(() => `<li class="wait"><span class="i">○</span><span></span></li>`).join("") || `<li class="wait"><span class="i">–</span><span>This question has no checks yet.</span></li>`}</ul></div>
    </div>`;
  body.querySelectorAll(".checks li").forEach((li, i) => { if (names[i]) li.lastElementChild.textContent = names[i]; });
  const con = body.querySelector(".console"), preview = body.querySelector(".preview"), stdin = body.querySelector(".stdin textarea");
  const log = (kind, text) => {
    const d = document.createElement("div"); d.className = kind === "log" ? "" : kind; d.textContent = text; con.append(d); con.scrollTop = con.scrollHeight;
  };
  const onLoading = () => log("info", "Loading Python… (the first time takes a few seconds)");
  const ed = createEditor(body.querySelector(".ed"), {
    value: entry.code, lang: q.lang, readOnly: isLocked(), label: `Your code for ${q.label}`,
    onChange: v => { entry.code = v; onChange("code"); },
    onCtrlEnter: () => check(),
  });
  log("info", term ? "Press Run to play your commands in the pretend terminal. Press Check to test them."
    : react ? "Press Run to see your component in the Preview. Press Check to test it."
    : py ? "Press Run to see what your program prints. Press Check to test it."
    : "Press Run to see your console.log output. Press Check to test it.");

  const run = async quiet => {
    if (!quiet) { con.innerHTML = ""; log("info", `▶ Running ${q.label || ""}`); }
    await runCode(q, ed.value, { log, previewHost: preview, stdin: stdin ? stdin.value : undefined, onLoading });
  };
  let busy = false;
  const check = async () => {
    if (busy || !names.length) return;
    busy = true;
    const btn = body.querySelector("[data-check]"); btn.disabled = true;
    const list = body.querySelectorAll(".checks li");
    list.forEach(li => { li.className = "wait"; li.firstElementChild.textContent = "…"; li.querySelector(".why")?.remove(); });
    const src = ed.value;
    entry.code = src;
    const res = await checkCode(q, src, { onLoading: () => { con.innerHTML = ""; onLoading(); } });
    res.forEach((r, i) => {
      const li = list[i]; if (!li) return;
      li.className = r.pass ? "pass" : "fail"; li.firstElementChild.textContent = r.pass ? "✓" : "✗";
      if (!r.pass && r.why) { const w = document.createElement("span"); w.className = "why"; w.textContent = r.why; li.lastElementChild.append(w); }
    });
    const passed = res.filter(r => r.pass).length, all = res.length > 0 && passed === res.length;
    const firstPass = all && entry.s !== "c" && !isLocked();
    if (!isLocked()) {
      if (firstPass) entry.s = "c";
      entry.checked = src; entry.checks = `${passed}/${res.length}`;
      onChange("check", { all, firstPass });
    }
    con.innerHTML = "";
    log(all ? "log" : "info", all ? (firstPass ? `All checks pass! +${fmtPts(pts)}` : "All checks pass.") : `${passed} of ${res.length} checks pass. Read the red lines in Checks.`);
    if (all) { const head = body.closest(".qcard")?.querySelector(".qhead"); if (head && !head.querySelector(".status-correct")) head.insertAdjacentHTML("beforeend", `<span class="pill status-correct">Correct · +${fmtPts(pts)}</span>`); }
    if (react) run(true);
    btn.disabled = isLocked();
    busy = false;
  };
  body.querySelector("[data-run]").addEventListener("click", () => run(false));
  body.querySelector("[data-check]").addEventListener("click", check);
  body.querySelector("[data-reset]").addEventListener("click", () => { ed.value = q.starter || ""; entry.code = ed.value; onChange("code"); });
  if (react) run(true);
}
