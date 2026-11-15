// Instructor login, signing up, and the one-time setup of the very first account.
//
// How someone becomes an instructor:
//   1. they sign up with their work email — anyone can make an account, it is worth nothing yet
//   2. they click the link in the verification email, so only the owner of that mailbox gets in
//   3. an instructor already here approves them (Instructors tab)
// Steps 1 and 2 are checked again in firestore.rules — the domain test in this file is only
// there to give a clear message. A check in the page alone could be walked around.
import { el, esc } from "../lib/util.js";
import { APP_TITLE, INSTRUCTOR_EMAIL_DOMAIN } from "../config.js";

const AT = "@" + INSTRUCTOR_EMAIL_DOMAIN.toLowerCase();
export const isWorkEmail = e => {
  const v = String(e || "").trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+$/.test(v) && v.endsWith(AT);
};

const sheet = html => {
  el("gate").hidden = false;
  const s = el("gateSheet");
  s.className = "sheet";
  s.innerHTML = html;
  return s;
};
const field = (name, label, type, extra = "") =>
  `<label class="field"><span>${label}</span><input name="${name}" type="${type}" ${extra} required></label>`;

/* ─────────── Not signed in: log in, sign up, or set up the first account ─────────── */
export async function showAdminLogin(ctx) {
  const { store } = ctx;
  let hasOwner = true;
  try { hasOwner = await store.hasOwner(); }
  catch (e) { sheet(`<h1>Can’t reach the database</h1><p>${esc(e.message)}</p>`); return; }
  hasOwner ? form(ctx, "login") : form(ctx, "setup");
}

function form(ctx, mode) {
  const { store } = ctx;
  const setup = mode === "setup", signup = mode === "signup";
  const newAccount = setup || signup;
  const s = sheet(`
    <h1>${setup ? "Set up" : signup ? "Create an instructor account" : "Instructor login"}</h1>
    <p class="note" style="margin-top:0">${
      setup ? `Welcome to ${esc(APP_TITLE)}. The first account is yours, and it becomes an instructor straight away. Use your work email.`
      : signup ? `Use your <b>${esc(INSTRUCTOR_EMAIL_DOMAIN)}</b> email. You’ll confirm it by email, then an instructor already here lets you in.`
      : "Students don’t log in here. They use the student link."}</p>
    <form novalidate>
      ${newAccount ? field("who", "Your name", "text", 'autocomplete="name" maxlength="60"') : ""}
      ${field("email", newAccount ? `Work email (ends with ${esc(AT)})` : "Email", "email", 'autocomplete="email"')}
      ${field("pw", "Password", "password", `autocomplete="${newAccount ? "new-password" : "current-password"}"`)}
      ${newAccount ? field("pw2", "Type the password again", "password", 'autocomplete="new-password"') : ""}
      <p class="err" data-err></p>
      <div class="actions">
        <button class="btn" type="submit">${setup ? "Create the instructor account" : signup ? "Sign up" : "Log in"}</button>
        ${mode === "login" ? `<button class="linkbtn" type="button" data-forgot>Forgot the password?</button>` : ""}
      </div>
      ${mode === "login" ? `<p class="note" style="margin:10px 0 0">New here? <button class="linkbtn" type="button" data-signup>Create an instructor account</button></p>`
        : signup ? `<p class="note" style="margin:10px 0 0">Already have one? <button class="linkbtn" type="button" data-login>Log in</button></p>` : ""}
    </form>`);
  const f = s.querySelector("form"), err = s.querySelector("[data-err]"), go = f.querySelector('[type="submit"]');
  (newAccount ? f.who : f.email).focus();
  const say = (msg, good) => { err.style.color = good ? "var(--good)" : ""; err.innerHTML = msg; };

  s.querySelector("[data-signup]")?.addEventListener("click", () => form(ctx, "signup"));
  s.querySelector("[data-login]")?.addEventListener("click", () => form(ctx, "login"));
  s.querySelector("[data-forgot]")?.addEventListener("click", async () => {
    if (!f.email.value.trim()) { say("Type your email first, then press “Forgot the password?” again."); return; }
    try { await store.adminResetPassword(f.email.value); say("Sent. Check your email for a link to set a new password.", true); }
    catch (e) { say(esc(e.message)); }
  });

  f.addEventListener("submit", async e => {
    e.preventDefault(); say("");
    const email = f.email.value.trim(), pw = f.pw.value;
    if (newAccount) {
      if (!f.who.value.trim()) { say("Type your name."); f.who.focus(); return; }
      if (!isWorkEmail(email)) { say(`Use your work email: it has to end with <b>${esc(AT)}</b>.`); f.email.focus(); return; }
      if (pw.length < 8) { say("Use a password with at least 8 characters."); return; }
      if (pw !== f.pw2.value) { say("The two passwords are different."); return; }
    } else if (!/^\S+@\S+\.\S+$/.test(email)) { say("Type your email address."); return; }
    go.disabled = true;
    // The name is kept here, so the next screen can offer it without asking again.
    if (newAccount) ctx.pendingName = f.who.value.trim();
    try {
      if (newAccount) await store.adminSignUp(email, pw);     // signs them in; app.js takes over
      else await store.adminSignIn(email, pw);
    } catch (ex) { say(esc(ex.message)); go.disabled = false; }
  });
}

/* ─────────── Signed in, but not an instructor yet ─────────── */
// Three states: confirm the email · ask to be let in · wait for an instructor.
export async function showAccessGate(ctx, user) {
  const { store } = ctx;
  const out = `<div class="gate-foot"><span class="note">Signed in as <b>${esc(user.email || "")}</b></span><button class="linkbtn" data-out type="button">Sign out</button></div>`;
  const wire = s => s.querySelector("[data-out]").addEventListener("click", () => store.signOut());

  // Someone with a personal address: there is nothing for them here, and the rules agree.
  if (!isWorkEmail(user.email)) {
    wire(sheet(`<h1>Not a work email</h1>
      <p>Instructor accounts have to use a <b>${esc(INSTRUCTOR_EMAIL_DOMAIN)}</b> address. <b>${esc(user.email || "This account")}</b> can’t be made an instructor.</p>
      <p class="note">Students don’t log in at all — they use the link for their test.</p>${out}`));
    return;
  }

  if (!user.emailVerified) { verify(ctx, user, out, wire); return; }

  let req = null;
  try { req = await store.getRequest(user.uid); } catch {}
  req ? waiting(ctx, user, req, out, wire) : ask(ctx, user, out, wire);
}

function verify(ctx, user, out, wire) {
  const { store } = ctx;
  const s = sheet(`<h1>Confirm your email</h1>
    <p>We’ve sent a link to <b>${esc(user.email)}</b>. Open it, then come back here and press the button.</p>
    <p class="err" data-err></p>
    <div class="actions">
      <button class="btn" data-done type="button">I’ve done that</button>
      <button class="btn ghost" data-again type="button">Send it again</button>
    </div>
    <p class="note">Nothing in your inbox? Look in spam. The link can take a minute to arrive.</p>${out}`);
  wire(s);
  const err = s.querySelector("[data-err]"), say = (m, good) => { err.style.color = good ? "var(--good)" : ""; err.textContent = m; };
  s.querySelector("[data-again]").addEventListener("click", async e => {
    e.currentTarget.disabled = true;
    try { await store.resendVerification(); say("Sent. Check your inbox.", true); }
    catch (ex) { say(ex.message); }
    e.currentTarget.disabled = false;
  });
  s.querySelector("[data-done]").addEventListener("click", async e => {
    e.currentTarget.disabled = true; say("");
    try {
      const fresh = await store.refreshUser();
      if (fresh?.emailVerified) { ctx.user = fresh; return showAccessGate(ctx, fresh); }
      say("That email isn’t confirmed yet. Open the link, then press this again.");
    } catch (ex) { say(ex.message); }
    e.currentTarget.disabled = false;
  });
}

function ask(ctx, user, out, wire) {
  const { store } = ctx;
  const first = !ctx.ownerExists;
  const s = sheet(`<h1>${first ? "You’re the first" : "Ask to be let in"}</h1>
    <p>${first
      ? `No instructor account exists yet, so this one becomes the instructor.`
      : `Your email is confirmed. An instructor already using ${esc(APP_TITLE)} has to let you in — they’ll see your name and email.`}</p>
    <form novalidate>
      <label class="field"><span>Your name</span><input name="who" autocomplete="name" maxlength="60" value="${esc(ctx.pendingName || "")}" required></label>
      <p class="err" data-err></p>
      <button class="btn" type="submit">${first ? "Become the instructor" : "Ask to be let in"}</button>
    </form>${out}`);
  wire(s);
  const f = s.querySelector("form"), err = s.querySelector("[data-err]"), go = f.querySelector('[type="submit"]');
  f.who.focus();
  f.addEventListener("submit", async e => {
    e.preventDefault(); err.textContent = "";
    const name = f.who.value.trim();
    if (!name) { err.textContent = "Type your name."; return; }
    go.disabled = true;
    try {
      if (first) { await ctx.createOwner(name); ctx.recheck(); return; }
      await store.requestAccess(name);
      showAccessGate(ctx, user);
    } catch (ex) {
      // Two people can reach "you're the first" at the same time; only one wins. The loser
      // isn't stuck — they just ask to be let in like everyone else.
      if (first) {
        try { ctx.ownerExists = await store.hasOwner(); } catch {}
        if (ctx.ownerExists) { ctx.pendingName = name; return showAccessGate(ctx, user); }
      }
      err.textContent = ex.message; go.disabled = false;
    }
  });
}

function waiting(ctx, user, req, out, wire) {
  const { store } = ctx;
  const s = sheet(`<h1>Waiting to be let in</h1>
    <p>You asked on ${esc(new Date(req.askedAt || Date.now()).toLocaleString())}. An instructor will see your request and let you in — this page opens by itself when they do.</p>
    <p class="note">Nothing you can do here until then. You can close the tab.</p>
    <div class="actions"><button class="btn ghost" data-cancel type="button">Take back my request</button></div>${out}`);
  wire(s);
  // The request disappearing means it was dealt with, one way or the other.
  const off = store.watchRequest(user.uid, doc => { if (!doc) { off(); ctx.recheck(); } });
  ctx.onGateLeave = off;
  s.querySelector("[data-cancel]").addEventListener("click", async e => {
    e.currentTarget.disabled = true;
    off();
    try { await store.cancelRequest(user.uid); showAccessGate(ctx, user); }
    catch (ex) { e.currentTarget.disabled = false; }
  });
}
