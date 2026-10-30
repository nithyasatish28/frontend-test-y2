// Picks the data backend. Both backends have exactly the same functions:
//   firebase.js — the real thing (Firebase Auth + Firestore)
//   demo.js     — everything in this browser's storage, for trying the app without Firebase
import { isDemo } from "../config.js";

export async function openStore(role) {
  const mod = isDemo() ? await import("./demo.js") : await import("./firebase.js");
  return mod.create(role);
}
