// Student page: log in → find the open session → waiting room → test.
//   index.html            opens the session the instructor marked as open
//   index.html?s=<id>     opens that session (the link shown on the admin page)
import { APP_TITLE } from "../config.js";
import { openStore } from "../store/index.js";
import { el, esc } from "../lib/util.js";
import { showGate, gateMessage } from "./gate.js";
import { showLogin } from "./login.js";
import { Test } from "./test.js";

const urlSid = new URLSearchParams(location.search).get("s");
let store, me = null, profile = null, settings = {}, sid = null, test = null, unwatchSession = null, login = null, signup = null;

async function boot() {
  document.title = APP_TITLE;
  el("brand").innerHTML = esc(APP_TITLE);
  el("gateTitle").textContent = APP_TITLE;
  try { store = await openStore("student"); }
  catch (e) { gateMessage("Can’t load the test", `Check the internet connection and refresh the page.<br><span class="note">${esc(e.message)}</span>`); return; }
  el("demoBar").hidden = store.mode !== "demo";
  if (!window.React || !window.Babel) { const b = el("banner"); b.hidden = false; b.textContent = "Some parts of the test didn’t load. Check your internet connection and refresh the page."; }
  el("signOutTop").addEventListener("click", signOut);
  store.watchSettings(s => {
    settings = s || {};
    login && login.setSignupOpen(!!settings.signupOpen);
    if (profile && !urlSid) pickSession();
  });
  store.onAuth(onAuth);
}

async function onAuth(u) {
  if (signup) { try { await signup; } catch {} }
  me = u;
  if (!u) { profile = null; leaveSession(); showLoginScreen(); return; }
  login = null;
  showGate(`<h1>${esc(APP_TITLE)}</h1><p class="note">Loading your account…</p>`);
  try { profile = await store.getUser(u.uid); } catch (e) { profile = null; }
  if (!profile) return gateMessage("Not a student account", "This account can’t take tests. If you’re the instructor, use the admin page.", { onSignOut: signOut });
  if (profile.disabled) return gateMessage("Account switched off", "Your instructor has switched this account off. If you forgot your password, ask them to free your name, then create a new account.", { name: profile.name, onSignOut: signOut });
  el("who").textContent = profile.name;
  el("signOutTop").hidden = false;
  pickSession();
}

function showLoginScreen() {
  el("who").textContent = ""; el("signOutTop").hidden = true;
  login = showLogin({
    store, title: APP_TITLE, signupOpen: !!settings.signupOpen,
    onSignUp: (name, pw) => { signup = store.studentSignUp(name, pw); return signup.finally(() => { signup = null; }); },
  });
}

async function signOut() {
  if (test && test.dirty) { try { await test.send(); } catch {} }
  leaveSession();
  await store.signOut();
}

function pickSession() {
  const want = urlSid || settings.activeSessionId || null;
  if (want === sid && (test || !want)) { if (!want) noSession(); return; }
  leaveSession();
  sid = want;
  if (!sid) return noSession();
  showGate(`<h1>${esc(APP_TITLE)}</h1><p class="note">Opening the test…</p>`);
  let latest = null;
  unwatchSession = store.watchSession(sid, (s, err) => {
    if (err) return gateMessage("Can’t open the test", esc(err.message), { name: profile?.name, onSignOut: signOut });
    if (!s) { if (test) { test.stop(); test = null; } return gateMessage("This test link doesn’t work", "The session was deleted, or the link is wrong. Ask your instructor for the link.", { name: profile?.name, onSignOut: signOut }); }
    document.title = `${s.title || "Test"} · ${APP_TITLE}`;
    latest = s;
    if (!test) {
      const t = test = new Test({ store, sid, user: { uid: me.uid, name: profile.name }, onSignOut: signOut });
      t.start().then(() => { if (test === t) t.setSession(latest); });
      return;
    }
    if (test.A) test.setSession(s);
  });
}

function noSession() {
  gateMessage(APP_TITLE, "No test is open right now. When your instructor opens one, it appears here by itself.", {
    name: profile?.name, onSignOut: signOut,
    extra: `<div class="dots" aria-hidden="true"><i></i><i></i><i></i></div>`,
  });
}

function leaveSession() {
  unwatchSession && unwatchSession(); unwatchSession = null;
  if (test) { test.stop(); test = null; }
  sid = null;
}

boot();
