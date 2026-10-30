// Tiny syntax colouring for JavaScript/JSX, Python and shell commands.
import { esc } from "./util.js";

const JS = /(\/\/.*$|\/\*[\s\S]*?\*\/)|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?|`(?:[^`\\]|\\.)*`?)|(<\/?[A-Za-z][\w.]*|\/>)|\b(const|let|var|function|return|if|else|for|of|in|while|do|switch|case|break|continue|true|false|null|undefined|new|typeof|import|from|export|default|async|await|class|extends|try|catch|throw)\b|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_$][\w$]*)(?=\s*\()/gm;
const PY = /(#.*$)|("""[\s\S]*?(?:"""|$)|'''[\s\S]*?(?:'''|$)|[rbfuRBFU]{0,2}"(?:[^"\\\n]|\\.)*"?|[rbfuRBFU]{0,2}'(?:[^'\\\n]|\\.)*'?)|(@[A-Za-z_][\w.]*)|\b(def|return|if|elif|else|for|while|in|not|and|or|is|import|from|as|class|True|False|None|lambda|pass|break|continue|try|except|finally|raise|with|yield|global|nonlocal|del|assert|async|await)\b|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_][\w]*)(?=\s*\()/gm;
const SH = /(#.*$)|("(?:[^"\\\n]|\\.)*"?|'[^'\n]*'?)|(^\s*[\w.-]+)|\b(npm|npx|cd|ls|pwd|node|git|run|install)\b|\b(\d+)\b|()/gm;

const CLS = ["t-c", "t-s", "t-tag", "t-k", "t-n", "t-f"];

export function highlight(src, lang = "js") {
  const re = lang === "python" ? PY : lang === "shell" || lang === "terminal" ? SH : lang === "text" ? null : JS;
  if (!re) return esc(src);
  re.lastIndex = 0;
  let out = "", last = 0, m;
  while ((m = re.exec(src))) {
    if (m[0] === "") { re.lastIndex++; continue; }
    out += esc(src.slice(last, m.index));
    let i = 1; while (i < m.length && m[i] === undefined) i++;
    const cls = lang === "python" && i === 3 ? "t-f" : lang !== "python" && lang !== "js" && lang !== "react" && i === 3 ? "t-f" : CLS[i - 1];
    out += `<span class="${cls}">${esc(m[0])}</span>`;
    last = re.lastIndex;
  }
  return out + esc(src.slice(last));
}

export const langOf = q => (q.lang === "react" ? "js" : q.lang || "js");
