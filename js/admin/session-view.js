// One session, live: start/end it, watch every student, open their answers, download results.
import { esc, fmtPts, mmss, clock, dateTime, confirmClick, download, csvLine, copyText, toast } from "../lib/util.js";
import { stats, cellCode, answerText } from "../lib/grade.js";
import { phaseOf, phasePill, newSession } from "./sessions.js";

const IDLE_MIN = 5;

// "Live" tab: the session made most recently (or picked from Sessions).
export function mountActive(view, ctx) {
  let inner = null, shown;
  const off = ctx.onSettings(s => {
    const id = s.activeSessionId || null;
    if (id === shown) return;
    shown = id;
    inner && inner(); inner = null;
    if (id) { inner = mount(view, ctx, id, true); return; }
    view.innerHTML = `
      <div class="card" style="text-align:center;padding:40px 20px">
        <h1 style="margin:0 0 6px">No session is open</h1>
        <p class="sub">Make a session from a question set. Students open the link, log in, and wait until you press Start.</p>
        <div class="actions" style="justify-content:center;margin-top:14px"><button class="btn big-btn" data-new type="button">New session</button><a class="btn ghost" href="#/sessions">See past sessions</a></div>
      </div>`;
    view.querySelector("[data-new]").addEventListener("click", () => newSession(ctx));
  });
  return () => { off(); inner && inner(); };
}

export function mount(view, ctx, sid, isLiveTab = false) {
  const { store } = ctx;
  let session = null, rows = [], openIds = new Set(), lastStats = "", statsTimer = null, pendingStats = null, attemptsLoaded = false, endingNow = false;
  view.innerHTML = `
    ${isLiveTab ? "" : `<a class="crumb" href="#/sessions">← All sessions</a>`}
    <section class="card session" data-sess>
      <div class="sess-row">
        <div>
          <div class="sess-label" data-label></div>
          <div class="sess-big" data-big></div>
          <div class="sub" data-subline></div>
        </div>
        <div class="sess-actions" data-actions></div>
      </div>
      <p class="note" data-note style="min-height:1.2em;margin:10px 0 0"></p>
      <div class="linkbox"><b>Student link</b><input readonly data-link aria-label="Student link"><button class="btn ghost small" data-copy type="button">Copy</button><a class="btn ghost small" data-open target="_blank" rel="noopener">Open</a></div>
      <p class="note" data-linknote style="margin:6px 0 0"></p>
    </section>
    <section class="tiles" data-tiles></section>
    <section class="card"><h2>Which questions are hardest</h2><div class="diff" data-diff></div>
      <div class="legend"><span>% right, out of the students who have tried it ·</span><span><i style="background:var(--bad-soft);border:1px solid #f3c3bd"></i>under 40%</span><span><i style="background:var(--hint-soft);border:1px solid #f0d6a6"></i>40–70%</span><span><i style="background:var(--good-soft);border:1px solid #b9e3c9"></i>over 70%</span></div></section>
    <section class="card">
      <div class="page-head" style="margin-bottom:8px"><h2 style="margin:0;margin-right:auto">Students</h2>
        <button class="btn ghost small" data-csv type="button">Download scores (CSV)</button><button class="btn ghost small" data-csv2 type="button">Download all answers (CSV)</button></div>
      <p class="sub" style="margin:0 0 12px">Click a student to see exactly what they answered.</p>
      <div class="tools">
        <input type="search" data-search placeholder="Search by name" aria-label="Search students">
        <select data-sort aria-label="Sort by"><option value="score">Score, high to low</option><option value="roll">Order joined</option><option value="name">Name</option><option value="seen">Last seen, oldest first</option><option value="done">Questions done, fewest first</option></select>
        <select data-filter aria-label="Show"><option value="all">Everyone</option><option value="wait">In the waiting room</option><option value="work">Still working</option><option value="idle">Idle for ${IDLE_MIN}+ minutes</option><option value="done">Submitted</option><option value="late">Not submitted (test over)</option></select>
      </div>
      <div class="legend" style="margin:0 0 10px"><span><i style="background:var(--good)"></i>correct</span><span><i style="background:var(--bad)"></i>wrong</span><span><i style="background:#b9c9e6"></i>code started</span><span><i style="background:#eef1ef"></i>not done</span><span><i style="background:var(--hint);border-radius:50%"></i>hint used</span></div>
      <div class="tablewrap"><table class="grid" data-table></table></div>
    </section>`;
  const $ = s => view.querySelector(s);
  const link = ctx.studentLink(sid);
  $("[data-link]").value = link; $("[data-open]").href = link;
  $("[data-copy]").addEventListener("click", async () => toast((await copyText(link)) ? "Link copied" : "Couldn’t copy. Select the link and copy it."));
  ["search", "sort", "filter"].forEach(k => $(`[data-${k}]`).addEventListener("input", drawStudents));
  $("[data-csv]").addEventListener("click", () => csvScores());
  $("[data-csv2]").addEventListener("click", () => csvAnswers());

  const now = () => store.serverNow();
  const minsAgo = r => (r.lastSeen ? Math.max(0, Math.round((now() - r.lastSeen) / 60000)) : null);
  const stateOf = r => {
    if (r.status === "submitted") return "done";
    if (r.status === "waiting" && phaseOf(session, now()) === "waiting") return "wait";
    if (phaseOf(session, now()) === "ended") return "late";
    return (minsAgo(r) ?? 0) >= IDLE_MIN ? "idle" : "work";
  };
  const rowStats = r => stats(session, r.q || {});

  /* ─────────── session card ─────────── */
  function drawSession() {
    if (!session) return;
    const ph = phaseOf(session, now()), n = rows.length, active = ctx.settings.activeSessionId === sid;
    const total = session.minutes * 60000, end = session.startAt ? session.startAt + total : 0;
    $("[data-sess]").className = "card session " + ph;
    $("[data-label]").innerHTML = `${esc(session.title || "Session")} · ${phasePill(session)}`;
    if (ph === "waiting") {
      $("[data-big]").textContent = `${n} student${n === 1 ? "" : "s"} joined`;
      $("[data-subline]").textContent = `${session.questions.length} questions from “${session.setTitle}”. Students open the link, log in and wait. Press Start when everyone is in.`;
    } else if (ph === "running") {
      const waiting = rows.filter(r => r.status === "waiting").length;
      $("[data-big]").textContent = `${mmss(end - now())} left`;
      $("[data-subline]").textContent = `Started ${clock(session.startAt)} · ends ${clock(end)} · ${session.minutes} minutes` + (waiting ? ` · ${waiting} still in the waiting room: their test opens by itself` : "");
    } else {
      const sub = rows.filter(r => r.status === "submitted").length;
      $("[data-big]").textContent = `${sub} of ${n} submitted`;
      $("[data-subline]").textContent = session.imported
        ? `Imported from the old app${session.imported === "csv" ? " (CSV: right/wrong per question, no typed answers)" : ""} · test on ${dateTime(session.startAt)}`
        : `${session.startAt ? `Ran ${dateTime(session.startAt)}–${clock(session.endAt || end)}` : "Never started"} · “${session.setTitle}”`;
    }
    if (!drawSession.actionsFor || drawSession.actionsFor !== ph + active) { drawSession.actionsFor = ph + active; drawActions(ph, active); }
    view.querySelector(".linkbox").hidden = $("[data-linknote]").hidden = !!session.imported;
    $("[data-linknote]").textContent = ph === "ended"
      ? (now() < (session.endAt || end) + 10 * 60000 ? "The test has ended. This link closes 10 minutes after the end, so students can still see their score until then." : "This link is closed: the test has ended.")
      : "Students open this link and type their name. It closes 10 minutes after the test ends.";
    // The timer ran out: mark it ended so late saves are refused after the grace period.
    if (ph === "ended" && session.status === "running" && !endingNow) {
      endingNow = true;
      store.updateSession(sid, { status: "ended", endAt: store.time(end) }).catch(() => {}).finally(() => (endingNow = false));
    }
  }
  function drawActions(ph, active) {
    const a = $("[data-actions]");
    a.innerHTML = (ph === "waiting" ? `<label class="mins">Time limit <input data-mins type="number" min="1" max="300" value="${session.minutes}" inputmode="numeric"> min</label><button class="btn big-btn" data-start type="button">Start the test</button>` : "") +
      (ph === "running" ? `<button class="btn ghost" data-more type="button">+5 minutes</button><button class="btn danger" data-end type="button">End the test now</button>` : "") +

      (ph !== "running" ? `<button class="btn ghost" data-del type="button">Delete session</button>` : "");
    const note = t => ($("[data-note]").textContent = t);
    const act = async (patch, okText) => { note("Sending…"); try { await store.updateSession(sid, patch); note(okText); } catch (e) { note("That didn’t work: " + e.message); } };
    a.querySelector("[data-start]")?.addEventListener("click", e => {
      const m = Math.round(Number(a.querySelector("[data-mins]").value));
      if (!(m >= 1 && m <= 300)) { note("Set a time limit between 1 and 300 minutes."); return; }
      confirmClick(e.currentTarget, () => act({ status: "running", startAt: store.NOW, minutes: m }, "Started. Every student’s test opens now."));
    });
    a.querySelector("[data-more]")?.addEventListener("click", () => act({ minutes: session.minutes + 5 }, "Added 5 minutes for everyone."));
    a.querySelector("[data-end]")?.addEventListener("click", e => confirmClick(e.currentTarget, () => act({ status: "ended", endAt: store.NOW }, "Ended. Every open test submits itself.")));
    a.querySelector("[data-del]")?.addEventListener("click", e => confirmClick(e.currentTarget, async () => {
      try {
        if (active) await store.setSettings({ activeSessionId: null });
        await store.deleteSession(sid); toast("Session deleted"); ctx.go("#/sessions");
      } catch (ex) { note("Couldn’t delete: " + ex.message); }
    }, "Click again: deletes all its results"));
  }

  /* ─────────── tiles, hardest questions ─────────── */
  function drawSummary() {
    const n = rows.length, all = rows.map(rowStats), sub = rows.filter(r => r.status === "submitted").length, idle = rows.filter(r => stateOf(r) === "idle").length;
    const avg = n ? all.reduce((s, x) => s + x.score, 0) / n : 0, top = n ? Math.max(...all.map(x => x.score)) : 0, max = stats(session, {}).max;
    $("[data-tiles]").innerHTML = [
      [n, "students joined"], [`${sub}<small> / ${n}</small>`, "submitted"],
      [`${fmtPts(avg)}<small> / ${fmtPts(max)}</small>`, "average score"], [`${fmtPts(top)}<small> / ${fmtPts(max)}</small>`, "highest score"],
      [idle, `idle for ${IDLE_MIN}+ minutes`, idle ? "warn" : ""],
    ].map(([v, l, c]) => `<div class="tile ${c || ""}"><b>${v}</b><span>${l}</span></div>`).join("");
    $("[data-diff]").innerHTML = session.questions.map(q => {
      const codes = rows.map(r => cellCode(q, (r.q || {})[q.id]));
      const tried = codes.filter(c => /^[cwp]/.test(c)).length, right = codes.filter(c => c.startsWith("c")).length;
      const pct = tried ? Math.round(right / tried * 100) : 0;
      const cls = !tried ? "" : pct < 40 ? "lo" : pct <= 70 ? "mid" : "hi";
      return `<div class="dq ${cls}" title="${esc(q.label)} ${esc(q.title)}: ${right} of ${tried} right"><b>${esc(q.label)}</b><span>${tried ? pct + "%" : "–"}</span></div>`;
    }).join("");
    // Keep a summary on the session, for the Sessions list.
    const summary = { joined: n, submitted: sub, avg: Math.round(avg * 10) / 10, top, max };
    const key = JSON.stringify(summary), saved = session.stats || {};
    if (!attemptsLoaded) return;
    if (["joined", "submitted", "avg", "top", "max"].every(k => saved[k] === summary[k])) { pendingStats = null; clearTimeout(statsTimer); lastStats = key; return; }
    if (key !== lastStats) {
      lastStats = key; clearTimeout(statsTimer);
      pendingStats = summary;
      statsTimer = setTimeout(writeStats, 3000);
    }
  }

  function writeStats() {
    clearTimeout(statsTimer);
    if (!pendingStats) return;
    const s = pendingStats; pendingStats = null;
    store.updateSession(sid, { stats: s }).catch(() => {});
  }

  /* ─────────── students table ─────────── */
  function drawStudents() {
    const t = $("[data-table]"); if (!t || !session) return;
    const q = $("[data-search]").value.trim().toLowerCase(), sort = $("[data-sort]").value, filter = $("[data-filter]").value;
    const order = rows.slice().sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
    let list = rows.filter(r => !q || String(r.name).toLowerCase().includes(q));
    if (filter !== "all") list = list.filter(r => stateOf(r) === filter);
    const sc = new Map(rows.map(r => [r, rowStats(r)]));
    const by = {
      score: (a, b) => sc.get(b).score - sc.get(a).score || String(a.name).localeCompare(String(b.name)),
      roll: (a, b) => order.indexOf(a) - order.indexOf(b),
      name: (a, b) => String(a.name).localeCompare(String(b.name)),
      seen: (a, b) => (minsAgo(b) ?? 0) - (minsAgo(a) ?? 0),
      done: (a, b) => sc.get(a).done - sc.get(b).done,
    }[sort];
    list.sort(by);
    const max = session.questions.length;
    const head = `<thead><tr><th>#</th><th>Name</th><th class="n">Score</th><th class="n">Done</th><th class="n">Hints</th><th>${session.sections.map(s => `Part ${s.key}`).join(" · ")}</th><th>Status</th><th class="n">Last seen</th></tr></thead>`;
    const body = list.map(r => {
      const st = sc.get(r);
      let cells = "", prev = null;
      for (const qq of session.questions) {
        if (prev && qq.sectionKey !== prev) cells += `<span class="gap"></span>`;
        prev = qq.sectionKey;
        const v = cellCode(qq, (r.q || {})[qq.id]), k = v[0] && v[0] !== "h" ? v[0] : "";
        const label = { c: "correct", w: "wrong", p: "code started" }[k] || "not done";
        cells += `<span class="c ${k ? "c-" + k : ""} ${v.includes("h") ? "h" : ""}" title="${esc(qq.label)}: ${label}${v.includes("h") ? ", hint used" : ""}"></span>`;
      }
      const s = stateOf(r), m = minsAgo(r);
      const pill = { wait: `<span class="spill wait">Waiting</span>`, done: `<span class="spill done">Submitted</span>`, idle: `<span class="spill idle">Idle ${m} min</span>`, late: `<span class="spill bad">Not submitted</span>`, work: `<span class="spill work">Working</span>` }[s];
      const open = openIds.has(r.id);
      return `<tr class="srow click${open ? " open" : ""}" data-id="${esc(r.id)}" tabindex="0" aria-expanded="${open}"><td class="n" style="text-align:left">${order.indexOf(r) + 1}</td><td class="name">${esc(r.name)}</td><td class="n"><b>${fmtPts(st.score)}</b></td><td class="n">${st.done} / ${max}</td><td class="n">${st.hints}</td><td><div class="cells">${cells}</div></td><td>${pill}</td><td class="n">${seenText(r, m)}</td></tr>` + (open ? detailRow(r) : "");
    }).join("");
    t.innerHTML = head + `<tbody>${body || `<tr><td colspan="8" class="empty">${rows.length ? "No students match." : "No students yet. They appear here as soon as they open the link and type their name."}</td></tr>`}</tbody>`;
    t.querySelectorAll("tr.srow").forEach(tr => {
      const toggle = () => { const id = tr.dataset.id; openIds.has(id) ? openIds.delete(id) : openIds.add(id); drawStudents(); };
      tr.addEventListener("click", toggle);
      tr.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
    });
    t.querySelectorAll("[data-reset]").forEach(b => b.addEventListener("click", e => {
      e.stopPropagation();
      confirmClick(b, async () => {
        try { await store.deleteAttempt(sid, b.dataset.reset); toast("Attempt cleared. If the test is still open, the student starts again from empty."); }
        catch (ex) { toast(ex.message, "err"); }
      }, "Click again: their answers are deleted");
    }));
  }
  function seenText(r, m) {
    if (m == null) return "–";
    if (m === 0) return "now";
    if (m < 60) return m + " min ago";
    return new Date(r.lastSeen).toDateString() === new Date().toDateString() ? clock(r.lastSeen) : dateTime(r.lastSeen);
  }
  function detailRow(r) {
    const items = session.questions.map(q => {
      const e = (r.q || {})[q.id];
      const hint = e?.h ? `<span class="r h">hint</span>` : "";
      if (!e || (e.s == null && e.checked == null && (e.code == null || e.code === q.starter))) return `<div class="ans"><b>${esc(q.label)}</b> <span class="empty-ans">not answered</span>${hint}</div>`;
      const res = e.s === "c" ? `<span class="r ok">✓ correct</span>` : e.s === "w" ? `<span class="r no">✗ wrong${q.type === "blanks" && e.marks ? ` (${e.marks.filter(Boolean).length}/${e.marks.length} blanks)` : ""}</span>`
        : e.checked != null ? `<span class="r no">✗ ${esc(e.checks || "")} checks</span>` : `<span class="r p">not checked yet</span>`;
      const extra = q.type === "code" && e.s === "c" && e.checks ? ` <span class="note">${esc(e.checks)}</span>` : "";
      const body = answerText(q, e);
      const isCode = q.type === "code";
      return `<div class="ans${isCode && body ? " code" : ""}"><b>${esc(q.label)}</b>${res}${extra}${hint}${body ? (isCode ? `<pre>${esc(body)}</pre>` : `<div class="t">${esc(body)}</div>`) : ""}</div>`;
    }).join("");
    return `<tr class="detail"><td colspan="8"><div class="detail-actions"><span class="note">Joined ${r.joinedAt ? clock(r.joinedAt) : "–"}${r.finishedAt ? ` · submitted ${clock(r.finishedAt)}` : ""}</span><button class="btn ghost small" data-reset="${esc(r.id)}" type="button">Clear this student’s attempt</button></div><div class="answers">${items}</div></td></tr>`;
  }

  /* ─────────── CSV ─────────── */
  const fileBase = () => `${(session.title || "session").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase()}`;
  function csvScores() {
    const qs = session.questions;
    const head = ["Name", "Status", "Score", "Out of", "Correct", "Hints", "Done", "Joined", "Submitted at", "Last seen", ...qs.map(q => q.label)];
    const lines = [csvLine(head)].concat(rows.map(r => {
      const st = rowStats(r);
      return csvLine([r.name, { done: "submitted", wait: "waiting", late: "not submitted", idle: "idle", work: "working" }[stateOf(r)], st.score, st.max, st.correct, st.hints, st.done,
        r.joinedAt ? new Date(r.joinedAt).toLocaleString() : "", r.finishedAt ? new Date(r.finishedAt).toLocaleString() : "", r.lastSeen ? new Date(r.lastSeen).toLocaleString() : "",
        ...qs.map(q => cellCode(q, (r.q || {})[q.id]))]);
    }));
    download(`${fileBase()}-scores.csv`, "﻿" + lines.join("\n"), "text/csv");
  }
  function csvAnswers() {
    const lines = [csvLine(["Name", "Question", "Title", "Result", "Hint", "Checks", "Answer"])];
    for (const r of rows) for (const q of session.questions) {
      const e = (r.q || {})[q.id];
      lines.push(csvLine([r.name, q.label, q.title, e?.s === "c" ? "correct" : e?.s === "w" ? "wrong" : e?.checked != null ? "not passing" : "not done", e?.h ? "yes" : "", e?.checks || "", answerText(q, e)]));
    }
    download(`${fileBase()}-answers.csv`, "﻿" + lines.join("\n"), "text/csv");
  }

  /* ─────────── live data ─────────── */
  const offS = store.watchSession(sid, (s, err) => {
    if (err) { view.innerHTML = `<div class="card"><h2>Can’t open this session</h2><p>${esc(err.message)}</p></div>`; return; }
    if (!s) { view.innerHTML = `<div class="card"><h2>This session was deleted</h2><p><a href="#/sessions">See all sessions</a></p></div>`; return; }
    session = s; drawSession.actionsFor = null; drawSession(); drawSummary(); drawStudents();
  });
  const offA = store.watchAttempts(sid, (list, err) => {
    if (err) toast(err.message, "err");
    rows = list || []; attemptsLoaded = true;
    if (session) { drawSession(); drawSummary(); drawStudents(); }
  });
  const offSet = ctx.onSettings(() => { if (session) { drawSession.actionsFor = null; drawSession(); } });
  const t1 = setInterval(() => { if (session && phaseOf(session, now()) !== "ended") drawSession(); }, 1000);
  const t2 = setInterval(() => { if (session) drawStudents(); }, 30000);       // refresh "last seen"
  return () => { offS(); offA(); offSet(); clearInterval(t1); clearInterval(t2); writeStats(); };
}
