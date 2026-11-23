// Instructor page: login, then three tabs.
//   #/live            the most recent session
//   #/sessions        every session, newest first   (#/session/<id> for one)
//   #/questions       question sets                 (#/questions/<id> to edit one)
//   #/instructors     who can get in, and who is waiting
import { APP_TITLE } from "../config.js";
import { openStore } from "../store/index.js";
import { el, esc } from "../lib/util.js";
import { showAdminLogin, showAccessGate } from "./login.js";
import * as live from "./session-view.js";
import * as sessions from "./sessions.js";
import * as sets from "./sets.js";
import * as editor from "./set-editor.js";
import * as instructors from "./instructors.js";

const ctx = { store: null, user: null, settings: {}, go: hash => { location.hash = hash; } };
let cleanup = null, settingsSubs = new Set(), creating = null;
ctx.onSettings = fn => { settingsSubs.add(fn); fn(ctx.settings); return () => settingsSubs.delete(fn); };
// In demo mode the link has to say so too, or the student page would look for the real
// Firebase project instead of this browser's demo data.
// null means "everything", and only the super admin may ask for that.
ctx.scope = () => (ctx.role === "super" ? null : ctx.user?.uid || "__nobody__");
ctx.studentLink = sid => {
  const u = new URL("test.html" + (sid ? "?s=" + sid : ""), location.href);
  if (ctx.store && ctx.store.mode === "demo") u.searchParams.set("demo", "1");
  return u.href;
};
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
  ctx.ownerExists = true;
  async function evaluate(u) {
    if (creating) { try { await creating; } catch {} }
    ctx.user = u;
    if (ctx.onGateLeave) { try { ctx.onGateLeave(); } catch {} ctx.onGateLeave = null; }
    if (!u) { stop(); el("nav").hidden = true; el("signOut").hidden = true; el("who").textContent = ""; showAdminLogin(ctx); return; }
    let ok = false;
    try { ctx.role = await store.adminRole(u.uid); ok = !!ctx.role; } catch { ctx.role = null; }
    if (!ok) {
      // Signed in, but not an instructor: confirm the email, ask to be let in, or wait.
      stop(); el("nav").hidden = true; el("signOut").hidden = true; el("who").textContent = "";
      try { ctx.ownerExists = await store.hasOwner(); } catch { ctx.ownerExists = true; }
      showAccessGate(ctx, u);
      return;
    }
    el("gate").hidden = true;
    el("nav").hidden = false; el("signOut").hidden = false; el("who").textContent = u.email || "";
    // Only the super admin gets the Instructors tab; everyone else never sees the roster.
    el("tabInstructors").hidden = ctx.role !== "super";
    if (ctx.ownerUid === undefined) { try { ctx.ownerUid = await store.ownerUid(); } catch { ctx.ownerUid = null; } }
    if (!ctx.unwatchSettings) ctx.unwatchSettings = store.watchSettings(s => { ctx.settings = s || {}; settingsSubs.forEach(fn => fn(ctx.settings)); }, u.uid);
    // Only the super admin can read the request list, so only they get the count.
    if (ctx.role === "super" && !ctx.unwatchPending) ctx.unwatchPending = store.watchRequests(list => {
      const n = (list || []).length, b = el("pendingCount");
      b.hidden = !n; b.textContent = n || "";
    });
    route();
  }
  ctx.recheck = () => evaluate(ctx.user);
  store.onAuth(evaluate);
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
  else if (page === "instructors") {
    // Typing the address by hand doesn't get an ordinary instructor in either.
    if (ctx.role !== "super") { ctx.go("#/live"); return; }
    cleanup = instructors.mount(view, ctx);
  }
  else cleanup = live.mountActive(view, ctx);
  scrollTo(0, 0);
}

boot();
