// A modal dialog. Buttons with data-close="value" close it; the promise gives that value back.
export function dialog(html, { wide = false } = {}) {
  const d = document.createElement("dialog");
  d.className = "dlg" + (wide ? " wide" : "");
  d.innerHTML = html;
  document.body.append(d);
  let resolve;
  const done = new Promise(r => (resolve = r));
  const close = v => { if (d.open) d.close(); d.remove(); resolve(v); };
  d.addEventListener("click", e => {
    const b = e.target.closest("[data-close]");
    if (b) { e.preventDefault(); close(b.dataset.close || null); }
    if (e.target === d) close(null);           // click on the backdrop
  });
  d.addEventListener("cancel", e => { e.preventDefault(); close(null); });
  d.showModal();
  return { el: d, close, done };
}
