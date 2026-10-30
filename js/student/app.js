// Student page. Every session has its own link: index.html?s=<session id>.
// Open the link → type your name → waiting room → test. The link closes 10 minutes after the test ends.
import { APP_TITLE } from "../config.js";
import { openStore } from "../store/index.js";
import { el, esc } from "../lib/util.js";
import { showGate, gateMessage } from "./gate.js";
import { showJoin } from "./join.js";
import { Test } from "./test.js";

const sid = new URLSearchParams(location.search).get("s");
let store, me = null, test = null, latest = null, unwatch = null, deciding = false, signingIn = false;

async function boot() {
  document.title = APP_TITLE;
  el("brand").innerHTML = esc(APP_TITLE);
  el("gateTitle").textContent = APP_TITLE;
  if (!sid) { gateMessage(APP_TITLE, "Open the test link your instructor shared with you. Every test has its own link."); return; }
  try { store = await openStore("student"); }
  catch (e) { gateMessage("Can’t load the test", `Check the internet connection and refresh the page.<br><span class="note">${esc(e.message)}</span>`); return; }
  el("demoBar").hidden = store.mode !== "demo";
  if (!window.React || !window.Babel) { const b = el("banner"); b.hidden = false; b.textContent = "Some parts of the test didn’t load. Check your internet connection and refresh the page."; }
  showGate(`<h1>${esc(APP_TITLE)}</h1><p class="note">Opening the test…</p>`);
  store.onAuth(onAuth);
}

// Every visitor gets a nameless login first; it's what keeps each student to their own answers.
async function onAuth(u) {
  if (!u) {
    if (signingIn) return;
    signingIn = true;
    try { await store.studentSignIn(); }
    catch (e) { gateMessage("Can’t open the test", esc(e.message)); }
    signingIn = false;
    return;
  }
  if (me && me.uid === u.uid) return;
  me = u;
  leave();
  unwatch = store.watchSession(sid, onSession);
}

const ended = s => s.status === "ended" || (s.startAt && store.serverNow() >= s.startAt + s.minutes * 60000);
const closed = saved => gateMessage("This test link is closed",
  `The test has ended, so this link doesn’t open it any more.${saved ? " Your answers were saved." : ""}<br><span class="note">If you think this is a mistake, ask your instructor.</span>`);

function onSession(s, err) {
  if (err || !s) {
    if (test && test.A && test.A.status === "submitted") return;      // keep showing their score
    leave();
    return closed(false);
  }
  latest = s;
  document.title = `${s.title || "Test"} · ${APP_TITLE}`;
  if (test) { if (test.A) test.setSession(s); return; }
  if (!deciding) { deciding = true; decide().finally(() => (deciding = false)); }
}

async function decide() {
  let attempt = null;
  try { attempt = await store.getAttempt(sid, me.uid); } catch {}
  if (ended(latest)) return closed(!!attempt);
  if (attempt && attempt.name) return startTest(attempt.name);        // came back on the same computer
  showJoin(latest, name => startTest(name));
}

async function startTest(name) {
  el("who").textContent = name;
  const t = test = new Test({ store, sid, user: { uid: me.uid, name }, onSignOut: startOver });
  await t.start();
  if (test === t) t.setSession(latest);
}

// "Not you?" before the test starts: drop this entry and start with a new name.
async function startOver() {
  const drop = test && test.A && test.A.status === "waiting" && test.onServer;
  leave();                                         // stop first, or the test would re-join when its entry disappears
  if (drop) { try { await store.deleteAttempt(sid, me.uid); } catch {} }
  el("who").textContent = "";
  me = null;
  await store.signOut();
}

function leave() {
  if (test) { test.stop(); test = null; }
  if (unwatch) { unwatch(); unwatch = null; }
}

boot();
