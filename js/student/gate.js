// The full-screen card shown before the test: loading, login, waiting room, messages.
import { el, esc } from "../lib/util.js";

export function showGate(html, { wide = false } = {}) {
  el("gate").hidden = false;
  const s = el("gateSheet");
  s.className = "sheet" + (wide ? " wide" : "");
  s.innerHTML = html;
  return s;
}
export const hideGate = () => { el("gate").hidden = true; };

// A simple message with an optional sign-out link.
export function gateMessage(title, text, { name, onSignOut, extra = "" } = {}) {
  const s = showGate(`
    <h1>${esc(title)}</h1>
    <p>${text}</p>
    ${extra}
    ${onSignOut ? `<div class="gate-foot"><span class="note">${name ? `Joined as <b>${esc(name)}</b>` : ""}</span><button class="linkbtn" data-signout type="button">Not you? Start again</button></div>` : ""}`);
  s.querySelector("[data-signout]")?.addEventListener("click", onSignOut);
  return s;
}
