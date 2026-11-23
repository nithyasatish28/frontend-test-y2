// Who can get in: the instructors, and anyone waiting to be let in.
//
// Letting someone in is the only way to become an instructor from inside the app, and only the
// super admin can do it — the first account set up, plus anyone it has passed the role to.
// An ordinary instructor sees the list and nothing else; the rules enforce that, not this file.
import { esc, day, dateTime, fmtPts, confirmClick, toast } from "../lib/util.js";
import { INSTRUCTOR_EMAIL_DOMAIN } from "../config.js";

export function mount(view, ctx, uid) {
  const { store } = ctx;
  // The router keeps everyone else out, and the rules refuse them the data even if they get here.
  if (ctx.role !== "super") { view.innerHTML = ""; return () => {}; }
  // One instructor's own work. Nobody's sets or sessions are on show until you ask for them.
  if (uid) return one(view, ctx, uid);
  let admins = [], requests = [];

  view.innerHTML = `
    <section class="card">
      <div class="page-head"><h1 style="margin:0;margin-right:auto">Instructors</h1>
        <span class="spill done">You’re the super admin</span></div>
      <p class="sub">Anyone with a <b>${esc(INSTRUCTOR_EMAIL_DOMAIN)}</b> email can ask to be let in. They confirm their
        email first, then you approve them here. Until that happens they can’t see a single question, answer or score.</p>
      <p class="note">Nobody else sees this page: an instructor you let in gets Live, Sessions and Questions, and
        never the list of who else is here.</p>
    </section>
    <section class="card" data-orphans hidden></section>
    <section class="card" data-reqs hidden></section>
    <section class="card">
      <h2>Instructors</h2>
      <div class="tablewrap"><table class="sc" data-admins></table></div>
      <p class="note">A second super admin is worth having: if you lose your account, nobody can approve
        anyone again. Pass the role to someone you trust with the whole app.</p>
    </section>`;

  const drawRequests = () => {
    const box = view.querySelector("[data-reqs]");
    box.hidden = !requests.length;
    if (!requests.length) return;
    box.innerHTML = `
      <h2>${requests.length} ${requests.length === 1 ? "person is" : "people are"} waiting for you</h2>
      <p class="sub">Let in only people you know. An instructor can see every question, every answer and every score.</p>
      <div class="tablewrap"><table class="sc">
        <thead><tr><th>Name</th><th>Email</th><th>Asked</th><th></th></tr></thead>
        <tbody>${requests.map(r => `<tr>
          <td><b>${esc(r.name || "—")}</b></td>
          <td class="mono">${esc(r.email || "")}</td>
          <td>${r.askedAt ? esc(dateTime(r.askedAt)) : "—"}</td>
          <td style="text-align:right;white-space:nowrap">
            <button class="btn small" data-ok="${esc(r.uid)}" type="button">Let them in</button>
            <button class="btn ghost small" data-no="${esc(r.uid)}" type="button">Decline</button>
          </td></tr>`).join("")}</tbody>
      </table></div>`;
    box.querySelectorAll("[data-ok]").forEach(b => b.addEventListener("click", async () => {
      const r = requests.find(x => x.uid === b.dataset.ok); if (!r) return;
      b.disabled = true;
      try { await store.approveRequest(r); toast(`${r.name || r.email} is an instructor now`); }
      catch (e) { toast(e.message, "err"); b.disabled = false; }
    }));
    box.querySelectorAll("[data-no]").forEach(b => b.addEventListener("click", () => confirmClick(b, async () => {
      try { await store.cancelRequest(b.dataset.no); toast("Request declined"); }
      catch (e) { toast(e.message, "err"); }
    }, "Click again to decline")));
  };

  const roleOf = a => (a.role === "super" || a.id === ctx.ownerUid ? "super" : "instructor");
  const drawAdmins = () => {
    const t = view.querySelector("[data-admins]");
    const rows = admins.slice().sort((a, b) =>
      (roleOf(b) === "super") - (roleOf(a) === "super") || String(a.name || a.email).localeCompare(String(b.name || b.email)));
    t.innerHTML = `
      <thead><tr><th>Name</th><th>Email</th><th>Can approve</th><th></th></tr></thead>
      <tbody>${rows.map(a => {
        const self = a.id === ctx.user?.uid, sup = roleOf(a) === "super";
        return `<tr>
          <td><a href="#/instructors/${esc(a.id)}"><b>${esc(a.name || "—")}</b></a>${self ? ` <span class="spill done">you</span>` : ""}</td>
          <td class="mono">${esc(a.email || "")}</td>
          <td>${sup ? `<span class="spill live">super admin</span>` : `<span class="spill off">no</span>`}</td>
          <td style="text-align:right;white-space:nowrap">${self
            ? `<span class="note">That’s you</span>`
            : `${sup
                ? `<button class="btn ghost small" data-demote="${esc(a.id)}" type="button">Take the role back</button>`
                : `<button class="btn ghost small" data-promote="${esc(a.id)}" type="button">Make super admin</button>`}
               <button class="btn ghost small" data-rm="${esc(a.id)}" type="button">Remove</button>`}</td>
        </tr>`;
      }).join("") || `<tr><td colspan="4" class="empty">No instructors yet.</td></tr>`}</tbody>`;

    t.querySelectorAll("[data-promote]").forEach(b => b.addEventListener("click", () => confirmClick(b, async () => {
      try { await store.setRole(b.dataset.promote, "super"); toast("They can approve new instructors now"); }
      catch (e) { toast(e.message, "err"); }
    }, "Click again: they can approve anyone")));
    t.querySelectorAll("[data-demote]").forEach(b => b.addEventListener("click", () => confirmClick(b, async () => {
      try { await store.setRole(b.dataset.demote, "instructor"); toast("They can’t approve any more"); }
      catch (e) { toast(e.message, "err"); }
    }, "Click again to take it back")));
    t.querySelectorAll("[data-rm]").forEach(b => b.addEventListener("click", () => confirmClick(b, async () => {
      try { await store.removeAdmin(b.dataset.rm); toast("Removed. They can’t open the instructor page any more."); }
      catch (e) { toast(e.message, "err"); }
    }, "Click again: they lose access")));
  };

  // Everything made before instructors had their own work belongs to nobody. Only the super
  // admin can see it (their lists aren't filtered), so only they can hand it out.
  async function drawOrphans() {
    const box = view.querySelector("[data-orphans]");
    let sets = [], sessions = [];
    try {
      sets = await new Promise(r => { const off = store.watchSets(l => { off(); r(l || []); }, null); });
      sessions = await new Promise(r => { const off = store.watchSessions(l => { off(); r(l || []); }, null); });
    } catch { return; }
    const loose = sets.filter(x => !x.ownerUid).length + sessions.filter(x => !x.ownerUid).length;
    box.hidden = !loose;
    if (!loose) return;
    box.innerHTML = `
      <h2>${loose} thing${loose === 1 ? "" : "s"} with no owner</h2>
      <p class="sub">${sets.filter(x => !x.ownerUid).length} question set(s) and ${sessions.filter(x => !x.ownerUid).length} session(s)
        were made before each instructor had their own. Nobody but you can see them. Take them, and they appear in your lists as normal.</p>
      <div class="actions"><button class="btn" data-adopt type="button">Make these mine</button></div>`;
    box.querySelector("[data-adopt]").addEventListener("click", e => confirmClick(e.currentTarget, async () => {
      e.currentTarget.disabled = true;
      try {
        const n = await store.adoptUnowned(ctx.user.uid);
        toast(`${n.sets} question set(s) and ${n.sessions} session(s) are yours now`);
        drawOrphans();
      } catch (ex) { toast(ex.message, "err"); e.currentTarget.disabled = false; }
    }, "Click again: they all become yours"));
  }
  drawOrphans();

  const offA = store.watchAdmins((list, err) => { if (err) return toast(err.message, "err"); admins = list || []; drawAdmins(); });
  // Only the super admin is allowed to read the waiting list.
  const offR = store.watchRequests((list, err) => { if (err) return toast(err.message, "err"); requests = list || []; drawRequests(); });
  drawAdmins(); drawRequests();
  return () => { offA(); offR(); };
}

/* ─────────── One instructor's work ─────────── */
// Reached only by asking: the lists everywhere else show your own work, so a colleague's sets
// and sessions are never in front of you by accident.
function one(view, ctx, uid) {
  const { store } = ctx;
  let who = null, sets = [], sessions = [];
  view.innerHTML = `
    <a class="crumb" href="#/instructors">← All instructors</a>
    <section class="card"><h1 style="margin:0" data-name>Loading…</h1><p class="sub" data-mail></p></section>
    <section class="card"><h2>Question sets</h2><div class="set-cards" data-sets></div></section>
    <section class="card"><h2>Sessions</h2><div class="tablewrap"><table class="sc" data-sessions></table></div></section>`;
  const $ = s => view.querySelector(s);

  const drawWho = () => {
    $("[data-name]").textContent = who ? (who.name || who.email || "This instructor") : "This instructor";
    $("[data-mail]").innerHTML = who
      ? `${esc(who.email || "")} · ${sets.length} question set${sets.length === 1 ? "" : "s"} · ${sessions.length} session${sessions.length === 1 ? "" : "s"}`
      : "They may have been removed.";
  };
  const drawSets = () => {
    $("[data-sets]").innerHTML = sets.length ? sets.map(x => {
      const n = (x.questions || []).length;
      return `<a class="set-card" href="#/questions/${esc(x.id)}"><h3>${esc(x.title || "Untitled")}</h3>
        <div class="meta">${n} question${n === 1 ? "" : "s"} · ${x.minutes || 45} min${x.updatedAt ? " · edited " + day(x.updatedAt) : ""}</div>
        ${x.description ? `<div>${esc(x.description)}</div>` : ""}</a>`;
    }).join("") : `<p class="note" style="margin:0">No question sets.</p>`;
  };
  const drawSessions = () => {
    const t = $("[data-sessions]");
    t.innerHTML = `<thead><tr><th>When</th><th>Title</th><th>From</th><th class="n">Joined</th><th class="n">Submitted</th></tr></thead>
      <tbody>${sessions.length ? sessions.map(x => {
        const st = x.stats || {};
        return `<tr class="click" data-id="${esc(x.id)}" tabindex="0"><td>${x.createdAt ? esc(dateTime(x.createdAt)) : "–"}</td>
          <td class="name">${esc(x.title || "Untitled")}</td><td>${esc(x.setTitle || "")}</td>
          <td class="n">${st.joined ?? "–"}</td><td class="n">${st.submitted ?? "–"}</td></tr>`;
      }).join("") : `<tr><td colspan="5" class="empty">No sessions.</td></tr>`}</tbody>`;
    t.querySelectorAll("tr[data-id]").forEach(tr => {
      const open = () => ctx.go("#/session/" + tr.dataset.id);
      tr.addEventListener("click", open);
      tr.addEventListener("keydown", e => { if (e.key === "Enter") open(); });
    });
  };

  const offA = store.watchAdmins(list => { who = (list || []).find(a => a.id === uid) || null; drawWho(); });
  const offS = store.watchSets((l, err) => { if (err) return toast(err.message, "err"); sets = l || []; drawSets(); drawWho(); }, uid);
  const offSe = store.watchSessions((l, err) => { if (err) return toast(err.message, "err"); sessions = l || []; drawSessions(); drawWho(); }, uid);
  drawSets(); drawSessions();
  return () => { offA(); offS(); offSe(); };
}
