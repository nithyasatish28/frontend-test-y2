// Who can get in: the instructors, and anyone waiting to be let in.
//
// Letting someone in is the only way to become an instructor from inside the app, and only the
// super admin can do it — the first account set up, plus anyone it has passed the role to.
// An ordinary instructor sees the list and nothing else; the rules enforce that, not this file.
import { esc, dateTime, confirmClick, toast } from "../lib/util.js";
import { INSTRUCTOR_EMAIL_DOMAIN } from "../config.js";

export function mount(view, ctx) {
  const { store } = ctx;
  // The router keeps everyone else out, and the rules refuse them the data even if they get here.
  if (ctx.role !== "super") { view.innerHTML = ""; return () => {}; }
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
          <td><b>${esc(a.name || "—")}</b>${self ? ` <span class="spill done">you</span>` : ""}</td>
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

  const offA = store.watchAdmins((list, err) => { if (err) return toast(err.message, "err"); admins = list || []; drawAdmins(); });
  // Only the super admin is allowed to read the waiting list.
  const offR = store.watchRequests((list, err) => { if (err) return toast(err.message, "err"); requests = list || []; drawRequests(); });
  drawAdmins(); drawRequests();
  return () => { offA(); offR(); };
}
