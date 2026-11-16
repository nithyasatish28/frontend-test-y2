// Re-grading: mark every answer again from what the student's browser saved, and show
// anything that disagrees with the mark it saved.
//
// Why this is possible. Answers are marked in the student's browser (README, "How cheat-proof
// it is"), so a saved mark is a claim, not proof. But everything needed to check that claim is
// already in the database: the session keeps the salted answer keys, and the attempt keeps what
// was actually typed (pick, vals, checked). So the check is a pure function of data we already
// have, and it runs here, in your browser, after the test.
//
// What it can't tell you:
//   · hints (entry.h) leave nothing behind to check against.
//   · a code answer can honestly say "correct" while its last check failed — the student passed,
//     then kept editing. Only a mark whose last check passed everything can be re-run.
//   · a student who worked the answer out of the session's own salt (see README) answers
//     correctly, so re-grading agrees with them. This finds made-up marks, not recovered keys.
import { mcqRight, blanksMarks, stats } from "../lib/grade.js";
import { checkCode } from "../runner/index.js";
import { esc, fmtPts, csvLine, download, confirmClick, toast } from "../lib/util.js";
import { dialog } from "./dialog.js";

const LETTERS = "ABCDEFGH";
const MARK = { c: "correct", w: "wrong" };
const markName = s => (s == null ? "no mark" : MARK[s] || String(s));

// status: "agrees" · "disagrees" · "unchecked".  fix: what to write to put it right, or null.
const result = (status, why, saved, computed, fix = null) => ({ status, why, saved, computed, fix });

/* ─────────── One answer ─────────── */
export async function auditEntry(session, q, e, { codeTests = false } = {}) {
  const saved = e?.s ?? null;

  if (q.type === "mcq") {
    if (e?.pick == null) {
      return saved == null ? result("unchecked", "not answered", saved, null)
        : result("disagrees", "marked, but no choice was saved", saved, null, { s: null });
    }
    const computed = mcqRight(q, session.salt, e.pick) ? "c" : "w";
    if (saved == null) return result("unchecked", "a choice, but no mark", saved, computed);
    return computed === saved ? result("agrees", "", saved, computed)
      : result("disagrees", `${LETTERS[e.pick] || "?"} is ${computed === "c" ? "right" : "wrong"}`, saved, computed, { s: computed });
  }

  if (q.type === "blanks") {
    const vals = Array.isArray(e?.vals) ? e.vals : null;
    if (!vals || !vals.some(v => String(v).trim())) {
      return saved == null ? result("unchecked", "not answered", saved, null)
        : result("disagrees", "marked, but no answers were saved", saved, null, { s: null });
    }
    const marks = blanksMarks(q, session.salt, vals);
    const computed = marks.every(Boolean) ? "c" : "w";
    if (saved == null) return result("unchecked", "answers, but no mark", saved, computed);
    return computed === saved ? result("agrees", "", saved, computed)
      : result("disagrees", `${marks.filter(Boolean).length} of ${marks.length} blanks are right`, saved, computed, { s: computed, marks });
  }

  if (q.type === "subjective") {
    // Marked by a person, so there is nothing to recompute — only to report.
    return typeof e?.awarded === "number"
      ? result("unchecked", "marked by hand", saved, null)
      : result("unchecked", e?.text ? "written, not marked yet" : "not answered", saved, null);
  }
  // Code. The only mark a code question ever gives itself is "correct".
  if (saved !== "c") return result("unchecked", saved == null ? "no mark to check" : "", saved, null);
  if (!e.checked) return result("disagrees", "marked correct, but no checked code was saved", saved, null, { s: null });
  const [passed, total] = String(e.checks || "").split("/").map(Number);
  if (!(total > 0) || passed !== total) {
    return result("unchecked", `passed earlier, then the code changed (last check ${e.checks || "none"})`, saved, null);
  }
  if (!codeTests) return result("unchecked", "code tests weren’t re-run", saved, null);
  try {
    const res = await checkCode(q, e.checked);
    const all = res.length > 0 && res.every(r => r.pass);
    return all ? result("agrees", "", saved, "c")
      : result("disagrees", `${res.filter(r => r.pass).length} of ${res.length} checks pass now`, saved, "w", { s: null });
  } catch (ex) {
    return result("unchecked", "couldn’t re-run: " + ex.message, saved, null);
  }
}

/* ─────────── Every answer in the session ─────────── */
// Reads only. Each row carries the patch that would put that student right, nothing is written.
export async function auditSession(session, attempts, { codeTests = false, onProgress, stop } = {}) {
  const rows = [];
  let n = 0;
  for (const a of attempts) {
    onProgress?.(n, attempts.length, a.name);
    const items = [];
    for (const q of session.questions) {
      if (stop?.()) return { rows, stopped: true };
      const r = await auditEntry(session, q, (a.q || {})[q.id], { codeTests });
      items.push({ q, ...r });
    }
    const fixes = items.filter(i => i.status === "disagrees" && i.fix);
    const qFixed = { ...(a.q || {}) };
    for (const f of fixes) qFixed[f.q.id] = { ...(qFixed[f.q.id] || {}), ...f.fix };
    rows.push({
      attempt: a, items, fixes,
      disagree: items.filter(i => i.status === "disagrees"),
      unchecked: items.filter(i => i.status === "unchecked" && i.why),
      saved: stats(session, a.q || {}),
      true_: stats(session, qFixed),
      patch: { q: Object.fromEntries(fixes.map(f => [f.q.id, f.fix])) },
    });
    n++;
  }
  onProgress?.(n, attempts.length, "");
  return { rows, stopped: false };
}

// Writes the corrections for one student. Only safe once the test is over: while it is running
// the student's own browser sends its whole answer map on every save and would put it back.
export function applyRow(store, sid, row) {
  const st = row.true_;
  return store.saveAttempt(sid, row.attempt.id, {
    ...row.patch,
    score: st.score, correct: st.correct, hints: st.hints, done: st.done, total: st.total,
    regradedAt: store.NOW,
  });
}

/* ─────────── The dialog ─────────── */
export function regradeDialog(ctx, sid, session, attempts, { canApply = false } = {}) {
  const { store } = ctx;
  const d = dialog(`<div class="dlg-body" data-body></div><div class="dlg-foot" data-foot></div>`, { wide: true });
  const body = d.el.querySelector("[data-body]"), foot = d.el.querySelector("[data-foot]");
  let cancelled = false;
  d.done.then(() => (cancelled = true));

  const intro = () => {
    body.innerHTML = `
      <h2>Re-grade &amp; verify</h2>
      <p>Every answer is marked in the student’s own browser, so a saved mark is a claim. This marks all
        ${session.questions.length} question${session.questions.length === 1 ? "" : "s"} again from the answers themselves
        and lists anything that disagrees. <b>Nothing is changed</b> unless you press Apply afterwards.</p>
      <label class="field"><span>&nbsp;</span><span class="switch"><input type="checkbox" data-code> Re-run code tests too</span></label>
      <p class="note" style="margin:-6px 0 0">Code tests are slower: every student’s saved code runs in this browser, Python included.</p>
      <p class="note">Hints can’t be checked. ${canApply ? "" : "Corrections can only be written once the test has ended."}</p>`;
    foot.innerHTML = `<button class="btn ghost" data-close="" type="button">Cancel</button><button class="btn" data-go type="button">Start</button>`;
    foot.querySelector("[data-go]").addEventListener("click", () => run(!!body.querySelector("[data-code]").checked));
  };

  const run = async codeTests => {
    body.innerHTML = `<h2>Re-grading…</h2><p class="note" data-prog>Starting…</p><div class="bar"><i data-bar style="width:0%"></i></div>`;
    foot.innerHTML = `<button class="btn ghost" data-close="" type="button">Stop</button>`;
    const prog = body.querySelector("[data-prog]"), bar = body.querySelector("[data-bar]");
    const out = await auditSession(session, attempts, {
      codeTests,
      stop: () => cancelled,
      onProgress: (done, total, name) => {
        bar.style.width = `${total ? Math.round(done / total * 100) : 100}%`;
        prog.textContent = done >= total ? "Finishing…" : `${done} of ${total} students${name ? ` · ${name}` : ""}`;
      },
    });
    if (cancelled) return;
    report(out.rows, codeTests);
  };

  const report = (rows, codeTests) => {
    const bad = rows.filter(r => r.disagree.length);
    const answers = rows.reduce((n, r) => n + r.items.length, 0);
    const unchecked = rows.reduce((n, r) => n + r.unchecked.length, 0);
    const fixable = rows.filter(r => r.fixes.length);
    body.innerHTML = `
      <h2>${bad.length ? `${bad.length} student${bad.length === 1 ? "" : "s"} to look at` : "Every mark agrees"}</h2>
      <div class="tiles" style="margin:12px 0 16px">
        <div class="tile"><b>${rows.length}</b><span>students checked</span></div>
        <div class="tile"><b>${answers}</b><span>answers marked again</span></div>
        <div class="tile ${bad.length ? "warn" : ""}"><b>${bad.length}</b><span>with a mark that disagrees</span></div>
        <div class="tile"><b>${unchecked}</b><span>couldn’t be checked</span></div>
      </div>
      ${bad.length ? `<div class="tablewrap"><table class="sc">
        <thead><tr><th>Student</th><th>Question</th><th>Saved</th><th>Marked again</th><th>Why</th><th class="n">Score</th></tr></thead>
        <tbody>${bad.map(r => r.disagree.map((i, k) => `<tr>
          <td>${k ? "" : esc(r.attempt.name)}</td>
          <td class="n" style="text-align:left">${esc(i.q.label)}</td>
          <td><span class="spill ${i.saved === "c" ? "done" : "wait"}">${markName(i.saved)}</span></td>
          <td><span class="spill ${i.computed === "c" ? "done" : "bad"}">${markName(i.computed)}</span></td>
          <td class="note">${esc(i.why)}</td>
          <td class="n">${k ? "" : `${fmtPts(r.saved.score)} → <b>${fmtPts(r.true_.score)}</b>`}</td>
        </tr>`).join("")).join("")}</tbody></table></div>`
        : `<p>All ${answers} answers were marked again and every saved mark matches${codeTests ? ", code tests included" : ""}.</p>`}
      ${unchecked ? `<p class="note" style="margin-top:12px">${unchecked} answer${unchecked === 1 ? "" : "s"} couldn’t be checked${codeTests ? "" : " — code tests weren’t re-run"}. They’re in the CSV report.</p>` : ""}`;
    foot.innerHTML =
      `<button class="btn ghost" data-csv type="button">Download report (CSV)</button>` +
      (fixable.length && canApply ? `<button class="btn danger" data-apply type="button">Apply ${fixable.length} correction${fixable.length === 1 ? "" : "s"}</button>` : "") +
      (fixable.length && !canApply ? `<span class="note" style="margin-right:auto">End the test to write corrections.</span>` : "") +
      `<button class="btn" data-close="" type="button">Close</button>`;
    foot.querySelector("[data-csv]").addEventListener("click", () => csvReport(session, rows));
    foot.querySelector("[data-apply]")?.addEventListener("click", e => confirmClick(e.currentTarget, async () => {
      const btn = e.currentTarget; btn.disabled = true;
      let ok = 0, failed = 0;
      for (const r of fixable) {
        try { await applyRow(store, sid, r); ok++; } catch (ex) { failed++; console.warn(ex); }
      }
      toast(failed ? `${ok} corrected, ${failed} couldn’t be saved` : `${ok} student${ok === 1 ? "" : "s"} corrected`, failed ? "err" : "");
      d.close("applied");
    }, `Click again: rewrites ${fixable.length} student${fixable.length === 1 ? "" : "s"}`));
  };

  intro();
  return d.done;
}

function csvReport(session, rows) {
  const lines = [csvLine(["Student", "Question", "Title", "Type", "Saved mark", "Marked again", "Result", "Why", "Saved score", "Score after"])];
  for (const r of rows) {
    for (const i of r.items) {
      if (i.status === "agrees") continue;
      lines.push(csvLine([r.attempt.name, i.q.label, i.q.title, i.q.type, markName(i.saved), markName(i.computed), i.status, i.why, r.saved.score, r.true_.score]));
    }
  }
  const base = (session.title || "session").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase();
  download(`${base}-regrade.csv`, "﻿" + lines.join("\n"), "text/csv");
}
