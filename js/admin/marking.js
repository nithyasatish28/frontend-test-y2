// Marking written answers by hand, one question at a time.
//
// Written answers are the one kind the app can't mark itself, so this is where you read them.
// Marking one question across every student beats going student by student: you hold one
// question's standard in your head, and the marks come out consistent.
//
// Marks are written into the student's own attempt (entry.awarded, entry.note). A student's own
// save carries their whole answer map, but it is a merge, so a mark written here survives it —
// which is what makes marking a running test possible at all.
//
// Two ways to work, chosen per session (liveMarking):
//   off — the usual way: a student can be marked once they submit, or once the test ends.
//   on  — each written answer gets its own "Hand in this answer" button. An answer appears here
//         once it is handed in, so you are never marking something still being written. The
//         marked text is remembered anyway, as a backstop against an answer changing after.
import { esc, fmtPts } from "../lib/util.js";
import { qPoints, needsMarking, written, cyrb53 } from "../lib/grade.js";
import { dialog } from "./dialog.js";

export const subjectiveQuestions = session => (session.questions || []).filter(q => q.type === "subjective");

// How many answers are sitting there waiting to be read.
export function unmarkedCount(session, rows, ended = false) {
  let n = 0;
  for (const q of subjectiveQuestions(session)) {
    for (const r of rows) {
      const e = (r.q || {})[q.id];
      if (needsMarking(q, e) && readyToMark(session, r, e, ended)) n++;
    }
  }
  return n;
}

// An answer is ready to mark when it can no longer change: the student handed that answer in
// (live sessions), submitted the whole test, or the test is over.
export const readyToMark = (session, r, e, ended) =>
  !!written(e) && (ended || r.status === "submitted" || (!!session.liveMarking && !!e.handed));

export function markingDialog(ctx, sid, session, rows, { ended = false } = {}) {
  const { store } = ctx;
  const qs = subjectiveQuestions(session);
  const d = dialog(`<div class="dlg-body" data-body></div><div class="dlg-foot" data-foot></div>`, { wide: true });
  const body = d.el.querySelector("[data-body]"), foot = d.el.querySelector("[data-foot]");
  let qi = 0;

  // Only students whose test is over can be marked without their own browser undoing it:
  // either they submitted, or the whole session has ended.
  const live = !!session.liveMarking;

  // The marking notes are deliberately NOT in the session — publishQuestion strips them so a
  // student's browser can never receive them. They live on the question set the session was
  // made from, which only instructors can read, so they are fetched from there.
  let notes = {}, touched = false;
  (async () => {
    if (!session.setId) return;
    try {
      const original = await store.getSet(session.setId);
      if (!original) return;
      notes = Object.fromEntries((original.questions || []).map(x => [x.id, x.expected || ""]));
      if (!touched && qs.length) draw();        // redraw quietly, unless marking has started
    } catch { /* the set may have been deleted: mark without the notes */ }
  })();

  const draw = () => {
    const q = qs[qi];
    const full = qPoints(q, session);
    const answered = rows.filter(r => readyToMark(session, r, (r.q || {})[q.id], ended));
    const left = answered.filter(r => needsMarking(q, (r.q || {})[q.id])).length;
    // Written, but not ready: still being worked on.
    const writing = rows.filter(r => written((r.q || {})[q.id]) && !readyToMark(session, r, (r.q || {})[q.id], ended)).length;

    body.innerHTML = `
      <h2 style="margin-bottom:4px">${esc(q.label)} · ${esc(q.title || "Written answer")}</h2>
      <p class="note" style="margin:0 0 12px">Question ${qi + 1} of ${qs.length} · ${fmtPts(full)} mark${full === 1 ? "" : "s"} ·
        ${answered.length} ready · <b>${left}</b> still to mark${writing ? ` · ${writing} still being written` : ""}</p>
      <label class="switch" style="margin:0 0 12px"><input type="checkbox" data-live ${live ? "checked" : ""}>
        Mark while the test is running</label>
      <p class="note" style="margin:-8px 0 12px">${live
        ? "On: each answer gets its own Hand in button, and lands here the moment a student presses it."
        : "Off: a student's answers can be marked once they submit, or once the test ends."}</p>
      <div class="markq">
        <div class="prompt">${esc(q.prompt || "")}</div>
        ${notes[q.id] ? `<details class="notes" open><summary>Your marking notes</summary><div>${esc(notes[q.id])}</div></details>` : ""}
      </div>
      <div class="marklist">${answered.length ? answered.map(r => row(r, q, full)).join("")
        : `<p class="empty">${writing ? `Nothing handed in yet — ${writing} still being written.` : "Nobody has written anything for this one."}</p>`}</div>`;

    body.querySelectorAll("[data-award]").forEach(inp => inp.addEventListener("change", () => save(inp, q, full)));
    body.querySelectorAll("[data-note]").forEach(inp => inp.addEventListener("change", () => save(inp.closest(".markrow").querySelector("[data-award]"), q, full)));
    body.querySelectorAll("[data-full]").forEach(b => b.addEventListener("click", () => {
      const inp = b.closest(".markrow").querySelector("[data-award]");
      inp.value = String(full); save(inp, q, full);
    }));
    body.querySelectorAll("[data-zero]").forEach(b => b.addEventListener("click", () => {
      const inp = b.closest(".markrow").querySelector("[data-award]");
      inp.value = "0"; save(inp, q, full);
    }));

    body.querySelector("[data-live]").addEventListener("change", async ev => {
      const want = ev.target.checked;
      ev.target.disabled = true;
      try { await store.updateSession(sid, { liveMarking: want }); d.close("mode-changed"); }
      catch (err) { ev.target.checked = !want; ev.target.disabled = false; }
    });

    foot.innerHTML = `
      ${qs.length > 1 ? `<button class="btn ghost" data-prev type="button" ${qi === 0 ? "disabled" : ""}>← Previous question</button>
      <button class="btn ghost" data-next type="button" ${qi === qs.length - 1 ? "disabled" : ""}>Next question →</button>` : ""}
      <button class="btn" data-close="" type="button">Done</button>`;
    foot.querySelector("[data-prev]")?.addEventListener("click", () => { qi--; draw(); });
    foot.querySelector("[data-next]")?.addEventListener("click", () => { qi++; draw(); });
  };

  const row = (r, q, full) => {
    const e = (r.q || {})[q.id] || {};
    const marked = typeof e.awarded === "number";
    // They may have carried on writing after being marked — say so rather than quietly disagree.
    const stale = marked && e.markedHash && e.markedHash !== cyrb53(String(e.text || ""));
    return `
      <div class="markrow ${marked ? "done" : ""}" data-uid="${esc(r.id)}">
        <div class="who"><b>${esc(r.name)}</b>${e.h ? ` <span class="spill idle">used the hint</span>` : ""}${
          stale ? ` <span class="spill bad">answered again since you marked it</span>` : ""}${
          live && e.handed && r.status !== "submitted" ? ` <span class="spill done">handed in</span>` : ""}
          <span class="state" data-state>${marked ? `Marked ${fmtPts(e.awarded)} / ${fmtPts(full)}` : "Not marked"}</span></div>
        <div class="said">${esc(e.text || "")}</div>
        <div class="give">
          <label>Marks <input class="input" data-award type="number" min="0" max="${full}" step="0.5"
            value="${marked ? esc(String(e.awarded)) : ""}" placeholder="0–${fmtPts(full)}" aria-label="Marks for ${esc(r.name)}"></label>
          <button class="btn ghost small" data-full type="button">Full</button>
          <button class="btn ghost small" data-zero type="button">0</button>
          <input class="input" data-note value="${esc(e.note || "")}" placeholder="A note for them (optional)" aria-label="Note for ${esc(r.name)}">
        </div>
      </div>`;
  };

  const save = async (inp, q, full) => {
    const rowEl = inp.closest(".markrow"), uid = rowEl.dataset.uid;
    const state = rowEl.querySelector("[data-state]");
    touched = true;
    const raw = inp.value.trim();
    if (raw === "") return;
    const awarded = Number(raw);
    if (!(awarded >= 0 && awarded <= full)) { state.textContent = `Marks must be between 0 and ${fmtPts(full)}`; inp.focus(); return; }
    const note = rowEl.querySelector("[data-note]").value.trim();
    const text = rowEl.querySelector(".said").textContent;
    state.textContent = "Saving…";
    try {
      await store.saveAttempt(sid, uid, { q: { [q.id]: { awarded, note: note || null, markedHash: cyrb53(text) } } });
      rowEl.classList.add("done");
      state.textContent = `Marked ${fmtPts(awarded)} / ${fmtPts(full)}`;
    } catch (e) { state.textContent = e.message; }
  };

  if (!qs.length) {
    body.innerHTML = `<h2>No written answers here</h2><p>This session has no written-answer questions, so there is nothing to mark by hand.</p>`;
    foot.innerHTML = `<button class="btn" data-close="" type="button">Close</button>`;
  } else if (!rows.some(r => qs.some(q => readyToMark(session, r, (r.q || {})[q.id], ended)))) {
    body.innerHTML = `<h2>Nothing to mark yet</h2>
      <p>${live
        ? "Nobody has handed an answer in yet. They appear here the moment a student presses Hand in."
        : "Nobody has submitted, and the test is still running. Switch this on and students can hand in each written answer as they finish it, for you to mark straight away."}</p>
      ${live ? "" : `<label class="switch"><input type="checkbox" data-live> Mark while the test is running</label>`}`;
    foot.innerHTML = `<button class="btn" data-close="" type="button">Close</button>`;
    body.querySelector("[data-live]")?.addEventListener("change", async ev => {
      ev.target.disabled = true;
      try { await store.updateSession(sid, { liveMarking: true }); d.close("mode-changed"); }
      catch (err) { ev.target.checked = false; ev.target.disabled = false; }
    });
  } else draw();

  return d.done;
}
