// One student taking one session: waiting room, the test itself, saving, timer and results.
import { el, esc, fmtPts, mmss, clock, debounce } from "../lib/util.js";
import { stats, entryPoints, isDone } from "../lib/grade.js";
import { renderQuestion } from "../ui/question.js";
import { showGate, hideGate, gateMessage } from "./gate.js";

const HEARTBEAT = 60000;

export class Test {
  constructor({ store, sid, user, onSignOut }) {
    Object.assign(this, { store, sid, uid: user.uid, name: user.name, onSignOut });
    this.A = null;              // this student's attempt (local copy, the source of truth while working)
    this.session = null;
    this.onServer = false;      // the attempt document exists in the database
    this.view = "test";
    this.saveState = "";
    this.dirty = false;
    this.clockSynced = false;
    this.localKey = `class-test-attempt:${sid}:${user.uid}`;
    this.push = debounce(() => this.send(), 1200);
    this.pushSoon = debounce(() => this.send(), 20000);
  }

  /* ─────────── Loading ─────────── */
  async start() {
    let local = null, server = null;
    try { local = JSON.parse(localStorage.getItem(this.localKey)); } catch {}
    try { server = await this.store.getAttempt(this.sid, this.uid); } catch (e) { console.warn(e); }
    this.onServer = !!server;
    this.submittedSent = server?.status === "submitted";      // the database won't take changes after this
    const pick = local && (!server || (local.t || 0) > (server.t || 0)) ? local : server;
    this.A = pick ? { status: pick.status || "waiting", q: pick.q || {}, cur: pick.cur || null, t: pick.t || 0, finishedAt: pick.finishedAt || 0 } : this.fresh();
    if (local && server && local.t > (server.t || 0)) this.dirty = true;     // unsent changes from before a refresh
    this.unwatch = this.store.watchAttempt(this.sid, this.uid, doc => {
      if (doc) { this.onServer = true; return; }
      if (this.onServer) { this.onServer = false; this.resetByInstructor(); }
    });
    this.timer = setInterval(() => this.tick(), 1000);
    this.beat = setInterval(() => { if (this.joined() && this.A.status !== "submitted") this.send(); }, HEARTBEAT);
    addEventListener("beforeunload", this.onUnload = () => { if (this.dirty) this.send(); });
    el("tab-test").onclick = () => this.show("test");
    el("tab-scores").onclick = () => this.show("scores");
    el("tab-timer").onclick = () => this.show("timer");
    el("scoreChip").onclick = () => this.show("scores");
    el("timeChip").onclick = () => this.show("timer");
    el("finishBtn").onclick = () => this.finishClick();
  }
  fresh() { return { status: "waiting", q: {}, cur: null, t: 0, finishedAt: 0 }; }
  stop() {
    clearInterval(this.timer); clearInterval(this.beat); this.unwatch && this.unwatch();
    removeEventListener("beforeunload", this.onUnload);
    this.push.cancel(); this.pushSoon.cancel();
    ["tabs", "view-test", "view-scores", "view-timer", "scoreChip", "timeChip", "syncChip", "banner"].forEach(id => (el(id).hidden = true));
  }
  resetByInstructor() {
    try { localStorage.removeItem(this.localKey); } catch {}
    this.A = this.fresh(); this.dirty = false; this.submittedSent = false;
    this.shown = ""; this.view = "test";               // redraw everything from empty
    this.update();
  }

  /* ─────────── Session state ─────────── */
  setSession(s) { this.session = s; this.update(); }
  now() { return this.store.serverNow(); }
  endsAt() { const s = this.session; return s.startAt ? s.startAt + (s.minutes || 0) * 60000 : 0; }
  phase() {
    const s = this.session;
    if (!s) return "none";
    if (s.status === "waiting") return "waiting";
    if (s.status === "ended" || (s.startAt && this.now() >= this.endsAt())) return "ended";
    return s.startAt ? "running" : "waiting";
  }
  timeLeft() {
    if (!this.session?.startAt) return (this.session?.minutes || 0) * 60000;
    const until = this.A.status === "submitted" && this.A.finishedAt ? Math.min(this.A.finishedAt, this.endsAt()) : this.now();
    if (this.session.status === "ended" && this.session.endAt) return Math.max(0, Math.min(this.endsAt(), this.session.endAt) - until);
    return Math.max(0, this.endsAt() - until);
  }
  locked() { return this.A.status === "submitted" || this.phase() !== "running"; }
  joined() { return this.onServer || this.A.t > 0; }

  update() {
    if (!this.session || !this.A) return;
    const ph = this.phase();
    if (this.A.status === "submitted") { this.showTest(); return; }
    if (ph === "waiting") { this.join("waiting"); this.showWaiting(); return; }
    if (ph === "running") {
      if (this.A.status !== "working") { this.A.status = "working"; this.changed(true); }
      this.join("working");
      this.showTest(); return;
    }
    // ended
    if (this.A.status === "working") { this.finish(true); return; }
    if (!this.joined()) { gateMessage(this.session.title || "Test", "This test has ended.", { name: this.name, onSignOut: this.onSignOut }); return; }
    this.showTest();
  }

  async join(status) {
    if (this.joining || this.onServer) { if (this.onServer && !this.clockSynced) this.syncClock(); return; }
    this.joining = true;
    this.A.status = status;
    try { await this.send(true); await this.syncClock(); }
    catch (e) { gateMessage("Can’t join this test", esc(e.message), { name: this.name, onSignOut: this.onSignOut }); }
    this.joining = false;
  }
  async syncClock() {
    if (this.clockSynced) return;
    this.clockSynced = true;
    try { await this.store.syncClock(this.sid, this.uid); } catch (e) { this.clockSynced = false; }
  }

  /* ─────────── Saving ─────────── */
  changed(urgent) {
    this.A.t = Date.now(); this.dirty = true;
    try { localStorage.setItem(this.localKey, JSON.stringify(this.A)); } catch {}
    if (!this.session) return;
    if (urgent) { this.pushSoon.cancel(); this.push(); } else this.pushSoon();
    el("scoreTop").textContent = fmtPts(stats(this.session, this.A.q).score);
  }
  payload() {
    const st = stats(this.session, this.A.q);
    return {
      name: this.name, status: this.A.status, q: this.A.q, t: this.A.t || Date.now(),
      score: st.score, correct: st.correct, hints: st.hints, done: st.done, total: st.total,
      lastSeen: this.store.NOW, ...(this.A.finishedAt ? { finishedAt: this.A.finishedAt } : {}),
      ...(this.onServer ? {} : { joinedAt: this.store.NOW }),
    };
  }
  async send(throwErrors) {
    this.push.cancel(); this.pushSoon.cancel();
    if (this.submittedSent) { this.dirty = false; return; }
    if (this.sending) { this.again = true; return; }
    this.sending = true; this.dirty = false;
    this.showSave("saving");
    try {
      const p = this.payload();
      await this.store.saveAttempt(this.sid, this.uid, p);
      this.onServer = true;
      if (p.status === "submitted") this.submittedSent = true;
      this.showSave("saved");
    } catch (e) {
      this.dirty = true; this.showSave("error");
      if (!/permission/i.test(e.message)) setTimeout(() => this.dirty && this.send(), 15000);
      if (throwErrors) { this.sending = false; throw e; }
    }
    this.sending = false;
    if (this.again) { this.again = false; this.send(); }
  }
  showSave(state) {
    const c = el("syncChip");
    if (!this.session || this.phase() === "waiting") { c.hidden = true; return; }
    c.hidden = false;
    c.className = "chip " + (state === "error" ? "warn" : state === "saved" ? "ok" : "");
    c.textContent = state === "saving" ? "● Saving…" : state === "saved" ? "● Answers saved" : "● Offline, will retry";
    c.title = state === "error" ? "Your answers are kept on this laptop and will be sent when the connection is back." : "";
  }

  /* ─────────── Screens ─────────── */
  rulesHtml() {
    const s = this.session, n = s.questions.length, secs = s.sections.map(x => x.title.toLowerCase()).filter(Boolean);
    const pen = s.hintPenalty ?? 0.5, pts = s.points ?? 1;
    return `<p>${n} question${n === 1 ? "" : "s"}${secs.length ? ` in ${secs.length} part${secs.length === 1 ? "" : "s"}: ${esc(secs.join(", "))}` : ""}.</p>
      <div class="rules">
        <div><b class="pos">+${fmtPts(pts)}</b><span>for each correct answer</span></div>
        <div><b class="neg">−${fmtPts(pen)}</b><span>for each hint you open</span></div>
        <div><b>${s.minutes}</b><span>minutes</span></div>
      </div>
      <ul>
        <li><b>Multiple choice and fill in the blanks:</b> one try each. Check before you submit.</li>
        <li><b>Code questions:</b> run and check as often as you like. You get the point the first time all the checks pass.</li>
        <li>No AI tools and no copying from the internet. Your own notes are fine.</li>
        <li>When the time runs out, the test submits itself.</li>
      </ul>`;
  }
  showWaiting() {
    ["tabs", "view-test", "view-scores", "view-timer", "scoreChip", "timeChip"].forEach(id => (el(id).hidden = true));
    const s = showGate(`
      <h1>${esc(this.session.title || "Test")}</h1>
      ${this.rulesHtml()}
      <div class="wait">
        <div class="dots" aria-hidden="true"><i></i><i></i><i></i></div>
        <h2>You’re in, ${esc(this.name)}.</h2>
        <p>Wait here. The test starts for everyone when your instructor presses Start. Keep this tab open.</p>
      </div>
      <div class="gate-foot"><span class="note">Signed in as <b>${esc(this.name)}</b></span><button class="linkbtn" data-signout type="button">Not you? Sign out</button></div>`);
    s.querySelector("[data-signout]").addEventListener("click", this.onSignOut);
    this.shown = "waiting";
  }
  showTest() {
    const first = this.shown !== "test";
    this.shown = "test";
    hideGate();
    ["tabs", "scoreChip", "timeChip"].forEach(id => (el(id).hidden = false));
    if (!this.A.cur || !this.session.questions.some(q => q.id === this.A.cur)) this.A.cur = this.session.questions[0]?.id;
    if (first) this.show(this.A.status === "submitted" ? "scores" : this.view);
    else if (this.view === "test") this.renderList();
    else this.show(this.view);
    this.tick();
  }
  show(v) {
    this.view = v;
    for (const k of ["test", "scores", "timer"]) {
      el("view-" + k).hidden = k !== v;
      el("tab-" + k).setAttribute("aria-selected", String(k === v));
    }
    if (v === "test") { this.renderList(); this.renderQ(); }
    if (v === "scores") this.renderScores();
    if (v === "timer") this.renderTimer();
  }
  entry(id) { return (this.A.q[id] ||= { s: null, h: false }); }

  renderList() {
    const box = el("qlist"), s = this.session; box.innerHTML = "";
    for (const sec of s.sections) {
      const qs = s.questions.filter(q => q.sectionKey === sec.key);
      if (!qs.length) continue;
      const h = document.createElement("h3"); h.textContent = `Part ${sec.key} · ${sec.title}`; box.append(h);
      const g = document.createElement("div"); g.className = "qgrid";
      for (const q of qs) {
        const e = this.A.q[q.id] || {}, b = document.createElement("button");
        b.type = "button"; b.textContent = q.label; b.title = q.title;
        b.className = "qb" + (q.id === this.A.cur ? " now" : "") + (e.s === "c" ? " correct" : e.s === "w" ? " wrong" : "") + (e.h ? " hinted" : "");
        b.setAttribute("aria-label", `${q.label}: ${q.title}${e.s === "c" ? ", correct" : e.s === "w" ? ", not correct" : ""}${e.h ? ", hint used" : ""}`);
        b.addEventListener("click", () => this.openQ(q.id));
        g.append(b);
      }
      box.append(g);
    }
    const lg = document.createElement("div"); lg.className = "legend";
    lg.innerHTML = `<span><b style="color:var(--good)">Green</b> correct · <b style="color:var(--bad)">red</b> wrong</span><span><b style="color:var(--hint)">●</b> hint opened</span>`;
    box.append(lg);
    el("scoreTop").textContent = fmtPts(stats(s, this.A.q).score);
  }
  openQ(id) {
    this.A.cur = id; this.changed(false);
    this.renderList(); this.renderQ();
    if (innerWidth < 980) el("qcard").scrollIntoView({ behavior: "smooth", block: "start" });
  }
  renderQ() {
    const s = this.session, qs = s.questions, idx = qs.findIndex(q => q.id === this.A.cur), q = qs[idx];
    if (!q) { el("qcard").innerHTML = `<p class="note">This test has no questions.</p>`; return; }
    const sec = s.sections.find(x => x.key === q.sectionKey);
    renderQuestion(el("qcard"), {
      q, entry: this.entry(q.id), session: s, isLocked: () => this.locked(),
      meta: { index: idx, total: qs.length, sectionTitle: sec?.title },
      nav: {
        prevLabel: idx > 0 ? qs[idx - 1].label : "", onPrev: () => this.openQ(qs[idx - 1].id),
        nextLabel: idx < qs.length - 1 ? qs[idx + 1].label : "See my score", onNext: () => (idx < qs.length - 1 ? this.openQ(qs[idx + 1].id) : this.show("scores")),
      },
      onChange: kind => {
        const urgent = kind === "answer" || kind === "hint" || kind === "check";
        this.changed(urgent);
        if (urgent) this.renderList();
      },
    });
  }

  renderScores() {
    const s = this.session, st = stats(s, this.A.q), pen = s.hintPenalty ?? 0.5, pts = s.points ?? 1;
    el("bigScore").innerHTML = `${fmtPts(st.score)}<small> / ${fmtPts(st.max)}</small>`;
    el("stCorrect").textContent = st.correct; el("stCorrectLabel").textContent = `correct (+${fmtPts(pts)} each)`;
    el("stHints").textContent = st.hints; el("stHintsLabel").textContent = `hints (−${fmtPts(pen)} each)`;
    el("stLeft").textContent = st.total - st.done;
    let rows = `<thead><tr><th>Question</th><th>Result</th><th class="n">Answer</th><th class="n">Hint</th><th class="n">Points</th></tr></thead><tbody>`;
    for (const sec of s.sections) {
      const qs = s.questions.filter(q => q.sectionKey === sec.key);
      if (!qs.length) continue;
      const sub = qs.reduce((a, q) => a + entryPoints(this.A.q[q.id], s), 0);
      rows += `<tr class="part"><td colspan="4">Part ${sec.key} · ${esc(sec.title)}</td><td class="n">${fmtPts(sub)} / ${fmtPts(qs.length * pts)}</td></tr>`;
      for (const q of qs) {
        const e = this.A.q[q.id] || {};
        const res = e.s === "c" ? "✓ Correct" : e.s === "w" ? "✗ Not correct" : q.type === "code" && e.checked != null ? `In progress (${esc(e.checks || "")} checks)` : "Not done";
        rows += `<tr><td><b>${q.label}</b> ${esc(q.title)}</td><td>${res}</td><td class="n pos">${e.s === "c" ? "+" + fmtPts(pts) : "0"}</td><td class="n neg">${e.h ? "−" + fmtPts(pen) : ""}</td><td class="n"><b>${fmtPts(entryPoints(e, s))}</b></td></tr>`;
      }
    }
    el("scoreTable").innerHTML = rows + "</tbody>";
    const done = this.A.status === "submitted", fb = el("finishBtn");
    fb.disabled = done || this.phase() !== "running";
    fb.textContent = done ? "Submitted" : "Finish and submit";
    el("finishNote").textContent = done ? `Submitted${this.A.finishedAt ? " at " + clock(this.A.finishedAt) : ""}. Your instructor can see your answers.` : "Finishing locks every answer. You can’t undo it.";
  }
  renderTimer() {
    const s = this.session, total = (s.minutes || 0) * 60000, left = this.timeLeft(), used = total - left;
    const arc = el("ringArc"), C = 2 * Math.PI * 112;
    arc.setAttribute("stroke-dashoffset", String(C * (1 - (total ? left / total : 0))));
    arc.setAttribute("stroke", left <= 5 * 60000 ? "#c2362f" : left <= 10 * 60000 ? "#b86a00" : "#0f7a5c");
    el("ringText").textContent = mmss(left);
    el("tStart").textContent = s.startAt ? clock(s.startAt) : "–";
    el("tEnd").textContent = s.startAt ? clock(this.endsAt()) : "–";
    el("tUsed").textContent = mmss(used);
    const leftQ = s.questions.filter(q => !isDone(q, this.A.q[q.id])).length;
    el("tPace").textContent = leftQ ? mmss(left / leftQ) : "All done";
    let rows = `<thead><tr><th>Part</th><th class="n">Done</th><th>Progress</th></tr></thead><tbody>`;
    for (const sec of s.sections) {
      const qs = s.questions.filter(q => q.sectionKey === sec.key), done = qs.filter(q => isDone(q, this.A.q[q.id])).length;
      if (!qs.length) continue;
      rows += `<tr><td>Part ${sec.key} · ${esc(sec.title)}</td><td class="n">${done} / ${qs.length}</td><td style="width:45%"><div class="bar"><i style="width:${(done / qs.length) * 100}%"></i></div></td></tr>`;
    }
    el("paceTable").innerHTML = rows + "</tbody>";
  }

  tick() {
    if (!this.session || !this.A || this.shown !== "test") return;
    const left = this.timeLeft();
    el("timeTop").textContent = mmss(left);
    el("timeChip").className = "chip" + (left <= 5 * 60000 ? " danger" : left <= 10 * 60000 ? " warn" : "");
    if (this.A.status === "working" && this.phase() === "ended") { this.finish(true); return; }
    if (this.view === "timer") this.renderTimer();
    const b = el("banner"), st = stats(this.session, this.A.q);
    if (this.A.status === "submitted") { b.hidden = false; b.className = "banner done"; b.textContent = `Test submitted${this.A.finishedAt ? " at " + clock(this.A.finishedAt) : ""}. Final score: ${fmtPts(st.score)} / ${fmtPts(st.max)}.`; }
    else if (this.phase() === "ended") { b.hidden = false; b.className = "banner done"; b.textContent = "This test has ended."; }
    else if (left <= 5 * 60000) { b.hidden = false; b.className = "banner"; b.textContent = `${mmss(left)} left. The test submits itself when the time runs out.`; }
    else b.hidden = true;
  }

  finishClick() {
    const b = el("finishBtn");
    if (this.A.status === "submitted") return;
    if (!this.armed) {
      this.armed = true; b.textContent = "Sure? Click again to submit";
      setTimeout(() => { this.armed = false; if (this.A.status !== "submitted") b.textContent = "Finish and submit"; }, 4000);
      return;
    }
    this.finish(false);
  }
  finish(auto) {
    if (this.A.status === "submitted") return;
    this.A.status = "submitted";
    this.A.finishedAt = Math.min(this.now(), this.endsAt() || Infinity, this.session.endAt || Infinity);
    this.changed(true);
    this.send();
    this.view = "scores";
    this.shown = "";
    this.showTest();
  }
}
