// Student accounts: sign-ups on/off, the link to share, switch accounts off, free a name.
import { esc, day, confirmClick, copyText, toast } from "../lib/util.js";

export function mount(view, ctx) {
  const { store } = ctx;
  view.innerHTML = `
    <div class="page-head"><h1>Students</h1></div>
    <section class="card">
      <h2>How students get in</h2>
      <p style="margin-top:0">Share this link. The first time, each student makes an account with their <b>name and a password</b>. After that they log in with the same name and password.</p>
      <div class="linkbox" style="border:0;padding:0;margin:0"><input readonly data-link aria-label="Student link"><button class="btn ghost small" data-copy type="button">Copy</button><a class="btn ghost small" data-open target="_blank" rel="noopener">Open</a></div>
      <p class="note" data-active></p>
      <label class="switch" style="margin-top:12px"><input type="checkbox" data-signup> Let new students create accounts</label>
      <p class="note" style="margin:4px 0 0">Turn this off once everyone has an account, so nobody else can make one.</p>
    </section>
    <section class="card">
      <div class="tools"><input type="search" data-search placeholder="Search by name" aria-label="Search students"><span class="note" data-count></span></div>
      <div class="tablewrap"><table class="grid" data-table></table></div>
      <details class="help" style="margin-top:12px"><summary>A student forgot their password</summary>
        <p>Press <b>Free the name</b> next to them. Their old account is switched off, and they can create a new account with the same name (sign-ups must be on). Results from past sessions stay under their old account.</p></details>
    </section>`;
  const $ = s => view.querySelector(s);
  const link = ctx.studentLink("");
  $("[data-link]").value = link; $("[data-open]").href = link;
  $("[data-copy]").addEventListener("click", async () => toast((await copyText(link)) ? "Link copied" : "Couldn’t copy. Select the link and copy it."));
  $("[data-signup]").addEventListener("change", async e => {
    try { await store.setSettings({ signupOpen: e.target.checked }); toast(e.target.checked ? "New accounts are open" : "New accounts are closed"); }
    catch (ex) { toast(ex.message, "err"); e.target.checked = !e.target.checked; }
  });
  $("[data-search]").addEventListener("input", draw);
  let users = [];
  function draw() {
    const q = $("[data-search]").value.trim().toLowerCase();
    const list = users.filter(u => !q || String(u.name).toLowerCase().includes(q)).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    $("[data-count]").textContent = `${users.filter(u => !u.disabled).length} active account${users.length === 1 ? "" : "s"}`;
    const t = $("[data-table]");
    t.innerHTML = `<thead><tr><th>Name</th><th>Joined</th><th>Account</th><th></th></tr></thead><tbody>` + (list.map(u => `
      <tr><td class="name">${esc(u.name)}</td><td>${u.createdAt ? day(u.createdAt) : "–"}</td>
        <td>${u.released ? `<span class="spill off">Name freed</span>` : u.disabled ? `<span class="spill bad">Switched off</span>` : `<span class="spill live">Active</span>`}</td>
        <td style="text-align:right">${u.released ? "" : `<button class="btn ghost small" data-toggle="${esc(u.id)}" type="button">${u.disabled ? "Switch on" : "Switch off"}</button>
          <button class="btn ghost small" data-free="${esc(u.id)}" type="button" title="For a forgotten password">Free the name</button>`}</td></tr>`).join("") ||
      `<tr><td colspan="4" class="empty">${users.length ? "No students match." : "No student accounts yet. Share the link above."}</td></tr>`) + "</tbody>";
    t.querySelectorAll("[data-toggle]").forEach(b => b.addEventListener("click", async () => {
      const u = users.find(x => x.id === b.dataset.toggle);
      try { await store.updateUser(u.id, { disabled: !u.disabled }); } catch (e) { toast(e.message, "err"); }
    }));
    t.querySelectorAll("[data-free]").forEach(b => b.addEventListener("click", () => confirmClick(b, async () => {
      const u = users.find(x => x.id === b.dataset.free);
      try { await store.releaseName(u); toast(`${u.name} can now create a new account.`); } catch (e) { toast(e.message, "err"); }
    }, "Click again to confirm")));
  }
  const offU = store.watchUsers((l, err) => { if (err) toast(err.message, "err"); users = l || []; draw(); });
  const offS = ctx.onSettings(s => {
    $("[data-signup]").checked = !!s.signupOpen;
    $("[data-active]").textContent = s.activeSessionId ? "The link opens the session that’s open for students now." : "No session is open right now, so the link shows “No test is open”.";
  });
  return () => { offU(); offS(); };
}
