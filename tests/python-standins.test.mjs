// The browser has no PyJWT, so a question about tokens could never run. The Python harness
// carries a stand-in — installed only when the real package is missing, so a future Pyodide
// release wins automatically. The harness is Python inside a JavaScript string, so a typo here
// breaks every Python question at once: this file runs it for real.
import { is } from "./helpers.mjs";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const src = readFileSync(new URL("../js/runner/python-worker.js", import.meta.url), "utf8");
const harness = src.match(/const HARNESS = String\.raw`([\s\S]*?)`;/)[1];
is("the harness has no JavaScript interpolation in it", harness.includes("${"), false);

const run = py => {
  try { return { out: execFileSync("python3", ["-c", py], { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim(), ok: true }; }
  catch (e) { return { out: String(e.stderr || e.message), ok: false }; }
};
const withHarness = body => run(`
import sys, json
sys.modules["jwt"] = None            # the browser has no PyJWT
exec(compile(${JSON.stringify(harness)}, "harness.py", "exec"), {"__name__": "__harness__"})
${body}`);

is("the harness compiles and runs", withHarness('print("ok")').out, "ok");
is("import jwt works with no setup at all", withHarness('import jwt; print(jwt.__name__)').out, "jwt");

const round = withHarness(`
import jwt
from datetime import datetime, timedelta, timezone
t = jwt.encode({"username": "asha", "token_type": "access",
                "exp": datetime.now(timezone.utc) + timedelta(minutes=15)}, "SECRET123", algorithm="HS256")
b = jwt.decode(t, "SECRET123", algorithms=["HS256"])
print(t.count("."), b["username"], b["token_type"], isinstance(b["exp"], int))`);
is("a token round-trips, with exp as an int like PyJWT", round.out, "2 asha access True");

const raises = withHarness(`
import jwt, time
t = jwt.encode({"username": "asha"}, "SECRET123")
def who(fn):
    try: fn(); return "nothing"
    except Exception as e: return type(e).__name__
print(who(lambda: jwt.decode(t, "WRONG")),
      who(lambda: jwt.decode("rubbish", "SECRET123")),
      who(lambda: jwt.decode(jwt.encode({"exp": time.time() - 60}, "SECRET123"), "SECRET123")))`);
is("it refuses a bad key, rubbish, and an expired token", raises.out,
   "InvalidSignatureError InvalidTokenError ExpiredSignatureError");

is("the exceptions are the ones questions catch",
   withHarness('import jwt; print(issubclass(jwt.ExpiredSignatureError, jwt.PyJWTError), hasattr(jwt, "DecodeError"))').out,
   "True True");

// and the real package must always win
const real = run(`
import sys, json
exec(compile(${JSON.stringify(harness)}, "harness.py", "exec"), {"__name__": "__harness__"})
import jwt
print("standin" if getattr(jwt, "__file__", None) is None else "real")`);
is("a real PyJWT is left alone when one exists", real.ok ? ["real", "standin"].includes(real.out) : false, true);
