// Log in / create an account with just a name and a password.
import { esc } from "../lib/util.js";
import { showGate } from "./gate.js";

export function showLogin({ store, title, signupOpen, sessionTitle, onSignUp }) {
  let mode = "login";
  const s = showGate(`
    <h1>${esc(title)}</h1>
    <p class="note" style="margin-top:0">${sessionTitle ? `Test: <b>${esc(sessionTitle)}</b>. ` : ""}Log in with your name and password.</p>
    <div class="seg" role="group" aria-label="Log in or create an account">
      <button type="button" data-mode="login" aria-pressed="true">Log in</button>
      <button type="button" data-mode="signup" aria-pressed="false">New here? Create an account</button>
    </div>
    <form novalidate>
      <label class="field"><span>Your full name</span><input name="fullname" autocomplete="username" maxlength="60" placeholder="e.g. Priya Rao" required></label>
      <label class="field"><span>Password</span><input name="pw" type="password" autocomplete="current-password" required></label>
      <label class="field" data-only="signup" hidden><span>Type the password again</span><input name="pw2" type="password" autocomplete="new-password"></label>
      <p class="note" data-only="signup" hidden>Use at least 6 characters, and remember it: you’ll need it to log in next time. Use the name your instructor knows you by.</p>
      <p class="note" data-closed hidden>New accounts are closed right now. If you don’t have an account yet, ask your instructor.</p>
      <p class="err" data-err></p>
      <button class="btn" type="submit" data-go>Log in</button>
    </form>`);
  const form = s.querySelector("form"), err = s.querySelector("[data-err]"), go = s.querySelector("[data-go]");
  const setMode = m => {
    mode = m;
    s.querySelectorAll("[data-mode]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === m)));
    s.querySelectorAll('[data-only="signup"]').forEach(x => (x.hidden = m !== "signup"));
    s.querySelector("[data-closed]").hidden = !(m === "signup" && !signupOpen);
    form.pw.autocomplete = m === "signup" ? "new-password" : "current-password";
    go.textContent = m === "signup" ? "Create my account" : "Log in";
    go.disabled = m === "signup" && !signupOpen;
    err.textContent = "";
  };
  s.querySelectorAll("[data-mode]").forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const name = form.fullname.value.trim().replace(/\s+/g, " "), pw = form.pw.value;
    if (name.length < 2) { err.textContent = "Type your full name."; form.fullname.focus(); return; }
    if (!pw) { err.textContent = "Type your password."; form.pw.focus(); return; }
    if (mode === "signup") {
      if (pw.length < 6) { err.textContent = "Use a password with at least 6 characters."; return; }
      if (pw !== form.pw2.value) { err.textContent = "The two passwords are different. Type them again."; return; }
    }
    go.disabled = true; err.textContent = ""; go.textContent = mode === "signup" ? "Creating…" : "Logging in…";
    try {
      if (mode === "signup") await onSignUp(name, pw);
      else await store.studentSignIn(name, pw);
    } catch (ex) {
      err.textContent = ex.message;
      go.disabled = false; go.textContent = mode === "signup" ? "Create my account" : "Log in";
    }
  });
  setMode("login");
  form.fullname.focus();
  return {
    setSignupOpen(open) { signupOpen = open; if (form.isConnected) setMode(mode); },
  };
}
