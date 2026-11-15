

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyDepCowHGRGLfUdI0fGvjeGu4hvUPL69yI",
  authDomain: "checkpoint-c88ba.firebaseapp.com",
  projectId: "checkpoint-c88ba",
  storageBucket: "checkpoint-c88ba.firebasestorage.app",
  messagingSenderId: "527449833161",
  appId: "1:527449833161:web:eab9710a9978e2a6bf9718"
};


// 2. The name shown at the top of both pages.
export const APP_TITLE = "Checkpoint";

// 3. Students sign in with a name and a password. Behind the scenes each student
//    gets a made-up email address on this domain. Nothing is ever sent to it.
export const STUDENT_EMAIL_DOMAIN = "students.checkpoint.app";

// 4. Instructors sign up themselves, but only with a work email on this domain, and only
//    after an instructor already here approves them.
//    IMPORTANT: this line is only for the message on screen. The rule that actually enforces
//    the domain is workEmail() in firestore.rules — a check here alone could be walked around
//    with the browser console. Change both, and publish the rules again.
export const INSTRUCTOR_EMAIL_DOMAIN = "atriauniversity.edu.in";

// Library versions loaded from CDNs. Change only if you know you need to.
export const FIREBASE_VERSION = "13.1.0";
export const PYODIDE_URL = "https://cdn.jsdelivr.net/npm/pyodide@314.0.7/";

// Demo mode is on with ?demo in the address, or when Firebase hasn't been filled in yet.
// The ?demo is accepted after the # as well — admin.html#/sessions?demo — because that is an
// easy way to write it by hand, and silently talking to the real database instead would be
// a nasty surprise.
const askedForDemo = () => {
  if (new URLSearchParams(location.search).has("demo")) return true;
  const q = location.hash.indexOf("?");
  return q !== -1 && new URLSearchParams(location.hash.slice(q)).has("demo");
};
export const isDemo = () => askedForDemo() || !firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("PASTE");
