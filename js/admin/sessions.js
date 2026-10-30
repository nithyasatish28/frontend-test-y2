// Every session, newest first, and the "New session" dialog.
import { esc, fmtPts, dateTime, uid as randomId, toast } from "../lib/util.js";
import { publishSet } from "../lib/grade.js";
import { dialog } from "./dialog.js";
import { importOld } from "./import-old.js";

export const phaseOf = (s, now = Date.now()) =>
  s.status === "waiting" ? "waiting" : s.status === "ended" || (s.startAt && now >= s.startAt + s.minutes * 60000) ? "ended" : "running";
export const phasePill = (s, active) => {
  const p = phaseOf(s);
  return (p === "waiting" ? `<span class="spill wait">Waiting room</span>` : p === "running" ? `<span class="spill live">Running</span>` : `<span class="spill off">Ended</span>`) +
    "";
};

export function mount(view, ctx) {
  const { store } = ctx;
  view.innerHTML = `
    <div class="page-head"><h1>Sessions</h1><button class="btn ghost" data-import type="button">Import old results</button><button class="btn" data-new type="button">New session</button></div>
    <p class="sub" style="margin:-6px 0 0">A session is one sitting of a test. Each one keeps its own results, so you can come back to old ones any time.</p>
    <div class="card"><div class="tablewrap"><table class="grid" data-table></table></div></div>`;
  view.querySelector("[data-new]").addEventListener("click", () => newSession(ctx));
  view.querySelector("[data-import]").addEventListener("click", () => importOld(ctx));
  let list = [];
  const draw = () => {
    const t = view.querySelector("[data-table]");
    if (!list.length) { t.innerHTML = `<tr><td class="empty">No sessions yet. Press <b>New session</b> to make the first one.</td></tr>`; return; }
    t.innerHTML = `<thead><tr><th>Date</th><th>Title</th><th>Question set</th><th>Status</th><th class="n">Students</th><th class="n">Submitted</th><th class="n">Average</th><th class="n">Top</th></tr></thead><tbody>` +
      list.map(s => {
        const st = s.stats || {};
        return `<tr class="click" data-id="${esc(s.id)}" tabindex="0"><td>${s.createdAt ? dateTime(s.createdAt) : "–"}</td><td class="name">${esc(s.title || "Untitled")}</td><td>${esc(s.setTitle || "")}</td><td>${s.imported ? `<span class="spill off">Imported</span>` : phasePill(s, ctx.settings.activeSessionId === s.id)}</td>
          <td class="n">${st.joined ?? "–"}</td><td class="n">${st.submitted ?? "–"}</td><td class="n">${st.joined ? fmtPts(st.avg) + " / " + (s.questions || []).length : "–"}</td><td class="n">${st.joined ? fmtPts(st.top) : "–"}</td></tr>`;
      }).join("") + "</tbody>";
    t.querySelectorAll("tr[data-id]").forEach(tr => {
      const open = () => ctx.go("#/session/" + tr.dataset.id);
      tr.addEventListener("click", open);
      tr.addEventListener("keydown", e => { if (e.key === "Enter") open(); });
    });
  };
  const offSessions = store.watchSessions((l, err) => { if (err) toast(err.message, "err"); list = l; draw(); });
  const offSettings = ctx.onSettings(draw);
  return () => { offSessions(); offSettings(); };
}

// The dialog: pick a question set, a title and a time limit.
export async function newSession(ctx) {
  const { store } = ctx;
  let sets = [];
  const off = store.watchSets(l => { sets = l; fill(); });
  const today = new Date().toLocaleDateString([], { day: "numeric", month: "short" });
  const d = dialog(`
    <form class="dlg-body" novalidate>
      <h2>New session</h2>
      <p class="note" style="margin-top:0">Students open its link, type their name, wait in the waiting room, and start together when you press Start.</p>
      <label class="field"><span>Question set</span><select name="set" required></select></label>
      <label class="field"><span>Title students see</span><input name="stitle" required maxlength="80"></label>
      <div class="form-grid cols-2">
        <label class="field"><span>Time limit (minutes)</span><input name="minutes" type="number" min="1" max="300" required></label>
        <label class="field"><span>&nbsp;</span><span class="switch"><input type="checkbox" name="now"> Start the timer right away</span></label>
      </div>
      <p class="note">The session gets its own link to share with the students. It works until the test ends, then closes.</p>
      <p class="err" data-err></p>
    </form>
    <div class="dlg-foot"><button class="btn ghost" data-close type="button">Cancel</button><button class="btn" data-create type="button">Create session</button></div>`);
  const f = d.el.querySelector("form"), err = d.el.querySelector("[data-err]");
  let touchedTitle = false;
  f.stitle.addEventListener("input", () => (touchedTitle = true));
  function fill() {
    const cur = f.set.value;
    f.set.innerHTML = sets.length ? sets.map(s => `<option value="${esc(s.id)}">${esc(s.title || "Untitled")} (${(s.questions || []).length} questions)</option>`).join("") : `<option value="">No question sets yet: make one in Questions</option>`;
    if (cur && sets.some(s => s.id === cur)) f.set.value = cur;
    pick();
  }
  function pick() {
    const s = sets.find(x => x.id === f.set.value);
    if (!s) return;
    if (!touchedTitle) f.stitle.value = `${s.title} · ${today}`;
    if (!f.minutes.dataset.touched) f.minutes.value = s.minutes || 45;
  }
  f.set.addEventListener("change", pick);
  f.minutes.addEventListener("input", () => (f.minutes.dataset.touched = "1"));
  d.el.querySelector("[data-create]").addEventListener("click", async e => {
    const btn = e.currentTarget;
    const s = sets.find(x => x.id === f.set.value), m = Math.round(Number(f.minutes.value));
    if (!s) { err.textContent = "Pick a question set. (Make one in the Questions tab first.)"; return; }
    if (!(s.questions || []).length) { err.textContent = "That question set has no questions yet."; return; }
    if (!f.stitle.value.trim()) { err.textContent = "Give the session a title."; return; }
    if (!(m >= 1 && m <= 300)) { err.textContent = "Set a time limit between 1 and 300 minutes."; return; }
    btn.disabled = true;
    try {
      const salt = randomId(16);
      const pub = publishSet(s, salt);
      const now = f.now.checked;
      const id = await store.createSession({
        title: f.stitle.value.trim(), setId: s.id, setTitle: s.title || "", minutes: m,
        points: s.points ?? 1, hintPenalty: s.hintPenalty ?? 0.5, salt, ...pub,
        status: now ? "running" : "waiting", ...(now ? { startAt: store.NOW } : {}), stats: { joined: 0, submitted: 0, avg: 0, top: 0 },
      });
      await store.setSettings({ activeSessionId: id });                       // show it in the Live tab
      d.close(id);
      ctx.go("#/session/" + id);
    } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
  });
  await d.done;
  off();
}
