// Marking written answers by hand, one question at a time.
//
// Written answers are the one kind the app can't mark itself, so this is where you read them.
// Marking one question across every student beats going student by student: you hold one
// question's standard in your head, and the marks come out consistent.
//
// Marks are written into the student's own attempt (entry.awarded, entry.note), which is also
// where a student's browser writes. That is only safe once their test is over — while it is
// running their next save carries their whole answer map and would wipe the mark. So this
// screen only opens for students who have finished, and says so about the ones who haven't.
import { esc, fmtPts } from "../lib/util.js";
import { qPoints, needsMarking, written } from "../lib/grade.js";
import { dialog } from "./dialog.js";

export const subjectiveQuestions = session => (session.questions || []).filter(q => q.type === "subjective");

// How many answers are sitting there waiting to be read.
export function unmarkedCount(session, rows) {
  let n = 0;
  for (const q of subjectiveQuestions(session)) {
    for (const r of rows) if (needsMarking(q, (r.q || {})[q.id])) n++;
  }
  return n;
}

export function markingDialog(ctx, sid, session, rows, { canMark = false } = {}) {
  const { store } = ctx;
  const qs = subjectiveQuestions(session);
  const d = dialog(`<div class="dlg-body" data-body></div><div class="dlg-foot" data-foot></div>`, { wide: true });
  const body = d.el.querySelector("[data-body]"), foot = d.el.querySelector("[data-foot]");
  let qi = 0;

  // Only students whose test is over can be marked without their own browser undoing it:
  // either they submitted, or the whole session has ended.
  const eligible = rows.filter(r => canMark || r.status === "submitted");
  const waiting = rows.length - eligible.length;

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
    const answered = eligible.filter(r => written((r.q || {})[q.id]));
    const left = answered.filter(r => needsMarking(q, (r.q || {})[q.id])).length;

    body.innerHTML = `
      <h2 style="margin-bottom:4px">${esc(q.label)} · ${esc(q.title || "Written answer")}</h2>
      <p class="note" style="margin:0 0 12px">Question ${qi + 1} of ${qs.length} · ${fmtPts(full)} mark${full === 1 ? "" : "s"} ·
        ${answered.length} answered · <b>${left}</b> still to mark${waiting ? ` · ${waiting} student${waiting === 1 ? "" : "s"} haven’t finished` : ""}</p>
      <div class="markq">
        <div class="prompt">${esc(q.prompt || "")}</div>
        ${notes[q.id] ? `<details class="notes" open><summary>Your marking notes</summary><div>${esc(notes[q.id])}</div></details>` : ""}
      </div>
      <div class="marklist">${answered.length ? answered.map(r => row(r, q, full)).join("") : `<p class="empty">Nobody has written anything for this one.</p>`}</div>`;

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
    return `
      <div class="markrow ${marked ? "done" : ""}" data-uid="${esc(r.id)}">
        <div class="who"><b>${esc(r.name)}</b>${e.h ? ` <span class="spill idle">used the hint</span>` : ""}
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
    state.textContent = "Saving…";
    try {
      await store.saveAttempt(sid, uid, { q: { [q.id]: { awarded, note: note || null } } });
      rowEl.classList.add("done");
      state.textContent = `Marked ${fmtPts(awarded)} / ${fmtPts(full)}`;
    } catch (e) { state.textContent = e.message; }
  };

  if (!qs.length) {
    body.innerHTML = `<h2>No written answers here</h2><p>This session has no written-answer questions, so there is nothing to mark by hand.</p>`;
    foot.innerHTML = `<button class="btn" data-close="" type="button">Close</button>`;
  } else if (!eligible.length) {
    body.innerHTML = `<h2>Nothing to mark yet</h2><p>Written answers can be marked once a student has submitted, or once the test is over —
      until then their own page keeps saving over the top.</p>`;
    foot.innerHTML = `<button class="btn" data-close="" type="button">Close</button>`;
  } else draw();

  return d.done;
}
