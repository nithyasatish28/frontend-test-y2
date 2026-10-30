// One door for running and checking code answers, whatever the language.
import { runJs, checkJs } from "./js.js";
import { runPython, checkPython } from "./python.js";
import { simTerminal, checkTerminal, DEFAULT_TERMINAL } from "./terminal.js";

export const LANGS = { js: "JavaScript", react: "React (JSX)", python: "Python", terminal: "Terminal commands" };

// log(kind, text): kind is "log", "err", "info" or "cmd".
export async function runCode(q, code, { log, previewHost, stdin, onLoading } = {}) {
  if (q.lang === "terminal") {
    const t = simTerminal(code, { ...DEFAULT_TERMINAL, ...(q.terminal || {}) });
    if (!t.count) { log("info", "Write your commands first, one per line."); return; }
    for (const o of t.out) log(o.kind, o.text);
    return;
  }
  if (q.lang === "python") return runPython(q, code, { log, stdin, onLoading });
  return runJs(q, code, { log, previewHost });
}

// Returns [{ name, pass, why }] — one per test.
export async function checkCode(q, code, { tests, onLoading } = {}) {
  if (q.lang === "terminal") return checkTerminal(q, code);
  if (q.lang === "python") return checkPython(q, code, tests || q.tests, onLoading);
  return checkJs(q, code, tests || q.tests);
}

// The checks a question will run, before they run (for the list under the editor).
export function checkNames(q) {
  if (q.lang === "terminal") return checkTerminal(q, "").map(r => r.name);
  return (q.tests || []).map(t => t.name || t.expr);
}
