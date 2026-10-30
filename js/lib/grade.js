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
  // code
  const out = { ...base, lang: q.lang || "js", starter: q.starter || "", setup: q.setup || "", tests: q.tests || [], preview: q.preview || "" };
  if (q.lang === "terminal") out.terminal = q.terminal || {};
  if (q.lang === "python" && q.stdin) out.stdin = q.stdin;
  return out;
}

export function publishSet(set, salt) {
  const labelled = labelQuestions(set);
  return {
    sections: (set.sections || []).map((s, i) => ({ key: sectionKey(i), title: s.title || "" })),
    questions: labelled.map(q => publishQuestion(q, salt)),
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
export function entryPoints(entry, session) {
  if (!entry) return 0;
  return (entry.s === "c" ? (session.points ?? 1) : 0) - (entry.h ? (session.hintPenalty ?? 0.5) : 0);
}
export const isDone = (q, e) => !!e && (q.type === "code" ? e.s === "c" : e.s != null);
export function stats(session, qmap = {}) {
  const qs = session.questions || [];
  let score = 0, correct = 0, hints = 0, done = 0;
  for (const q of qs) {
    const e = qmap[q.id];
    score += entryPoints(e, session);
    if (e?.s === "c") correct++;
    if (e?.h) hints++;
    if (isDone(q, e)) done++;
  }
  return { score: Math.round(score * 100) / 100, correct, hints, done, total: qs.length, max: qs.length * (session.points ?? 1) };
}
// One-letter status for the admin grid: c correct, w wrong, p code started, "" nothing; + "h" if a hint was used.
export function cellCode(q, e) {
  if (!e) return "";
  const base = e.s === "c" ? "c" : e.s === "w" ? "w" : q.type === "code" && (e.checked != null || (e.code != null && e.code !== q.starter)) ? "p" : "";
  return base + (e.h ? "h" : "");
}
// What the student answered, as text.
export function answerText(q, e) {
  if (!e) return "";
  if (q.type === "mcq") return e.pick != null && e.s ? `${"ABCDEFGH"[e.pick]} · ${String(q.options[e.pick] || "").replace(/`/g, "")}` : "";
  if (q.type === "blanks") return e.s ? (e.vals || []).join("  |  ") : "";
  return e.checked ?? e.code ?? "";
}
