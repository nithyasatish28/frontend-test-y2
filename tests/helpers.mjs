// Shared bits for the tests. No framework: a counter, a comparison, and stand-ins for the
// browser so the real modules can run under node.

let pass = 0, fail = 0;
const failures = [];

export const is = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}`);
  if (!ok) { console.log(`        got  ${JSON.stringify(got)}\n        want ${JSON.stringify(want)}`); failures.push(name); }
  ok ? pass++ : fail++;
};
export const tally = () => ({ pass, fail, failures });
export const reset = () => { pass = 0; fail = 0; failures.length = 0; };

// localStorage, sessionStorage and the storage event that lets demo-mode tabs see each other.
export function fakeStorage() {
  const shared = new Map(), listeners = [];
  const fire = key => listeners.forEach(fn => { try { fn({ key }); } catch {} });
  const make = map => ({
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); fire(k); },
    removeItem: k => { map.delete(k); fire(k); },
  });
  globalThis.localStorage = make(shared);
  globalThis.sessionStorage = make(new Map());
  globalThis.addEventListener = (type, fn) => { if (type === "storage") listeners.push(fn); };
  globalThis.removeEventListener = () => {};
  return shared;
}

// A DOM, when a test drives the real UI modules. Returns null if jsdom isn't installed.
export async function fakeDom(bodyHtml = "") {
  let JSDOM;
  try { ({ JSDOM } = await import("jsdom")); }
  catch { const e = new Error("needs jsdom — run: npm install"); e.needsJsdom = true; throw e; }
  const dom = new JSDOM(`<!doctype html><body>${bodyHtml}</body>`, { url: "http://localhost/" });
  for (const k of ["document", "HTMLElement", "Event", "InputEvent", "Node", "getComputedStyle"]) {
    Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
  }
  Object.defineProperty(globalThis, "window", { value: dom.window, configurable: true, writable: true });
  globalThis.innerWidth = 1200;
  // jsdom has no <dialog> behaviour
  dom.window.HTMLElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLElement.prototype.close = function () { this.open = false; };
  return dom;
}

// Every id index.html gives the student page, so test.js can be driven for real.
export const STUDENT_IDS = ["brand","who","scoreChip","scoreTop","syncChip","timeChip","timeTop",
  "signOutTop","tabs","tab-test","tab-scores","tab-timer","banner","view-test","qlist","qcard",
  "view-scores","bigScore","stCorrect","stCorrectLabel","stHints","stHintsLabel","stLeft","finishBtn",
  "finishNote","scoreTable","view-timer","ringArc","ringText","tStart","tEnd","tUsed","tPace",
  "paceTable","gate","gateSheet","demoBar"];
export const studentBody = () => STUDENT_IDS.map(i => `<div id="${i}"></div>`).join("");
export const tick = (ms = 10) => new Promise(r => setTimeout(r, ms));
