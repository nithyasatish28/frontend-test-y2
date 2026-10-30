// Small helpers shared by every page.

export const el = id => document.getElementById(id);
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const sleep = (ms = 0) => new Promise(r => setTimeout(r, ms));

export const fmtPts = n => (Math.round(Number(n || 0) * 10) / 10).toString();
export const mmss = ms => { const t = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(t / 60), s = t % 60; return `${m}:${String(s).padStart(2, "0")}`; };
export const clock = t => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
export const dateTime = t => new Date(t).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
export const day = t => new Date(t).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });

export const uid = (n = 12) => {
  const a = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(bytes, b => a[b % a.length]).join("");
};

// "Priya  Rao" → "priya-rao". Keeps letters from any script.
export const nameKey = name => String(name).normalize("NFKC").toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 60);

export function debounce(fn, ms) {
  let t = null;
  const d = (...a) => { clearTimeout(t); t = setTimeout(() => { t = null; fn(...a); }, ms); };
  d.flush = (...a) => { clearTimeout(t); t = null; fn(...a); };
  d.cancel = () => { clearTimeout(t); t = null; };
  return d;
}

// Buttons that change things for everyone need a second click.
export function confirmClick(btn, run, armedText = "Click again to confirm") {
  if (btn.dataset.armed) {
    delete btn.dataset.armed; btn.classList.remove("armed"); btn.textContent = btn.dataset.label; run(); return;
  }
  btn.dataset.label = btn.textContent; btn.dataset.armed = "1"; btn.classList.add("armed"); btn.textContent = armedText;
  setTimeout(() => { if (btn.dataset.armed) { delete btn.dataset.armed; btn.classList.remove("armed"); btn.textContent = btn.dataset.label; } }, 4000);
}

export function download(name, text, type = "text/plain") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export const csvLine = vals => vals.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");

export function toast(text, kind = "") {
  let box = document.getElementById("toasts");
  if (!box) { box = document.createElement("div"); box.id = "toasts"; box.className = "toasts"; box.setAttribute("aria-live", "polite"); document.body.append(box); }
  const t = document.createElement("div");
  t.className = "toast " + kind; t.textContent = text; box.append(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 300); }, kind === "err" ? 6000 : 3200);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const t = document.createElement("textarea"); t.value = text; document.body.append(t); t.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch {} t.remove(); return ok;
  }
}

export function deepEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every(k => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}

// How a value looks in the console.
export function fmt(v, top) {
  if (typeof v === "string") return top ? v : JSON.stringify(v);
  if (v === undefined) return "undefined";
  if (v === null) return "null";
  if (typeof v === "function") return `function ${v.name || ""}()`;
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  if (Array.isArray(v)) return "[" + v.slice(0, 40).map(x => fmt(x)).join(", ") + (v.length > 40 ? ", …" : "") + "]";
  if (typeof v === "object") { try { return "{ " + Object.entries(v).slice(0, 20).map(([k, x]) => `${k}: ${fmt(x)}`).join(", ") + " }"; } catch { return String(v); } }
  return String(v);
}
