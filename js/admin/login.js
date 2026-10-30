// Instructor login, and the one-time setup of the first instructor account.
import { el, esc } from "../lib/util.js";
import { APP_TITLE } from "../config.js";

export async function showAdminLogin(ctx) {
  const { store } = ctx;
  el("gate").hidden = false;
  const sheet = el("gateSheet");
  sheet.className = "sheet";
  let hasOwner = true;
  try { hasOwner = await store.hasOwner(); } catch (e) { sheet.innerHTML = `<h1>Can’t reach the database</h1><p>${esc(e.message)}</p>`; return; }
  const setup = !hasOwner;
  sheet.innerHTML = `
    <h1>${setup ? "Set up" : "Instructor login"}</h1>
    <p class="note" style="margin-top:0">${setup
      ? `Welcome to ${esc(APP_TITLE)}. Create the instructor account. This page works only once: after this, new instructor accounts can’t be made here.`
      : "Students don’t log in here. They use the student link."}</p>
    <form novalidate>
      ${setup ? `<label class="field"><span>Your name</span><input name="who" autocomplete="name" required></label>` : ""}
      <label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" required></label>
      <label class="field"><span>Password</span><input name="pw" type="password" autocomplete="${setup ? "new-password" : "current-password"}" required></label>
      ${setup ? `<label class="field"><span>Type the password again</span><input name="pw2" type="password" autocomplete="new-password"></label>` : ""}
      <p class="err" data-err></p>
      <div class="actions">
        <button class="btn" type="submit">${setup ? "Create the instructor account" : "Log in"}</button>
        ${setup ? "" : `<button class="linkbtn" type="button" data-forgot>Forgot the password?</button>`}
      </div>
    </form>`;
  const f = sheet.querySelector("form"), err = sheet.querySelector("[data-err]"), go = f.querySelector('[type="submit"]');
  f.email.focus();
  sheet.querySelector("[data-forgot]")?.addEventListener("click", async () => {
    if (!f.email.value.trim()) { err.textContent = "Type your email first, then press “Forgot the password?” again."; return; }
    try { await store.adminResetPassword(f.email.value); err.style.color = "var(--good)"; err.textContent = "Sent. Check your email for a link to set a new password."; }
    catch (e) { err.style.color = ""; err.textContent = e.message; }
  });
  f.addEventListener("submit", async e => {
    e.preventDefault(); err.style.color = ""; err.textContent = "";
    const email = f.email.value.trim(), pw = f.pw.value;
    if (!/^\S+@\S+\.\S+$/.test(email)) { err.textContent = "Type your email address."; return; }
    if (setup) {
      if (!f.who.value.trim()) { err.textContent = "Type your name."; return; }
      if (pw.length < 8) { err.textContent = "Use a password with at least 8 characters."; return; }
      if (pw !== f.pw2.value) { err.textContent = "The two passwords are different."; return; }
    }
    go.disabled = true;
    try {
      if (setup) await ctx.createOwner(email, pw, f.who.value.trim());
      else await store.adminSignIn(email, pw);
    } catch (ex) { err.textContent = ex.message; go.disabled = false; }
  });
}
