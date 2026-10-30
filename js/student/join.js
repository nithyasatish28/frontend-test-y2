// "Type your name" — the only thing a student does before the waiting room.
import { esc } from "../lib/util.js";
import { showGate } from "./gate.js";

export function showJoin(session, onJoin) {
  const n = (session.questions || []).length;
  const s = showGate(`
    <h1>${esc(session.title || "Test")}</h1>
    <p class="note" style="margin-top:0">${n} question${n === 1 ? "" : "s"} · ${session.minutes} minutes</p>
    <form novalidate>
      <label class="field"><span>Your full name</span><input name="fullname" autocomplete="name" maxlength="60" placeholder="e.g. Priya Rao" required></label>
      <p class="note">Use the name your instructor knows you by. If you close this tab by mistake, open the same link on this computer to carry on.</p>
      <p class="err" data-err></p>
      <button class="btn" type="submit" data-go>Join the test</button>
    </form>`);
  const form = s.querySelector("form"), err = s.querySelector("[data-err]"), go = s.querySelector("[data-go]");
  form.fullname.focus();
  form.addEventListener("submit", async e => {
    e.preventDefault();
    const name = form.fullname.value.trim().replace(/\s+/g, " ");
    if (name.length < 2) { err.textContent = "Type your full name."; form.fullname.focus(); return; }
    go.disabled = true; go.textContent = "Joining…"; err.textContent = "";
    try { await onJoin(name); }
    catch (ex) { err.textContent = ex.message; go.disabled = false; go.textContent = "Join the test"; }
  });
}
