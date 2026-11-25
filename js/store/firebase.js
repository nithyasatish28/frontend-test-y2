// Firebase backend: Authentication for logins, Firestore for everything else.
//
// Firestore layout
//   meta/owner                      { uid, email }           first instructor (one-time setup)
//   admins/{uid}                    { email, name }          instructors
//   settings/app                    { activeSessionId }      the session shown in the Live tab
//   questionSets/{id}               the editable sets, answers included (instructors only)
//   sessions/{id}                   one sitting of a test: status, timer, and the questions students see
//   sessions/{id}/attempts/{uid}    one student's answers in that session
import { firebaseConfig, FIREBASE_VERSION, STUDENT_EMAIL_DOMAIN, INSTRUCTOR_EMAIL_DOMAIN } from "../config.js";
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
  "auth/operation-not-allowed": "That sign-in type isn’t switched on in Firebase (Authentication → Sign-in method: Email/Password for you, Anonymous for students).",
  "auth/admin-restricted-operation": "Students can’t join yet: switch on Anonymous sign-in in Firebase (Authentication → Sign-in method → Anonymous).",
  "auth/configuration-not-found": "Authentication isn’t set up in Firebase yet (Authentication → Get started).",
  "auth/missing-email": "Type your email address.",
  "auth/missing-password": "Type your password.",
  "auth/argument-error": "That didn’t work. Refresh the page and try again.",
  "auth/invalid-login-credentials": "Wrong email or password.",
  "auth/user-disabled": "That account has been switched off. Ask whoever set up this app.",
  "auth/popup-closed-by-user": "The Google window closed before you finished signing in.",
  "auth/cancelled-popup-request": "The Google window closed before you finished signing in.",
  "auth/popup-blocked": "Your browser blocked the Google window. Allow pop-ups for this site, then try again.",
  "auth/account-exists-with-different-credential": "That email already has a password account here. Log in with the password instead.",
  "auth/unauthorized-domain": "This web address isn’t allowed to sign people in yet (Firebase → Authentication → Settings → Authorized domains).",
  "permission-denied": "Firebase said no (permission denied). Check that the security rules from firestore.rules are published.",
  "unavailable": "Can’t reach Firebase right now. Check the internet connection.",
};
// Firebase words its errors for developers — "Firebase: Error (auth/argument-error)." means
// nothing to a teacher. Anything not in the list above gets a human sentence instead, with the
// code kept at the end so it can still be looked up.
export const friendlyError = e => {
  const code = e?.code;
  // Only a string or an Error carries words worth showing. Anything else stringifies to
  // "[object Object]", which is worse than saying nothing.
  const raw = (typeof e === "string" ? e : String(e?.message || "")).replace(/^Firebase:\s*/, "").trim();
  let msg = MESSAGES[code];
  if (!msg) {
    const canned = !raw || /^Error\s*\(.*\)\.?$/.test(raw);     // their "Error (auth/foo)." shape
    msg = canned
      ? `Something went wrong${code ? ` (${code})` : ""}. Try again, and tell your instructor if it keeps happening.`
      : raw;
  }
  const err = new Error(msg);
  err.code = code; return err;
};
const wrap = fn => async (...a) => { try { return await fn(...a); } catch (e) { throw e?.friendly ? e : friendlyError(e); } };
const fail = msg => { const e = new Error(msg); e.friendly = true; return e; };

export async function create(role) {
  const [A, AU, F] = await Promise.all([
    import(CDN + "firebase-app.js"), import(CDN + "firebase-auth.js"), import(CDN + "firebase-firestore.js"),
  ]);
  // Students get their own app instance, so a student tab never logs the instructor out (or the other way round).
  const app = role === "student" ? A.initializeApp(firebaseConfig, "student") : A.initializeApp(firebaseConfig);
  // initializeAuth (rather than getAuth) takes nothing for granted, so the thing that knows how
  // to open a sign-in popup has to be handed over explicitly. Without it signInWithPopup throws
  // auth/argument-error before any window appears — which is exactly what it did.
  const auth = AU.initializeAuth(app, {
    persistence: AU.browserLocalPersistence,
    popupRedirectResolver: AU.browserPopupRedirectResolver,
  });
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
  const me = u => ({ uid: u.uid, email: u.email, emailVerified: !!u.emailVerified });
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
    onAuth(cb) { return AU.onAuthStateChanged(auth, u => cb(u ? me(u) : null)); },
    signOut: () => AU.signOut(auth),

    // Students only type a name. Behind the scenes they get a nameless Firebase login,
    // so the rules can still keep each student to their own answers.
    studentSignIn: wrap(async () => (await AU.signInAnonymously(auth)).user.uid),

    adminSignIn: wrap(async (email, password) => (await AU.signInWithEmailAndPassword(auth, email.trim(), password)).user.uid),

    // Google sign-in. `hd` asks Google to offer only work accounts in the chooser — a kindness,
    // not a lock: it can be got around, and the real test is workEmail() in firestore.rules,
    // which refuses anyone else no matter how they signed in.
    adminSignInGoogle: wrap(async () => {
      const provider = new AU.GoogleAuthProvider();
      provider.setCustomParameters({ hd: INSTRUCTOR_EMAIL_DOMAIN, prompt: "select_account" });
      const cred = await AU.signInWithPopup(auth, provider);
      return cred.user.uid;
    }),

    /* ─────────── Becoming an instructor ─────────── */
    // Anyone can make an account; it is worth nothing on its own. Only a verified work address
    // can ask for access, and only an instructor can grant it (see firestore.rules).
    adminSignUp: wrap(async (email, password) => {
      const cred = await AU.createUserWithEmailAndPassword(auth, email.trim(), password);
      await AU.sendEmailVerification(cred.user);
      return cred.user.uid;
    }),
    resendVerification: wrap(async () => {
      if (!auth.currentUser) throw fail("You’re not signed in any more. Log in and try again.");
      await AU.sendEmailVerification(auth.currentUser);
    }),
    // After the link in the email is clicked, the token still says unverified until it is
    // refreshed — the rules read the token, so this has to happen before asking for access.
    refreshUser: wrap(async () => {
      const u = auth.currentUser;
      if (!u) return null;
      await AU.reload(u);
      await u.getIdToken(true);
      return me(auth.currentUser);
    }),
    requestAccess: wrap(async name => {
      const u = auth.currentUser;
      if (!u) throw fail("You’re not signed in any more. Log in and try again.");
      await F.setDoc(d("pendingAdmins", u.uid), { uid: u.uid, email: u.email, name: name.trim(), askedAt: F.serverTimestamp() });
    }),
    getRequest: wrap(async id => data(await F.getDoc(d("pendingAdmins", id)))),
    cancelRequest: wrap(id => F.deleteDoc(d("pendingAdmins", id))),
    watchRequest: (id, cb) => watchDoc(d("pendingAdmins", id), cb),
    watchRequests: cb => watchCol(c("pendingAdmins"), cb),
    watchAdmins: cb => watchCol(c("admins"), cb),
    approveRequest: wrap(async r => {
      const b = F.writeBatch(db);
      b.set(d("admins", r.uid), { email: r.email, name: r.name || r.email });
      b.delete(d("pendingAdmins", r.uid));
      await b.commit();
    }),
    removeAdmin: wrap(id => F.deleteDoc(d("admins", id))),
    adminResetPassword: wrap(email => AU.sendPasswordResetEmail(auth, email.trim())),
    hasOwner: wrap(async () => (await F.getDoc(d("meta", "owner"))).exists()),
    ownerUid: wrap(async () => { const o = await F.getDoc(d("meta", "owner")); return o.exists() ? o.get("uid") : null; }),
    isAdmin: wrap(async id => (await F.getDoc(d("admins", id))).exists()),
    // "super" · "instructor" · null. The first account (meta/owner) is always super, so a
    // database set up before roles existed still has one without being migrated.
    adminRole: wrap(async id => {
      const mine = await F.getDoc(d("admins", id));
      if (!mine.exists()) return null;
      if (mine.get("role") === "super") return "super";
      const owner = await F.getDoc(d("meta", "owner"));
      return owner.exists() && owner.get("uid") === id ? "super" : "instructor";
    }),
    setRole: wrap((id, role) => F.updateDoc(d("admins", id), { role })),
    // The first instructor, written once they have clicked the link in their email. The rules
    // only allow this while there is no owner yet, so it can happen exactly once.
    adminCreateOwner: wrap(async name => {
      const u = auth.currentUser;
      if (!u) throw fail("You’re not signed in any more. Log in and try again.");
      if (!u.emailVerified) throw fail("Click the link in the email first, then press “I’ve done that”.");
      const b = F.writeBatch(db);
      b.set(d("meta", "owner"), { uid: u.uid, email: u.email });
      b.set(d("admins", u.uid), { email: u.email, name: name.trim(), role: "super" });
      await b.commit();
      await F.setDoc(d("settings", "app"), { activeSessionId: null }, { merge: true });
      return u.uid;
    }),

    /* ─────────── Settings ─────────── */
    // Per instructor, not shared: two people teaching at once each have their own Live tab.
    watchSettings: (cb, uid) => watchDoc(d("instructorSettings", uid), cb),
    setSettings: wrap((patch, uid) => F.setDoc(d("instructorSettings", uid), patch, { merge: true })),

    /* ─────────── Question sets ─────────── */
    // owner: whose work to show. null means everything, which only the super admin may ask for —
    // a plain instructor's query has to name them, or the rules refuse the whole list.
    watchSets: (cb, owner) => watchCol(owner
      ? F.query(c("questionSets"), F.where("ownerUid", "==", owner), F.orderBy("updatedAt", "desc"))
      : F.query(c("questionSets"), F.orderBy("updatedAt", "desc")), cb),
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
    // Deleting puts a session in the bin: the students' answers, the questions and the results
    // all stay exactly where they are, and restoring is one field again. Firestore has no undo of
    // its own, so a real delete here would be final.
    deleteSession: wrap(id => F.updateDoc(d("sessions", id), { deletedAt: F.serverTimestamp() })),
    restoreSession: wrap(id => F.updateDoc(d("sessions", id), { deletedAt: F.deleteField() })),
    // Emptying the bin. This is the one that cannot be undone.
    destroySession: wrap(async id => {
      const snap = await F.getDocs(c("sessions", id, "attempts"));
      for (let i = 0; i < snap.docs.length; i += 400) {
        const b = F.writeBatch(db);
        snap.docs.slice(i, i + 400).forEach(x => b.delete(x.ref));
        await b.commit();
      }
      try { await F.deleteDoc(d("sessions", id, "secret", "keys")); } catch {}
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
    // The answers an exam session keeps back. Only the session's owner can read this path.
    saveSecret: wrap((sid, data) => F.setDoc(d("sessions", sid, "secret", "keys"), data)),
    getSecret: wrap(async sid => data(await F.getDoc(d("sessions", sid, "secret", "keys")))),
    watchSession: (id, cb) => watchDoc(d("sessions", id), cb),
    watchSessions: (cb, owner) => watchCol(owner
      ? F.query(c("sessions"), F.where("ownerUid", "==", owner), F.orderBy("createdAt", "desc"), F.limit(300))
      : F.query(c("sessions"), F.orderBy("createdAt", "desc"), F.limit(300)), cb),

    // One-off: give everything made before ownership existed to whoever runs this.
    adoptUnowned: wrap(async uid => {
      let sets = 0, sessions = 0;
      for (const [name, col] of [["questionSets", "questionSets"], ["sessions", "sessions"]]) {
        const snap = await F.getDocs(c(col));
        const orphans = snap.docs.filter(x => !x.get("ownerUid"));
        for (let i = 0; i < orphans.length; i += 400) {
          const b = F.writeBatch(db);
          orphans.slice(i, i + 400).forEach(x => b.update(x.ref, { ownerUid: uid }));
          await b.commit();
        }
        if (name === "questionSets") sets = orphans.length; else sessions = orphans.length;
      }
      return { sets, sessions };
    }),

    /* ─────────── Attempts ─────────── */
    watchAttempts: (sid, cb) => watchCol(c("sessions", sid, "attempts"), cb),
    watchAttempt: (sid, id, cb) => watchDoc(d("sessions", sid, "attempts", id), cb),
    getAttempt: wrap(async (sid, id) => data(await F.getDoc(d("sessions", sid, "attempts", id)))),
    saveAttempt: wrap((sid, id, patch) => F.setDoc(d("sessions", sid, "attempts", id), { ...patch, uid: id }, { merge: true })),
    deleteAttempt: wrap((sid, id) => F.deleteDoc(d("sessions", sid, "attempts", id))),
    getSession: wrap(async id => data(await F.getDoc(d("sessions", id)))),
    syncClock: wrap(async (sid, id) => {
      const ref = d("sessions", sid, "attempts", id), t0 = Date.now();
      await F.setDoc(ref, { uid: id, lastSeen: F.serverTimestamp() }, { merge: true });
      return learnOffset(ref, "lastSeen", t0);
    }),
  };
  return store;
}
