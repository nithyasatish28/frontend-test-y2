// Answer keys, scoring and turning an editable question set into what students receive.
// Students get hashed answers (salted per session) for multiple choice and blanks, never the plain text.

export function cyrb53(str, seed = 0) {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
export const normBlank = s => String(s).replace(/\s+/g, "").replace(/;+$/, "").replace(/[“”]/g, "\"").replace(/[‘’]/g, "'");
const hashOf = (salt, qid, v) => cyrb53(`${salt}:${qid}:${v}`);

/* ─────────── Sections and labels ─────────── */
export const sectionKey = i => String.fromCharCode(65 + i);              // 0 → "A"
export function labelQuestions(set) {
  const keys = new Map((set.sections || []).map((s, i) => [s.id, sectionKey(i)]));
  const count = {}, order = new Map((set.sections || []).map((s, i) => [s.id, i]));
  const qs = (set.questions || []).map((q, i) => [q, i]).sort((a, b) => (order.get(a[0].section) ?? 1e9) - (order.get(b[0].section) ?? 1e9) || a[1] - b[1]).map(x => x[0]);
  return qs.map(q => {
    const k = keys.get(q.section) || "?";
    count[k] = (count[k] || 0) + 1;
    return { ...q, label: k + count[k], sectionKey: k };
  });
}
export const blankNumbers = code => [...String(code || "").matchAll(/__(\d+)__/g)].map(m => Number(m[1]));

/* ─────────── Question set → session copy ─────────── */
export function publishQuestion(q, salt) {
  const base = { id: q.id, label: q.label, sectionKey: q.sectionKey, type: q.type, title: q.title || "", prompt: q.prompt || "", hint: q.hint || "" };
  if (Number(q.points) > 0) base.points = Number(q.points);
  if (q.type === "mcq") {
    return { ...base, code: q.code || "", codeLang: q.codeLang || "js", options: q.options || [], key: hashOf(salt, q.id, String(q.answer)) };
  }
  if (q.type === "blanks") {
    const nums = blankNumbers(q.code);
    const keys = nums.map(n => {
      const b = (q.blanks || []).find(x => Number(x.n) === n) || { accept: [] };
      // joined with "|" because Firestore can't store an array inside an array
      return (b.accept || []).filter(a => String(a).trim()).map(a => hashOf(salt, q.id, normBlank(a))).join("|");
    });
    return { ...base, code: q.code || "", lang: q.lang || "js", anyOrder: !!q.anyOrder, keys };
  }
  if (q.type === "subjective") {
    // Nothing to hash: there is no key. The model answer stays with the instructor, exactly
    // like a code question's solution, so it never reaches a student's browser.
    return { ...base, code: q.code || "", codeLang: q.codeLang || "text",
             rows: Number(q.rows) > 0 ? Number(q.rows) : 8, guidance: q.guidance || "" };
  }
  // code
  const out = { ...base, lang: q.lang || "js", starter: q.starter || "", setup: q.setup || "", tests: q.tests || [], preview: q.preview || "" };
  if (q.lang === "terminal") out.terminal = q.terminal || {};
  if (q.lang === "python" && q.stdin) out.stdin = q.stdin;
  return out;
}

// Everything a student must not have, stripped from their copy of a question.
// In an exam there is nothing in the browser to check an answer against, so there is nothing
// to find: no hashed key, no accepted blanks, no expected values for the code tests. The test
// names stay, because a name says what is being checked, not what comes out.
export function examQuestion(q) {
  const out = { ...q };
  delete out.key;
  delete out.keys;
  if (out.tests) out.tests = out.tests.map(t => ({ name: t.name || t.expr || "Check" }));
  return out;
}

export function publishSet(set, salt, { exam = false } = {}) {
  const labelled = labelQuestions(set);
  const questions = labelled.map(q => publishQuestion(q, salt));
  return {
    sections: (set.sections || []).map((s, i) => ({ key: sectionKey(i), title: s.title || "" })),
    questions: exam ? questions.map(examQuestion) : questions,
  };
}

// The plain answers, kept with the secret copy and shown to students only when the instructor
// releases the results. Multiple choice and blanks only: a code question's model answer stays
// with the instructor.
export const answerKeyFor = secret => (secret && secret.plain) || {};

// What the instructor keeps back: the real copy, the salt that goes with it, and the marking
// notes for written answers. Lives in a subcollection only the session's owner can read.
export function sessionSecret(set, salt) {
  const labelled = labelQuestions(set);
  const plain = {};
  for (const q of labelled) {
    if (q.type === "mcq" && q.answer != null) plain[q.id] = { pick: Number(q.answer) };
    else if (q.type === "blanks") {
      plain[q.id] = { accept: blankNumbers(q.code).map(n =>
        (((q.blanks || []).find(b => Number(b.n) === n) || {}).accept || []).filter(a => String(a).trim())) };
    }
  }
  return {
    salt,
    questions: labelled.map(q => publishQuestion(q, salt)),
    notes: Object.fromEntries(labelled.filter(q => q.expected).map(q => [q.id, q.expected])),
    plain,
  };
}

/* ─────────── Checking answers in the browser ─────────── */
export const mcqRight = (q, salt, idx) => hashOf(salt, q.id, String(idx)) === q.key;

// Returns one true/false per blank.
export function blanksMarks(q, salt, values) {
  const hashes = values.map(v => hashOf(salt, q.id, normBlank(v)));
  const keys = (q.keys || []).map(k => (Array.isArray(k) ? k : String(k || "").split("|").filter(Boolean)));
  if (!q.anyOrder) return hashes.map((h, i) => (keys[i] || []).includes(h));
  // any order: find the matching of answers to blanks that gets the most right
  const n = hashes.length;
  let best = hashes.map(() => false), bestN = -1;
  const used = new Array(n).fill(false), cur = new Array(n).fill(false);
  const go = (i, got) => {
    if (got + (n - i) <= bestN) return;
    if (i === n) { if (got > bestN) { bestN = got; best = cur.slice(); } return; }
    for (let j = 0; j < n; j++) {
      if (used[j] || !(keys[j] || []).includes(hashes[i])) continue;
      used[j] = true; cur[i] = true; go(i + 1, got + 1); used[j] = false; cur[i] = false;
    }
    go(i + 1, got);                                   // or leave this answer unmatched
  };
  if (n <= 7) go(0, 0); else return hashes.map(h => keys.some(k => k.includes(h)));
  return best;
}

/* ─────────── Scores ─────────── */
// entry.s: "c" correct, "w" wrong, null not done.  entry.h: hint opened.
// A question's own points if it has them, otherwise the set's default.
export const qPoints = (q, session) => (Number(q?.points) > 0 ? Number(q.points) : session.points ?? 1);
// What a partly-right answer is worth, when the set asks for part marks: the share of the
// blanks filled in correctly, or of the checks that pass. Nothing otherwise.
export function partPoints(entry, session, q, full = qPoints(q, session)) {
  if (!entry || !session.partMarks) return 0;
  if (q.type === "blanks" && Array.isArray(entry.marks) && entry.marks.length) {
    return Math.round(full * entry.marks.filter(Boolean).length / entry.marks.length * 100) / 100;
  }
  if (q.type === "code" && entry.checks) {
    const [p, t] = String(entry.checks).split("/").map(Number);
    if (t > 0 && p >= 0) return Math.round(full * p / t * 100) / 100;
  }
  return 0;
}

export function entryPoints(entry, session, q) {
  if (!entry) return 0;
  const hint = entry.h ? (session.hintPenalty ?? 0.5) : 0;
  // A hand-marked answer carries whatever the instructor gave it, part marks included.
  if (typeof entry.awarded === "number") return entry.awarded - hint;
  const full = qPoints(q, session);
  // Whichever is kinder. A student who once passed every check keeps the whole mark even if
  // they carried on editing and broke something — that was the promise when they passed.
  return Math.max(entry.s === "c" ? full : 0, partPoints(entry, session, q, full)) - hint;
}
export const written = e => String(e?.text || "").trim();
// A written answer still waiting for the instructor to read it.
export const needsMarking = (q, e) => q.type === "subjective" && !!written(e) && typeof e.awarded !== "number";
export const isDone = (q, e, session) => {
  if (!e) return false;
  if (q.type === "subjective") return !!written(e);
  // In an exam nothing is marked while it runs, so "done" can only mean answered.
  if (session && session.examMode) {
    if (q.type === "code") return !!e.code && e.code !== (q.starter || "");
    return e.s != null || !!e.handed;
  }
  return q.type === "code" ? e.s === "c" : e.s != null;
};
export function stats(session, qmap = {}) {
  const qs = session.questions || [];
  let score = 0, correct = 0, hints = 0, done = 0, max = 0, pending = 0;
  for (const q of qs) {
    const e = qmap[q.id];
    score += entryPoints(e, session, q);
    max += qPoints(q, session);
    if (e?.s === "c" || (typeof e?.awarded === "number" && e.awarded >= qPoints(q, session))) correct++;
    if (e?.h) hints++;
    if (isDone(q, e, session)) done++;
    if (needsMarking(q, e)) pending++;
  }
  return { score: Math.round(score * 100) / 100, correct, hints, done, total: qs.length, pending,
           max: Math.round(max * 100) / 100 };
}
// One-letter status for the admin grid: c correct, w wrong, p code started, "" nothing; + "h" if a hint was used.
// c correct · w wrong · p partly there · m written, waiting to be marked · "" nothing.
export function cellCode(q, e, session) {
  if (!e) return "";
  let base = "";
  if (q.type === "subjective") {
    const full = session ? qPoints(q, session) : Number(q.points) || 1;
    base = typeof e.awarded === "number" ? (e.awarded >= full ? "c" : e.awarded > 0 ? "p" : "w")
      : written(e) ? "m" : "";
  } else if (e.s === "c") base = "c";
  else if (e.s === "w") base = session && partPoints(e, session, q) > 0 ? "p" : "w";
  else base = q.type === "code" && (e.checked != null || (e.code != null && e.code !== q.starter)) ? "p" : "";
  return base + (e.h ? "h" : "");
}
// What the student answered, as text.
export function answerText(q, e) {
  if (!e) return "";
  if (q.type === "mcq") return e.pick != null && e.s ? `${"ABCDEFGH"[e.pick]} · ${String(q.options[e.pick] || "").replace(/`/g, "")}` : "";
  if (q.type === "blanks") return e.s ? (e.vals || []).join("  |  ") : "";
  if (q.type === "subjective") return e.text || "";
  return e.checked ?? e.code ?? "";
}
