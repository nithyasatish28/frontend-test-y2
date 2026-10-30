// Python questions: runs code in a Web Worker with Pyodide (Python compiled for the browser).
// The first run downloads Python (about 10 MB), then it's cached by the browser.
//
// A Python test is { name, expr, op, expected, msg }, like JavaScript tests, but expr and expected are Python:
//   expr can use the student's functions and variables, plus
//     OUTPUT   everything the program printed (run with the question's sample input)
//     run("3\n4")   run the whole program again with this input, and get what it printed
//     SOURCE   the student's code
const TIMEOUT = 8000;
let worker = null, ready = null, seq = 0;
const pending = new Map();

function start() {
  worker = new Worker(new URL("./python-worker.js", import.meta.url), { type: "module" });
  ready = new Promise((res, rej) => {
    worker.onmessage = e => {
      const m = e.data;
      if (m.type === "ready") return res();
      if (m.type === "failed") return rej(new Error("Python didn’t load. Check the internet connection and refresh. (" + m.error + ")"));
      const p = pending.get(m.id); if (!p) return;
      pending.delete(m.id); clearTimeout(p.timer);
      m.ok ? p.res(m.result) : p.rej(new Error(m.error));
    };
    worker.onerror = e => rej(new Error("Python didn’t load: " + (e.message || "worker error")));
  });
}
const restart = () => { try { worker.terminate(); } catch {} worker = null; ready = null; };

export const pythonReady = () => (worker ? ready : null);
export function warmUpPython() { if (!worker) start(); return ready; }

async function call(msg, onLoading) {
  if (!worker) start();
  let loaded = false;
  ready.then(() => { loaded = true; }, () => {});
  await Promise.resolve();
  if (!loaded && onLoading) onLoading();
  await ready;
  const id = ++seq;
  return new Promise((res, rej) => {
    const timer = setTimeout(() => {
      pending.delete(id); restart();
      rej(new Error(`Your program ran for more than ${TIMEOUT / 1000} seconds, so it was stopped.\n→ Is there a loop that never ends, or an input() waiting for more input?`));
    }, TIMEOUT);
    pending.set(id, { res, rej, timer });
    worker.postMessage({ id, ...msg });
  });
}

export async function runPython(q, code, { log, stdin, onLoading }) {
  try {
    const r = await call({ kind: "run", code, stdin: stdin ?? q.stdin ?? "" }, onLoading);
    if (r.out) log("log", r.out.replace(/\n$/, ""));
    if (r.err) log("err", r.err);
    if (!r.out && !r.err) log("info", "(Nothing was printed.)");
  } catch (e) { log("err", e.message); }
}

export async function checkPython(q, code, tests = q.tests || [], onLoading) {
  try {
    const r = await call({ kind: "check", code, stdin: q.stdin || "", setup: q.setup || "", tests }, onLoading);
    return r.results;
  } catch (e) {
    return tests.map(t => ({ name: t.name || t.expr, pass: false, why: e.message }));
  }
}
