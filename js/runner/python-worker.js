// Runs Python with Pyodide, away from the page so a forever-loop can't freeze it.
import { PYODIDE_URL } from "../config.js";

const HARNESS = String.raw`
import sys, io, json, re, traceback

class _Input:
    def __init__(self, text, out, echo):
        self.lines = text.split("\n") if text else []
        self.i, self.out, self.echo = 0, out, echo
    def __call__(self, prompt=""):
        self.out.write(str(prompt))
        if self.i >= len(self.lines):
            raise EOFError("input() was called, but there is no more input")
        line = self.lines[self.i]
        self.i += 1
        if self.echo:
            self.out.write(line + "\n")
        return line

def _friendly(e):
    name = type(e).__name__
    if isinstance(e, SyntaxError):
        where = f" (line {e.lineno})" if e.lineno else ""
        return f"SyntaxError{where}: {e.msg}\n→ Check brackets, colons at the end of if/for/def lines, and indentation."
    line = None
    for f in traceback.extract_tb(e.__traceback__):
        if f.filename == "main.py":
            line = f.lineno
    where = f" (line {line})" if line else ""
    tip = {
        "NameError": "\n→ Check the spelling and capitals, and that it is defined before it is used.",
        "IndentationError": "\n→ Line the code up: 4 spaces inside each if / for / def.",
        "TypeError": "\n→ Check the types: you might be mixing text and numbers. int() and str() convert.",
        "IndexError": "\n→ That position isn't in the list. Lists start at 0.",
        "KeyError": "\n→ That key isn't in the dictionary.",
        "EOFError": "\n→ Your program asked for more input() than it was given.",
    }.get(name, "")
    return f"{name}{where}: {e}{tip}"

def _exec(src, stdin_text, echo):
    out = io.StringIO()
    ns = {"__name__": "__main__", "input": _Input(stdin_text, out, echo)}
    old = sys.stdout, sys.stderr
    sys.stdout = sys.stderr = out
    err = None
    try:
        exec(compile(src, "main.py", "exec"), ns)
    except SystemExit:
        pass
    except BaseException as e:
        err = _friendly(e)
    finally:
        sys.stdout, sys.stderr = old
    return ns, out.getvalue(), err

def _strip_comments(src):
    return re.sub(r"(?m)^\s*#.*$|\s+#[^'\"\n]*$", "", src)

# The hidden setup also runs once BEFORE the student's program, so it can provide
# stand-in modules (e.g. a small fake "fastapi" in sys.modules) that their imports find.
def _prelude(setup):
    if setup.strip():
        try:
            exec(setup, {"__name__": "__setup__"})
        except BaseException:
            pass

def __run(src, stdin_text, setup=""):
    _prelude(setup)
    ns, out, err = _exec(src, stdin_text, True)
    return json.dumps({"out": out, "err": err})

def __check(src, stdin_text, setup, tests_json):
    tests = json.loads(tests_json)
    _prelude(setup)
    ns, out, err = _exec(src, stdin_text, False)
    env = dict(ns)
    env.update(OUTPUT=out, SOURCE=src, ERROR=err, run=lambda text="": _exec(src, text, False)[1])
    setup_err = None
    if setup.strip():
        try:
            exec(setup, env)
        except BaseException as e:
            setup_err = "The hidden test setup failed: " + _friendly(e)
    results = []
    for t in tests:
        op = t.get("op") or "equals"
        expr, exp, msg = t.get("expr") or "", t.get("expected") or "", t.get("msg") or ""
        ok, why, got = False, "", None
        try:
            if op == "source":
                ok = re.search(exp, _strip_comments(src), re.M) is not None
                if not ok:
                    why = msg or f"Your code should match /{exp}/."
            elif err and err.startswith("SyntaxError"):
                why = err
            elif setup_err:
                why = setup_err
            else:
                got = eval(expr, env)
                if op == "equals":
                    want = eval(exp, env) if exp.strip() else None
                    ok = got == want
                    if not ok and not msg:
                        why = f"Expected {want!r}, got {got!r}"
                elif op == "includes":
                    ok = str(exp) in str(got)
                    if not ok and not msg:
                        why = f"Expected it to contain {exp!r}. Got {got!r}"
                elif op == "matches":
                    ok = re.search(exp, str(got)) is not None
                    if not ok and not msg:
                        why = f"Expected it to match /{exp}/. Got {got!r}"
                else:
                    ok = bool(got)
                    if not ok and not msg:
                        why = f"Got {got!r}"
                if not ok and msg:
                    why = msg.replace("{got}", repr(got))
                if not ok and err:
                    why += "\n(Your program stopped with: " + err.split("\n")[0] + ")"
        except BaseException as e:
            why = _friendly(e)
            if err:
                why = err
        results.append({"name": t.get("name") or expr, "pass": bool(ok), "why": "" if ok else why})
    return json.dumps({"out": out, "err": err, "results": results})
`;

let py = null;
const ready = (async () => {
  const { loadPyodide } = await import(PYODIDE_URL + "pyodide.mjs");
  py = await loadPyodide({ indexURL: PYODIDE_URL });
  py.runPython(HARNESS);
  self.postMessage({ type: "ready" });
})().catch(e => { self.postMessage({ type: "failed", error: String(e && e.message || e) }); throw e; });

self.onmessage = async e => {
  const { id, kind, code, stdin, setup, tests } = e.data;
  try {
    await ready;
    const res = kind === "run"
      ? py.globals.get("__run")(code, stdin || "", setup || "")
      : py.globals.get("__check")(code, stdin || "", setup || "", JSON.stringify(tests || []));
    self.postMessage({ id, ok: true, result: JSON.parse(res) });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message || err) });
  }
};
