// Instructor page: login, then three tabs.
//   #/live            the most recent session
//   #/sessions        every session, newest first   (#/session/<id> for one)
//   #/questions       question sets                 (#/questions/<id> to edit one)
import { APP_TITLE } from "../config.js";
import { openStore } from "../store/index.js";
import { el, esc } from "../lib/util.js";
import { showAdminLogin } from "./login.js";
import * as live from "./session-view.js";
import * as sessions from "./sessions.js";
import * as sets from "./sets.js";
import * as editor from "./set-editor.js";

const ctx = { store: null, user: null, settings: {}, go: hash => { location.hash = hash; } };
let cleanup = null, settingsSubs = new Set(), creating = null;
ctx.onSettings = fn => { settingsSubs.add(fn); fn(ctx.settings); return () => settingsSubs.delete(fn); };
ctx.studentLink = sid => new URL("index.html" + (sid ? "?s=" + sid : ""), location.href).href;
let current = "";

async function boot() {
  document.title = `Instructor · ${APP_TITLE}`;
  el("brand").innerHTML = `${esc(APP_TITLE)} <span>·</span> Instructor`;
  try { ctx.store = await openStore("admin"); }
  catch (e) { el("gateSheet").innerHTML = `<h1>Can’t load</h1><p>Check the internet connection and refresh.</p><p class="note">${esc(e.message)}</p>`; return; }
  const store = ctx.store;
  el("demoBar").hidden = store.mode !== "demo";
  el("resetDemo").addEventListener("click", () => { if (confirm("Delete all demo data and start again?")) { store.resetDemo(); location.reload(); } });
  el("signOut").addEventListener("click", () => store.signOut());
  ctx.createOwner = (...a) => { creating = store.adminCreateOwner(...a); return creating.finally(() => { creating = null; }); };
  store.onAuth(async u => {
    if (creating) { try { await creating; } catch {} }
    ctx.user = u;
    if (!u) { stop(); el("nav").hidden = true; el("signOut").hidden = true; el("who").textContent = ""; showAdminLogin(ctx); return; }
    let ok = false;
    try { ok = await store.isAdmin(u.uid); } catch {}
    if (!ok) {
      el("gate").hidden = false;
      el("gateSheet").innerHTML = `<h1>Not an instructor</h1><p>${esc(u.email || "This account")} isn’t an instructor account.</p><p class="note">Students don’t log in: they use each session’s link. Another instructor can be added in Firebase (see README.md).</p><button class="btn ghost" id="outBtn" type="button">Sign out</button>`;
      el("outBtn").addEventListener("click", () => store.signOut());
      return;
    }
    el("gate").hidden = true;
    el("nav").hidden = false; el("signOut").hidden = false; el("who").textContent = u.email || "";
    if (!ctx.unwatchSettings) ctx.unwatchSettings = store.watchSettings(s => { ctx.settings = s || {}; settingsSubs.forEach(fn => fn(ctx.settings)); });
    route();
  });
  addEventListener("hashchange", route);
}

function stop() { if (cleanup) { try { cleanup(); } catch {} cleanup = null; } el("view").innerHTML = ""; }

function route() {
  if (!ctx.user) return;
  // unsaved question changes: ask first, and stay if they say no
  if (current && location.hash !== current && editor.leaveGuard && !editor.leaveGuard()) { history.replaceState(null, "", current); return; }
  current = location.hash;
  const h = location.hash.replace(/^#\/?/, "") || "live";
  const [page, id] = h.split("/");
  stop();
  document.querySelectorAll("#nav [data-tab]").forEach(a => a.classList.toggle("on", a.dataset.tab === (page === "session" ? "sessions" : page)));
  const view = el("view");
  if (page === "sessions") cleanup = sessions.mount(view, ctx);
  else if (page === "session" && id) cleanup = live.mount(view, ctx, id);
  else if (page === "questions" && id) cleanup = editor.mount(view, ctx, id);
  else if (page === "questions") cleanup = sets.mount(view, ctx);
  else cleanup = live.mountActive(view, ctx);
  scrollTo(0, 0);
}

boot();
