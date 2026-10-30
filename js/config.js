

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

// Library versions loaded from CDNs. Change only if you know you need to.
export const FIREBASE_VERSION = "13.1.0";
export const PYODIDE_URL = "https://cdn.jsdelivr.net/npm/pyodide@314.0.7/";

export const isDemo = () =>
  new URLSearchParams(location.search).has("demo") || !firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("PASTE");
