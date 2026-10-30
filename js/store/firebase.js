// Firebase backend: Authentication for logins, Firestore for everything else.
//
// Firestore layout
//   meta/owner                      { uid, email }           first instructor (one-time setup)
//   admins/{uid}                    { email, name }          instructors
//   settings/app                    { signupOpen, activeSessionId }
//   usernames/{nameKey}             { uid, email, name }     lets students log in with their name
//   users/{uid}                     { name, nameKey, email, createdAt, disabled }
//   questionSets/{id}               the editable sets, answers included (instructors only)
//   sessions/{id}                   one sitting of a test: status, timer, and the questions students see
//   sessions/{id}/attempts/{uid}    one student's answers in that session
import { firebaseConfig, FIREBASE_VERSION, STUDENT_EMAIL_DOMAIN } from "../config.js";
import { nameKey, uid as randomId } from "../lib/util.js";

const CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/`;

const MESSAGES = {
  "auth/invalid-credential": "Wrong password.",
  "auth/wrong-password": "Wrong password.",
  "auth/user-not-found": "There’s no account with that email.",
  "auth/invalid-email": "That email address doesn’t look right.",
  "auth/email-already-in-use": "That email already has an account. Log in instead.",
  "auth/weak-password": "Use a password with at least 6 characters.",
  "auth/too-many-requests": "Too many tries. Wait a minute, then try again.",
  "auth/network-request-failed": "Can’t reach the internet. Check the connection and try again.",
  "auth/operation-not-allowed": "Email/password sign-in isn’t switched on in Firebase (Authentication → Sign-in method).",
  "auth/configuration-not-found": "Authentication isn’t set up in Firebase yet (Authentication → Get started).",
  "permission-denied": "Firebase said no (permission denied). Check that the security rules from firestore.rules are published.",
  "unavailable": "Can’t reach Firebase right now. Check the internet connection.",
};
export const friendlyError = e => {
  const err = new Error(MESSAGES[e?.code] || e?.message || String(e));
  err.code = e?.code; return err;
};
const wrap = fn => async (...a) => { try { return await fn(...a); } catch (e) { throw e?.friendly ? e : friendlyError(e); } };
const fail = msg => { const e = new Error(msg); e.friendly = true; return e; };

export async function create(role) {
  const [A, AU, F] = await Promise.all([
    import(CDN + "firebase-app.js"), import(CDN + "firebase-auth.js"), import(CDN + "firebase-firestore.js"),
  ]);
  const app = A.initializeApp(firebaseConfig);
  // Students: logged in only for this tab (shared lab laptops). Instructors: stay logged in.
  const auth = AU.initializeAuth(app, { persistence: role === "student" ? AU.browserSessionPersistence : AU.browserLocalPersistence });
  const db = F.getFirestore(app);
  let offset = 0;

  const d = (...p) => F.doc(db, ...p);
  const c = (...p) => F.collection(db, ...p);
  const plain = v => {
    if (v instanceof F.Timestamp) return v.toMillis();
    if (Array.isArray(v)) return v.map(plain);
    if (v && typeof v === "object") { const o = {}; for (const k in v) o[k] = plain(v[k]); return o; }
    return v;
  };
  const data = snap => (snap.exists() ? { id: snap.id, ...plain(snap.data()) } : null);
  const list = snap => snap.docs.map(data);
  const watchDoc = (ref, cb) => F.onSnapshot(ref, s => cb(data(s)), e => cb(null, friendlyError(e)));
  const watchCol = (q, cb) => F.onSnapshot(q, s => cb(list(s)), e => cb([], friendlyError(e)));
  // Clock: compare a server timestamp we just wrote with this laptop's clock.
  async function learnOffset(ref, field, t0) {
    const t1 = Date.now(), snap = await F.getDoc(ref), v = snap.exists() && snap.get(field);
    if (v && v.toMillis) offset = v.toMillis() - (t0 + t1) / 2;
    return offset;
  }

  const store = {
    mode: "firebase",
    get NOW() { return F.serverTimestamp(); },
    time: ms => F.Timestamp.fromMillis(ms),          // a time to save (rules compare times, not numbers)
    serverNow: () => Date.now() + offset,

    /* ─────────── Auth ─────────── */
    onAuth(cb) { return AU.onAuthStateChanged(auth, u => cb(u ? { uid: u.uid, email: u.email } : null)); },
    signOut: () => AU.signOut(auth),

    studentSignUp: wrap(async (name, password) => {
      const key = nameKey(name);
      if (key.length < 2) throw fail("Type your full name.");
      const settings = await F.getDoc(d("settings", "app"));
      if (!settings.exists() || !settings.get("signupOpen")) throw fail("New accounts are closed right now. Ask your instructor to open sign-ups.");
      if ((await F.getDoc(d("usernames", key))).exists()) throw fail("That name already has an account. Log in instead, or add your initial or roll number to your name.");
      const slug = key.normalize("NFKD").replace(/[^a-z0-9-]/g, "").slice(0, 30) || "student";
      const email = `${slug}.${randomId(6)}@${STUDENT_EMAIL_DOMAIN}`;
      const cred = await AU.createUserWithEmailAndPassword(auth, email, password);
      try {
        const b = F.writeBatch(db);
        b.set(d("usernames", key), { uid: cred.user.uid, email, name: name.trim() });
        b.set(d("users", cred.user.uid), { name: name.trim(), nameKey: key, email, createdAt: F.serverTimestamp(), disabled: false });
        await b.commit();
      } catch (e) {
        try { await cred.user.delete(); } catch {}
        throw e.code === "permission-denied" ? fail("Couldn’t create the account: the name was just taken, or sign-ups closed. Try again.") : e;
      }
      return { uid: cred.user.uid };
    }),

    studentSignIn: wrap(async (name, password) => {
      const key = nameKey(name);
      const snap = await F.getDoc(d("usernames", key));
      if (!snap.exists()) throw fail("There’s no account with that name. Check the spelling, or create an account.");
      const cred = await AU.signInWithEmailAndPassword(auth, snap.get("email"), password);
      return { uid: cred.user.uid };
    }),

    adminSignIn: wrap(async (email, password) => (await AU.signInWithEmailAndPassword(auth, email.trim(), password)).user.uid),
    adminResetPassword: wrap(email => AU.sendPasswordResetEmail(auth, email.trim())),
    hasOwner: wrap(async () => (await F.getDoc(d("meta", "owner"))).exists()),
    isAdmin: wrap(async id => (await F.getDoc(d("admins", id))).exists()),
    adminCreateOwner: wrap(async (email, password, name) => {
      const cred = await AU.createUserWithEmailAndPassword(auth, email.trim(), password);
      const b = F.writeBatch(db);
      b.set(d("meta", "owner"), { uid: cred.user.uid, email: email.trim() });
      b.set(d("admins", cred.user.uid), { email: email.trim(), name: name.trim() });
      await b.commit();
      await F.setDoc(d("settings", "app"), { signupOpen: true, activeSessionId: null }, { merge: true });
      return cred.user.uid;
    }),

    /* ─────────── Settings ─────────── */
    watchSettings: cb => watchDoc(d("settings", "app"), cb),
    setSettings: wrap(patch => F.setDoc(d("settings", "app"), patch, { merge: true })),

    /* ─────────── Students ─────────── */
    getUser: wrap(async id => data(await F.getDoc(d("users", id)))),
    watchUsers: cb => watchCol(c("users"), cb),
    updateUser: wrap((id, patch) => F.updateDoc(d("users", id), patch)),
    // Frees the name so the student can sign up again (for a forgotten password). Their old account is switched off.
    releaseName: wrap(async user => {
      const b = F.writeBatch(db);
      const u = await F.getDoc(d("usernames", user.nameKey));
      if (u.exists() && u.get("uid") === user.id) b.delete(d("usernames", user.nameKey));
      b.update(d("users", user.id), { disabled: true, released: true });
      await b.commit();
    }),

    /* ─────────── Question sets ─────────── */
    watchSets: cb => watchCol(F.query(c("questionSets"), F.orderBy("updatedAt", "desc")), cb),
    getSet: wrap(async id => data(await F.getDoc(d("questionSets", id)))),
    saveSet: wrap(async (id, set) => {
      const { id: _drop, ...rest } = set;
      const body = { ...rest, updatedAt: F.serverTimestamp() };
      if (id) { await F.setDoc(d("questionSets", id), body); return id; }
      const ref = await F.addDoc(c("questionSets"), { ...body, createdAt: F.serverTimestamp() });
      return ref.id;
    }),
    deleteSet: wrap(id => F.deleteDoc(d("questionSets", id))),

    /* ─────────── Sessions ─────────── */
    createSession: wrap(async s => (await F.addDoc(c("sessions"), { ...s, createdAt: F.serverTimestamp() })).id),
    updateSession: wrap(async (id, patch) => {
      const t0 = Date.now();
      await F.updateDoc(d("sessions", id), patch);
      if (patch.startAt && !(typeof patch.startAt === "number")) await learnOffset(d("sessions", id), "startAt", t0);
    }),
    deleteSession: wrap(async id => {
      const snap = await F.getDocs(c("sessions", id, "attempts"));
      for (let i = 0; i < snap.docs.length; i += 400) {
        const b = F.writeBatch(db);
        snap.docs.slice(i, i + 400).forEach(x => b.delete(x.ref));
        await b.commit();
      }
      await F.deleteDoc(d("sessions", id));
    }),
    // A finished session with its students' attempts, written in one go (old results, see admin/import-old.js).
    importSession: wrap(async (s, attempts) => {
      const ref = F.doc(c("sessions"));
      await F.setDoc(ref, s);
      for (let i = 0; i < attempts.length; i += 400) {
        const b = F.writeBatch(db);
        attempts.slice(i, i + 400).forEach(a => b.set(d("sessions", ref.id, "attempts", a.uid), a));
        await b.commit();
      }
      return ref.id;
    }),
    watchSession: (id, cb) => watchDoc(d("sessions", id), cb),
    watchSessions: cb => watchCol(F.query(c("sessions"), F.orderBy("createdAt", "desc"), F.limit(300)), cb),

    /* ─────────── Attempts ─────────── */
    watchAttempts: (sid, cb) => watchCol(c("sessions", sid, "attempts"), cb),
    watchAttempt: (sid, id, cb) => watchDoc(d("sessions", sid, "attempts", id), cb),
    getAttempt: wrap(async (sid, id) => data(await F.getDoc(d("sessions", sid, "attempts", id)))),
    saveAttempt: wrap((sid, id, patch) => F.setDoc(d("sessions", sid, "attempts", id), { ...patch, uid: id }, { merge: true })),
    deleteAttempt: wrap((sid, id) => F.deleteDoc(d("sessions", sid, "attempts", id))),
    syncClock: wrap(async (sid, id) => {
      const ref = d("sessions", sid, "attempts", id), t0 = Date.now();
      await F.setDoc(ref, { uid: id, lastSeen: F.serverTimestamp() }, { merge: true });
      return learnOffset(ref, "lastSeen", t0);
    }),
  };
  return store;
}
