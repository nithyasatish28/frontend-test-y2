// Brings results from the old Google Sheet version into this app, as past sessions.
// Two ways in:
//   1. straight from the old Apps Script web app (URL + admin key), like the old admin page did
//   2. from the CSV files the old admin page downloaded ("js-react-test-results-YYYY-MM-DD.csv")
// The old app always used the same 27 questions, so they're matched to the starter set's copy of them.
import { esc, uid as randomId, toast } from "../lib/util.js";
import { publishSet, stats } from "../lib/grade.js";
import { STARTER_SETS } from "../data/starter-sets.js";
import { dialog } from "./dialog.js";

const OLD_URL = "https://script.google.com/macros/s/AKfycbwqilzIa03QnpWyphshHGkC-jOVAqcQbwHQ84LRqxl3TFDMCsrGvzZjNLxpTgNoZGMqfg/exec";
const OLD_SET = STARTER_SETS[0];                              // "JS + React Test": ids a1…d7 = old A1…D7
const OLD_IDS = OLD_SET.questions.map(q => q.id.toUpperCase());

export function parseCSV(text) {
  text = text.replace(/^﻿/, "");
  const rows = []; let row = [], f = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else quoted = false; }
      else f += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim()));
}

// One old question result → this app's answer entry.
function entryFrom(oldId, code = "", raw = "") {
  const q = OLD_SET.questions.find(x => x.id === oldId.toLowerCase());
  if (!q) return null;
  let body = "", checks = "";
  if (raw && typeof raw === "object") { body = String(raw.a || ""); checks = String(raw.n || ""); }
  else if (raw) {
    const m = String(raw).match(/^(✓|✗)?\s?(\d+\/\d+)?\s?(\(hint\))?\s*([\s\S]*)$/) || [];
    checks = m[2] || ""; body = (m[4] || "").trim();
    if (!code) code = (m[1] === "✓" ? "c" : m[1] === "✗" ? (q.type === "code" ? "p" : "w") : "") + (m[3] ? "h" : "");
  }
  code = String(code || "").trim();
  if (!code && !body) return null;
  const e = { s: code[0] === "c" ? "c" : code[0] === "w" ? "w" : null, h: code.includes("h") };
  if (q.type === "mcq" && body) { const i = "ABCDEFGH".indexOf(body[0]); if (i >= 0) e.pick = i; }
  if (q.type === "blanks" && body) e.vals = body.split(/\s+\|\s+/);
  if (q.type === "code" && (e.s || code[0] === "p" || body)) { e.checked = body; e.checks = checks; e.code = body; }
  return e;
}

function attemptFrom({ name, status, submitted, lastSeen, q = {}, answers = {} }, i, session, endMs) {
  const qmap = {};
  for (const id of OLD_IDS) { const e = entryFrom(id, q[id], answers[id]); if (e) qmap[id.toLowerCase()] = e; }
  const done = status === "submitted" || submitted === true || /^(yes|true|submitted|done)$/i.test(String(submitted || status || ""));
  const st = stats(session, qmap);
  const seen = lastSeen && !isNaN(Date.parse(lastSeen)) ? Date.parse(lastSeen) : endMs;
  const uid = "old-" + (String(name || "student").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 30) || "student") + "-" + i;
  return {
    uid, name: String(name || `Student ${i + 1}`).trim(), status: done ? "submitted" : status === "waiting" ? "waiting" : "working",
    q: qmap, score: st.score, correct: st.correct, hints: st.hints, done: st.done, total: st.total,
    lastSeen: seen, joinedAt: seen, ...(done ? { finishedAt: seen } : {}), t: seen, imported: true,
  };
}

// The old sheet's "results" answer → { startMs, minutes, rows }
async function fromSheet(url, key) {
  const u = url + (url.includes("?") ? "&" : "?") + "action=results&key=" + encodeURIComponent(key) + "&t=" + Date.now();
  let data;
  try { data = await (await fetch(u)).json(); }
  catch { throw new Error("Couldn’t reach the old sheet. Check the URL, and that the old web app is still deployed for “Anyone”."); }
  if (!data.ok) throw new Error(data.error === "wrong key" ? "The admin key is wrong. It’s the secret word in the old Apps Script." : (data.error || "The old sheet said no."));
  const st = data.state || {};
  const startMs = st.startAt ? new Date(st.startAt).getTime() : Date.parse(data.now) || Date.now();
  return { startMs, minutes: Number(st.minutes) || 45, endMs: st.endAt ? new Date(st.endAt).getTime() : null, rows: data.rows || [] };
}

// An old CSV: Name, Status, Score, Correct, Hints, Done, Submitted, Last seen, A1 … D7
function fromCSV(text, fileName) {
  const rows = parseCSV(text);
  if (!rows.length) throw new Error(`${fileName} is empty.`);
  const head = rows[0].map(h => h.trim());
  const col = name => head.findIndex(h => h.toLowerCase() === name.toLowerCase());
  const iName = col("Name");
  if (iName === -1 || !OLD_IDS.some(id => head.includes(id))) throw new Error(`${fileName} doesn’t look like a results file from the old app (it needs a Name column and A1…D7 columns).`);
  const out = rows.slice(1).map(r => {
    const q = {};
    for (const id of OLD_IDS) { const k = head.indexOf(id); if (k !== -1) q[id] = r[k] || ""; }
    return { name: r[iName], status: (r[col("Status")] || "").toLowerCase() === "done" ? "submitted" : (r[col("Status")] || "").toLowerCase(), submitted: r[col("Submitted")], q, answers: {} };
  });
  const m = fileName.match(/(\d{4}-\d{2}-\d{2})/);
  return { dateGuess: m ? m[1] : "", rows: out };
}

export async function importOld(ctx) {
  const { store } = ctx;
  const d = dialog(`
    <div class="dlg-body">
      <h2>Import results from the old app</h2>
      <p class="note" style="margin-top:0">Each import becomes a past session here, with the same 27 questions, so you can open it like any other session.</p>
      <div class="seg" role="group"><button type="button" data-src="sheet" aria-pressed="true">From the Google Sheet</button><button type="button" data-src="csv" aria-pressed="false">From downloaded CSV files</button></div>
      <div data-pane="sheet">
        <label class="field"><span>Old Apps Script web app URL</span><input class="mono" data-url value="${esc(OLD_URL)}"></label>
        <label class="field"><span>Old admin key <small>(the secret word in the old script)</small></span><input type="password" data-key autocomplete="off"></label>
        <p class="note">The old sheet only keeps the <b>latest</b> class: pressing “New session” in the old app cleared it. Older classes come in from the CSV files you downloaded.</p>
      </div>
      <div data-pane="csv" hidden>
        <label class="field"><span>Old results files <small>(pick one or more; each becomes its own session)</small></span><input type="file" accept=".csv,text/csv" multiple data-files></label>
        <label class="field"><span>Date of the test <small>(used when the file name has no date)</small></span><input type="date" data-date></label>
        <p class="note">CSV files have each student’s score and right/wrong per question, but not the answers they typed.</p>
      </div>
      <label class="field"><span>Title <small>(optional)</small></span><input data-title placeholder="e.g. JS + React Test · Batch 2"></label>
      <p class="err" data-err></p>
      <div data-preview class="note"></div>
    </div>
    <div class="dlg-foot"><button class="btn ghost" data-close type="button">Cancel</button><button class="btn" data-go type="button">Import</button></div>`, { wide: false });
  const $ = s => d.el.querySelector(s);
  let src = "sheet";
  $("[data-date]").value = new Date().toISOString().slice(0, 10);
  d.el.querySelectorAll("[data-src]").forEach(b => b.addEventListener("click", () => {
    src = b.dataset.src;
    d.el.querySelectorAll("[data-src]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    d.el.querySelectorAll("[data-pane]").forEach(p => (p.hidden = p.dataset.pane !== src));
    $("[data-err]").textContent = "";
  }));

  const makeSession = (title, startMs, minutes, endMs, from) => {
    const salt = randomId(16);
    return {
      title, setId: null, setTitle: OLD_SET.title + " (old app)", minutes, points: 1, hintPenalty: 0.5, salt, ...publishSet(OLD_SET, salt),
      status: "ended", startAt: store.time(startMs), endAt: store.time(endMs || startMs + minutes * 60000), createdAt: store.time(startMs), imported: from,
    };
  };
  const save = async (title, startMs, minutes, endMs, rows, from) => {
    const s = makeSession(title, startMs, minutes, endMs, from);
    const end = endMs || startMs + minutes * 60000;
    const attempts = rows.filter(r => String(r.name || "").trim()).map((r, i) => attemptFrom(r, i, s, end));
    const all = attempts.map(a => stats(s, a.q));
    s.stats = { joined: attempts.length, submitted: attempts.filter(a => a.status === "submitted").length, avg: attempts.length ? Math.round(all.reduce((x, y) => x + y.score, 0) / attempts.length * 10) / 10 : 0, top: attempts.length ? Math.max(...all.map(x => x.score)) : 0 };
    const id = await store.importSession(s, attempts);
    return { id, n: attempts.length };
  };

  $("[data-go]").addEventListener("click", async e => {
    const btn = e.currentTarget, err = $("[data-err]"), title = $("[data-title]").value.trim();
    err.textContent = ""; btn.disabled = true; btn.textContent = "Importing…";
    try {
      const made = [];
      if (src === "sheet") {
        const url = $("[data-url]").value.trim(), key = $("[data-key]").value;
        if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) throw new Error("Paste the old web app URL. It starts with https://script.google.com/");
        if (!key) throw new Error("Type the old admin key.");
        const r = await fromSheet(url, key);
        if (!r.rows.length) throw new Error("The old sheet has no students in it right now.");
        const date = new Date(r.startMs).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
        made.push(await save(title || `${OLD_SET.title} · ${date} (old app)`, r.startMs, r.minutes, r.endMs, r.rows, "sheet"));
      } else {
        const files = [...$("[data-files]").files];
        if (!files.length) throw new Error("Pick at least one CSV file.");
        for (const f of files) {
          const r = fromCSV(await f.text(), f.name);
          const day = r.dateGuess || $("[data-date]").value || new Date().toISOString().slice(0, 10);
          const startMs = new Date(day + "T10:00:00").getTime();
          const date = new Date(startMs).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
          made.push(await save((title ? title + (files.length > 1 ? ` (${f.name})` : "") : `${OLD_SET.title} · ${date} (old app)`), startMs, 45, null, r.rows, "csv"));
        }
      }
      d.close("done");
      toast(made.length === 1 ? `Imported ${made[0].n} students` : `Imported ${made.length} sessions`);
      ctx.go(made.length === 1 ? "#/session/" + made[0].id : "#/sessions");
    } catch (ex) {
      err.textContent = ex.message; btn.disabled = false; btn.textContent = "Import";
    }
  });
  await d.done;
}
