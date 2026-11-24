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
import { mcqRight, blanksMarks, qPoints, written, partPoints } from "../lib/grade.js";
import { createEditor } from "./editor.js";
import { runCode, checkCode, checkNames } from "../runner/index.js";

const LETTERS = "ABCDEFGH";

export function renderQuestion(card, opts) {
  const { q, entry, session, isLocked, meta = {}, nav = {}, onChange = () => {} } = opts;
  const pts = qPoints(q, session), pen = session.hintPenalty ?? 0.5;
  const status = typeof entry.awarded === "number"
    ? `<span class="pill ${entry.awarded > 0 ? "status-correct" : "status-wrong"}">Marked · ${fmtPts(entry.awarded)} of ${fmtPts(pts)}</span>`
    : entry.s === "c" ? `<span class="pill status-correct">Correct · +${fmtPts(pts)}</span>`
    : entry.s === "w" ? `<span class="pill status-wrong">Not correct</span>`
    : entry.handed ? `<span class="pill">Answered</span>` : "";
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
  if (q.type === "mcq") mcq(ctx);
  else if (q.type === "blanks") blanks(ctx);
  else if (q.type === "subjective") subjective(ctx);
  else code(ctx);
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
  const done = entry.s != null || !!entry.handed || isLocked();
  const right = session.resultsReleased ? session.answers?.[q.id]?.pick ?? null : null;
  body.innerHTML = (q.code ? `<pre class="show">${highlight(q.code, q.codeLang || "js")}</pre>` : "") +
    `<div class="opts">${q.options.map((o, i) => {
      let cls = "opt";
      if (entry.s && entry.pick === i) cls += entry.s === "c" ? " picked-good" : " picked-bad";
      // After an exam is released, the right one is shown even if they didn't pick it.
      if (right != null && i === right && entry.pick !== i) cls += " was-right";
      return `<button class="${cls}" type="button" data-i="${i}" aria-pressed="${entry.pick === i}" ${done ? "disabled" : ""}><span class="l">${LETTERS[i]}</span><span class="x">${inline(o)}</span></button>`;
    }).join("")}</div>
    ${entry.s ? `<div class="result ${entry.s === "c" ? "good" : "bad"}">${entry.s === "c" ? `Correct! +${fmtPts(pts)}` : `Not correct.${right != null ? ` The answer was ${LETTERS[right]}.` : " Your answer is locked in."}`}</div>` :
      entry.handed ? `<div class="result wait">Answered and locked in. You'll see how you did when your instructor releases the results.</div>` :
      isLocked() ? `<div class="result bad">The test is over.</div>` :
      `<div class="actions"><button class="btn" data-submit type="button" ${entry.pick == null ? "disabled" : ""}>Submit answer</button><span class="note">One try only.</span></div>`}`;
  body.querySelectorAll(".opt").forEach(b => b.addEventListener("click", () => {
    if (entry.s || isLocked()) return;
    entry.pick = Number(b.dataset.i); onChange("pick"); rerender();
  }));
  body.querySelector("[data-submit]")?.addEventListener("click", () => {
    if (entry.pick == null || entry.s || isLocked()) return;
    // No key reached this browser in an exam, so there is nothing to mark against: the answer
    // is simply locked in, and the instructor marks it afterwards.
    if (session.examMode) entry.handed = true;
    else entry.s = mcqRight(q, session.salt, entry.pick) ? "c" : "w";
    onChange("answer"); rerender();
  });
}

function blanks({ q, entry, session, isLocked, onChange, body, rerender, pts }) {
  const accept = session.resultsReleased ? session.answers?.[q.id]?.accept ?? null : null;
  const parts = q.code.split(/__(\d+)__/);
  const n = (parts.length - 1) / 2;
  if (!Array.isArray(entry.vals) || entry.vals.length !== n) entry.vals = Array.from({ length: n }, (_, i) => (entry.vals || [])[i] || "");
  const done = entry.s != null || !!entry.handed || isLocked();
  let html = "";
  parts.forEach((p, i) => {
    if (i % 2 === 0) { html += highlight(p, q.lang || "js"); return; }
    const k = (i - 1) / 2, mark = entry.marks ? (entry.marks[k] ? "ok" : "no") : "";
    html += `<span class="num">${p}</span><input data-k="${k}" class="${mark}" value="${esc(entry.vals[k])}" aria-label="Blank ${p}" spellcheck="false" autocapitalize="off" autocomplete="off" ${done ? "disabled" : ""} style="width:${Math.max(8, (entry.vals[k] || "").length + 3)}ch">`;
  });
  body.innerHTML = `<pre class="show blanks">${html}</pre>
    ${entry.s ? `<div class="result ${entry.s === "c" ? "good" : "bad"}">${entry.s === "c" ? `All blanks right! +${fmtPts(pts)}` : `Not all right: ${(entry.marks || []).filter(Boolean).length} of ${n} blanks.${
        partPoints(entry, session, q) > 0 ? ` +${fmtPts(partPoints(entry, session, q))} of ${fmtPts(pts)}.` : ""}`}${
        accept ? `<div class="note" style="margin-top:6px">Accepted: ${accept.map((a, i) => `<b>${i + 1}</b> ${esc(a.join(" / "))}`).join(" · ")}</div>` : ""}</div>` :
      entry.handed ? `<div class="result wait">Answered and locked in. You'll see how you did when your instructor releases the results.</div>` :
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
    if (session.examMode) entry.handed = true;
    else {
      entry.marks = blanksMarks(q, session.salt, entry.vals);
      entry.s = entry.marks.every(Boolean) ? "c" : "w";
    }
    onChange("answer"); rerender();
  });
}

// A written answer. Nothing is marked here: the instructor reads it afterwards, so there is
// no key to send and nothing in the page that could give the answer away.
function subjective(ctx) {
  const { q, entry, session, isLocked, onChange, body, rerender, pts } = ctx;
  if (entry.text == null) entry.text = "";
  const marked = typeof entry.awarded === "number";
  // When the instructor marks as the test runs, each answer is handed in on its own, so they
  // mark something that can no longer change. Otherwise answers stay open until the test ends.
  const handIn = !!session.liveMarking;
  const handed = !!entry.handed;
  const locked = isLocked() || marked || handed;
  body.innerHTML = `
    ${q.code ? `<pre class="show">${highlight(q.code, q.codeLang || "text")}</pre>` : ""}
    ${q.guidance ? `<p class="note">${inline(q.guidance)}</p>` : ""}
    <textarea class="input written" data-answer rows="${Number(q.rows) || 8}" spellcheck="true"
      placeholder="Write your answer here." ${locked ? "disabled" : ""}>${esc(entry.text)}</textarea>
    <div class="actions"><span class="note" data-count></span></div>
    ${marked
      ? `<div class="result ${entry.awarded > 0 ? "good" : "bad"}">Your instructor gave this ${fmtPts(entry.awarded)} of ${fmtPts(pts)}.${
          entry.note ? ` <span class="note">${esc(entry.note)}</span>` : ""}</div>`
      : handed
        ? `<div class="result wait">Handed in. Your instructor is marking this one — you can’t change it now.</div>`
        : isLocked()
          ? `<div class="result wait">Handed in. Your instructor reads this one and marks it by hand, so it isn’t in your score yet.</div>`
          : handIn
            ? `<div class="actions"><button class="btn" data-hand type="button">Hand in this answer</button>
                 <span class="note">Your instructor marks these as they come in. Hand it in when you’re happy — you can’t change it afterwards.</span></div>`
            : `<div class="note">Your instructor reads this one and marks it by hand. There is nothing to submit — what you type is saved as you go.</div>`}`;
  const ta = body.querySelector("[data-answer]"), count = body.querySelector("[data-count]");
  const show = () => {
    const w = written({ text: ta.value });
    count.textContent = w ? `${w.split(/\s+/).length} words` : "Nothing written yet";
  };
  show();
  ta.addEventListener("input", () => { entry.text = ta.value; show(); onChange("text"); });

  // Two presses, like every other thing here you can't undo.
  const hand = body.querySelector("[data-hand]");
  let armed = false;
  hand?.addEventListener("click", () => {
    if (!written(entry)) { show(); count.textContent = "Write something first."; return; }
    if (!armed) {
      armed = true; hand.classList.add("armed"); hand.textContent = "Sure? You can’t change it after this";
      setTimeout(() => { if (armed && hand.isConnected) { armed = false; hand.classList.remove("armed"); hand.textContent = "Hand in this answer"; } }, 4000);
      return;
    }
    if (isLocked()) return;
    entry.handed = true;
    onChange("answer");          // save it now, not on the next debounce
    rerender();
  });
}

function code(ctx) {
  const { q, entry, session, isLocked, onChange, body, pts } = ctx;
  if (entry.code == null) entry.code = q.starter || "";
  const react = q.lang === "react", term = q.lang === "terminal", py = q.lang === "python";
  const names = checkNames(q);
  // In an exam the expected values never reached this browser, so there is nothing to check
  // against here. Run still works: it is their own code, printing their own output.
  const exam = !!session.examMode;
  body.innerHTML = `
    <div class="bench">
      <div class="ed"></div>
      ${py ? `<details class="stdin"${q.stdin ? " open" : ""}><summary>Input for <code>input()</code></summary><textarea rows="3" spellcheck="false" placeholder="One line for each input() call">${esc(q.stdin || "")}</textarea></details>` : ""}
      <div class="actions">
        <button class="btn ghost" data-run type="button">Run</button>
        ${exam ? "" : `<button class="btn" data-check type="button" ${isLocked() || !names.length ? "disabled" : ""}>Check my answer</button>`}
        <button class="btn ghost" data-reset type="button" ${isLocked() ? "disabled" : ""}>Reset code</button>
        <span class="note">${exam
          ? "Your instructor runs the checks after the test. Use Run to try your code as you go."
          : `Ctrl + Enter checks. ${entry.s === "c" ? "Already correct: you can keep improving it." : `+${fmtPts(pts)} the first time every check passes.`}`}</span>
      </div>
      <div class="panes ${react ? "two" : ""}">
        ${react ? `<div class="pane"><h4>Preview</h4><div class="preview"></div></div>` : ""}
        <div class="pane"><h4>${term ? "Terminal" : "Console"}</h4><div class="console"></div></div>
      </div>
      <div class="pane"><h4>Checks${exam ? " your instructor will run" : ""}</h4><ul class="checks">${names.map(() => `<li class="wait"><span class="i">○</span><span></span></li>`).join("") || `<li class="wait"><span class="i">–</span><span>This question has no checks yet.</span></li>`}</ul></div>
    </div>`;
  body.querySelectorAll(".checks li").forEach((li, i) => { if (names[i]) li.lastElementChild.textContent = names[i]; });
  const paint = res => {
    const items = body.querySelectorAll(".checks li");
    res.forEach((r, i) => {
      const li = items[i]; if (!li) return;
      li.className = r.pass ? "pass" : "fail";
      li.firstElementChild.textContent = r.pass ? "\u2713" : "\u2717";
      li.querySelector(".why")?.remove();
      if (!r.pass && r.why) { const w = document.createElement("span"); w.className = "why"; w.textContent = r.why; li.lastElementChild.append(w); }
    });
  };
  const con = body.querySelector(".console"), preview = body.querySelector(".preview"), stdin = body.querySelector(".stdin textarea");
  const log = (kind, text) => {
    const d = document.createElement("div"); d.className = kind === "log" ? "" : kind; d.textContent = text; con.append(d); con.scrollTop = con.scrollHeight;
  };
  const onLoading = () => log("info", "Loading Python… (the first time takes a few seconds)");
  const ed = createEditor(body.querySelector(".ed"), {
    value: entry.code, lang: q.lang, readOnly: isLocked(), label: `Your code for ${q.label}`,
    onChange: v => { entry.code = v; onChange("code"); },
    onCtrlEnter: () => { if (!exam) check(); },
  });
  log("info", term ? "Press Run to play your commands in the pretend terminal. Press Check to test them."
    : react ? "Press Run to see your component in the Preview. Press Check to test it."
    : py ? "Press Run to see what your program prints. Press Check to test it."
    : "Press Run to see your console.log output. Press Check to test it.");

  // Moving between questions re-renders this from scratch. Without this the ticks and crosses
  // vanish and the student has to run everything again, which costs them time they are being
  // timed on. The code is compared so that a stale pass is never shown against edited code.
  if (!exam && Array.isArray(entry.results) && entry.results.length && entry.checked != null && entry.checked === entry.code) {
    paint(entry.results);
    log("info", `Your last run: ${entry.checks || ""} checks pass. Press Check again after you change the code.`);
  }

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
    const res = await checkCode(q, src, { onLoading: () => { con.innerHTML = ""; onLoading(); }, onNote: msg => log("info", msg) });
    paint(res);
    const passed = res.filter(r => r.pass).length, all = res.length > 0 && passed === res.length;
    const firstPass = all && entry.s !== "c" && !isLocked();
    if (!isLocked()) {
      if (firstPass) entry.s = "c";
      entry.checked = src; entry.checks = `${passed}/${res.length}`;
      // Kept so that leaving the question and coming back doesn't throw the run away. The reason
      // for a failure is worth more than the cross on its own, so it is kept too, but trimmed:
      // a runaway message from somebody's code shouldn't grow the answer document without limit.
      entry.results = res.map(r => ({ pass: !!r.pass, why: r.pass ? "" : String(r.why || "").slice(0, 200) }));
      onChange("check", { all, firstPass });
    }
    con.innerHTML = "";
    const part = partPoints(entry, session, q);
    log(all ? "log" : "info", all ? (firstPass ? `All checks pass! +${fmtPts(pts)}` : "All checks pass.")
      : `${passed} of ${res.length} checks pass${part > 0 ? `, worth ${fmtPts(part)} of ${fmtPts(pts)} so far` : ""}. Read the red lines in Checks.`);
    if (all) { const head = body.closest(".qcard")?.querySelector(".qhead"); if (head && !head.querySelector(".status-correct")) head.insertAdjacentHTML("beforeend", `<span class="pill status-correct">Correct · +${fmtPts(pts)}</span>`); }
    if (react) run(true);
    btn.disabled = isLocked();
    busy = false;
  };
  body.querySelector("[data-run]").addEventListener("click", () => run(false));
  body.querySelector("[data-check]")?.addEventListener("click", check);
  body.querySelector("[data-reset]").addEventListener("click", () => { ed.value = q.starter || ""; entry.code = ed.value; onChange("code"); });
  if (react) run(true);
}
