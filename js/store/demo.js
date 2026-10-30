// Demo backend: same functions as firebase.js, but everything lives in this browser's localStorage.
// Open the student page and the admin page in two tabs and they talk to each other.
// Logins are per tab, so you can be the instructor in one tab and a student in another.
import { nameKey, uid as randomId } from "../lib/util.js";
import { STARTER_SETS } from "../data/starter-sets.js";

const KEY = "class-test-demo-v1";
const fail = msg => { const e = new Error(msg); e.friendly = true; return e; };
const NOW = { __now: true };
const clone = v => JSON.parse(JSON.stringify(v));
const stamp = v => {
  if (v && v.__now) return Date.now();
  if (Array.isArray(v)) return v.map(stamp);
  if (v && typeof v === "object") { const o = {}; for (const k in v) o[k] = stamp(v[k]); return o; }
  return v;
};
const later = () => new Promise(r => setTimeout(r, 40 + Math.random() * 60));   // feel like a network

function seed() {
  const owner = "demo-owner";
  const docs = {
    ["_auth/" + owner]: { email: "demo@example.com", password: "demo1234" },
    "meta/owner": { uid: owner, email: "demo@example.com" },
    ["admins/" + owner]: { email: "demo@example.com", name: "Demo instructor" },
    "settings/app": { signupOpen: true, activeSessionId: null },
  };
  STARTER_SETS.forEach((s, i) => { docs["questionSets/starter" + i] = { ...clone(s), createdAt: Date.now() - (i + 1) * 1000, updatedAt: Date.now() - (i + 1) * 1000 }; });
  return { docs };
}

export async function create(role) {
  let db;
  const load = () => { try { db = JSON.parse(localStorage.getItem(KEY)); } catch { db = null; } if (!db || !db.docs) { db = seed(); persist(); } };
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { console.warn("Demo storage is full", e); } };
  load();

  const watchers = new Set();
  const notify = () => {
    for (const w of watchers) {
      const v = w.read(), s = JSON.stringify(v);
      if (s !== w.last) { w.last = s; try { w.cb(clone(v ?? null)); } catch (e) { console.error(e); } }
    }
  };
  addEventListener("storage", e => { if (e.key === KEY) { load(); notify(); } });
  const watch = (read, cb) => { const w = { read, cb, last: undefined }; watchers.add(w); setTimeout(() => { if (watchers.has(w)) { w.last = JSON.stringify(read()); cb(clone(read() ?? null)); } }, 0); return () => watchers.delete(w); };

  const get = path => (db.docs[path] ? { id: path.split("/").pop(), ...db.docs[path] } : null);
  const col = path => Object.keys(db.docs).filter(k => k.startsWith(path + "/") && !k.slice(path.length + 1).includes("/")).map(get);
  const set = (path, value, merge) => { firestoreSafe(value, path); db.docs[path] = merge ? deepMerge(db.docs[path] || {}, stamp(value)) : stamp(value); };
  const del = path => { delete db.docs[path]; };
  const commit = () => { persist(); notify(); };
  const write = async fn => { await later(); load(); const r = fn(); commit(); return r; };

  // Auth (per tab)
  const AUTH_KEY = "class-test-demo-auth-" + role;
  const authStore = role === "student" ? sessionStorage : localStorage;
  let user = null;
  try { user = JSON.parse(authStore.getItem(AUTH_KEY)); } catch {}
  const authCbs = new Set();
  const setUser = u => { user = u; u ? authStore.setItem(AUTH_KEY, JSON.stringify(u)) : authStore.removeItem(AUTH_KEY); authCbs.forEach(cb => cb(u)); };

  // The same limits the Firestore rules apply to students' saves.
  const canSave = (sid, uid) => {
    const s = db.docs["sessions/" + sid], a = db.docs[`sessions/${sid}/attempts/${uid}`], u = db.docs["users/" + uid], now = Date.now();
    if (!u || u.disabled) return false;
    if (a && a.status === "submitted") return false;
    if (!s) return false;
    return s.status === "waiting" || (s.status === "running" && now < s.startAt + (s.minutes + 3) * 60000) || (s.status === "ended" && now < s.endAt + 3 * 60000);
  };

  return {
    mode: "demo",
    NOW,
    time: ms => ms,
    serverNow: () => Date.now(),
    resetDemo() { localStorage.removeItem(KEY); load(); notify(); },

    onAuth(cb) { authCbs.add(cb); setTimeout(() => cb(user), 0); return () => authCbs.delete(cb); },
    async signOut() { setUser(null); },

    async studentSignUp(name, password) {
      await later(); load();
      const key = nameKey(name);
      if (key.length < 2) throw fail("Type your full name.");
      if (!db.docs["settings/app"]?.signupOpen) throw fail("New accounts are closed right now. Ask your instructor to open sign-ups.");
      if (db.docs["usernames/" + key]) throw fail("That name already has an account. Log in instead, or add your initial or roll number to your name.");
      if (String(password).length < 6) throw fail("Use a password with at least 6 characters.");
      const id = "u" + randomId(10), email = `${key}.${randomId(6)}@students.demo`;
      set("_auth/" + id, { email, password });
      set("usernames/" + key, { uid: id, email, name: name.trim() });
      set("users/" + id, { name: name.trim(), nameKey: key, email, createdAt: NOW, disabled: false });
      commit();
      setUser({ uid: id, email });
      return { uid: id };
    },
    async studentSignIn(name, password) {
      await later(); load();
      const u = db.docs["usernames/" + nameKey(name)];
      if (!u) throw fail("There’s no account with that name. Check the spelling, or create an account.");
      if (db.docs["_auth/" + u.uid]?.password !== password) throw fail("Wrong password.");
      setUser({ uid: u.uid, email: u.email });
      return { uid: u.uid };
    },
    async adminSignIn(email, password) {
      await later(); load();
      const hit = Object.entries(db.docs).find(([k, v]) => k.startsWith("_auth/") && v.email === email.trim().toLowerCase());
      if (!hit || hit[1].password !== password) throw fail("Wrong email or password. (Demo: demo@example.com / demo1234)");
      const id = hit[0].slice(6);
      setUser({ uid: id, email: hit[1].email });
      return id;
    },
    async adminResetPassword() { throw fail("Demo mode can’t send emails. The demo login is demo@example.com / demo1234."); },
    async hasOwner() { load(); return !!db.docs["meta/owner"]; },
    async isAdmin(id) { load(); return !!db.docs["admins/" + id]; },
    async adminCreateOwner(email, password, name) {
      return write(() => {
        if (db.docs["meta/owner"]) throw fail("There’s already an instructor account.");
        const id = "a" + randomId(10);
        set("_auth/" + id, { email: email.trim().toLowerCase(), password });
        set("meta/owner", { uid: id, email }); set("admins/" + id, { email, name });
        set("settings/app", { signupOpen: true, activeSessionId: null }, true);
        setTimeout(() => setUser({ uid: id, email }), 0);
        return id;
      });
    },

    watchSettings: cb => watch(() => get("settings/app"), cb),
    setSettings: patch => write(() => set("settings/app", patch, true)),

    getUser: async id => { load(); return clone(get("users/" + id)); },
    watchUsers: cb => watch(() => col("users"), cb),
    updateUser: (id, patch) => write(() => set("users/" + id, patch, true)),
    releaseName: user => write(() => {
      if (db.docs["usernames/" + user.nameKey]?.uid === user.id) del("usernames/" + user.nameKey);
      set("users/" + user.id, { disabled: true, released: true }, true);
    }),

    watchSets: cb => watch(() => col("questionSets").sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)), cb),
    getSet: async id => { load(); return clone(get("questionSets/" + id)); },
    saveSet: (id, s) => write(() => {
      const { id: _drop, ...rest } = clone(s);
      const nid = id || randomId(16);
      set("questionSets/" + nid, { ...rest, updatedAt: NOW, createdAt: rest.createdAt || Date.now() });
      return nid;
    }),
    deleteSet: id => write(() => del("questionSets/" + id)),

    createSession: s => write(() => { const id = randomId(16); set("sessions/" + id, { ...clone(s), createdAt: NOW }); return id; }),
    importSession: (s, attempts) => write(() => {
      const id = randomId(16);
      set("sessions/" + id, clone(s));
      for (const a of attempts) set(`sessions/${id}/attempts/${a.uid}`, clone(a));
      return id;
    }),
    updateSession: (id, patch) => write(() => set("sessions/" + id, patch, true)),
    deleteSession: id => write(() => { for (const k of Object.keys(db.docs)) if (k.startsWith(`sessions/${id}/`)) del(k); del("sessions/" + id); }),
    watchSession: (id, cb) => watch(() => get("sessions/" + id), cb),
    watchSessions: cb => watch(() => col("sessions").sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), cb),

    watchAttempts: (sid, cb) => watch(() => col(`sessions/${sid}/attempts`), cb),
    watchAttempt: (sid, id, cb) => watch(() => get(`sessions/${sid}/attempts/${id}`), cb),
    getAttempt: async (sid, id) => { load(); return clone(get(`sessions/${sid}/attempts/${id}`)); },
    saveAttempt: (sid, id, patch) => write(() => {
      if (user && user.uid === id && !db.docs["admins/" + id] && !canSave(sid, id)) throw fail("Firebase said no (permission denied).");
      set(`sessions/${sid}/attempts/${id}`, { ...patch, uid: id }, true);
    }),
    deleteAttempt: (sid, id) => write(() => del(`sessions/${sid}/attempts/${id}`)),
    syncClock: async (sid, id) => {
      await write(() => { if (!canSave(sid, id)) throw fail("Firebase said no (permission denied)."); set(`sessions/${sid}/attempts/${id}`, { uid: id, lastSeen: NOW }, true); });
      return 0;
    },
  };
}

function deepMerge(a, b) {
  const out = { ...a };
  for (const k in b) {
    const v = b[k];
    out[k] = v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" && !Array.isArray(a[k]) ? deepMerge(a[k], v) : v;
  }
  return out;
}

// Refuse what Firestore refuses, so problems show up in demo mode too.
function firestoreSafe(v, where, inArray = false) {
  if (v === undefined) throw new Error(`Unsupported field value: undefined (in ${where})`);
  if (typeof v === "function" || (typeof v === "number" && !Number.isFinite(v))) throw new Error(`Unsupported field value (in ${where})`);
  if (Array.isArray(v)) {
    if (inArray) throw new Error(`Nested arrays are not supported (in ${where})`);
    v.forEach((x, i) => firestoreSafe(x, `${where}[${i}]`, true));
  } else if (v && typeof v === "object" && !v.__now) {
    for (const k in v) firestoreSafe(v[k], `${where}.${k}`, false);
  }
}
