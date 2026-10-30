// A light code editor: a transparent textarea over a coloured copy of the code.
import { highlight } from "../lib/highlight.js";

export function createEditor(host, { value = "", lang = "js", readOnly = false, label = "Code", height, onChange, onCtrlEnter } = {}) {
  const indentUnit = lang === "python" ? "    " : "  ";
  host.innerHTML = `
    <div class="editor"${height ? ` style="height:${height}px"` : ""}>
      <div class="gutter" aria-hidden="true"></div>
      <div class="code-wrap"><pre aria-hidden="true"></pre><textarea spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="${label}"></textarea></div>
    </div>`;
  const ta = host.querySelector("textarea"), hl = host.querySelector("pre"), gutter = host.querySelector(".gutter");
  ta.value = value; ta.readOnly = readOnly;
  const hlLang = lang === "react" ? "js" : lang === "terminal" ? "shell" : lang;
  const syncScroll = () => { hl.scrollTop = ta.scrollTop; hl.scrollLeft = ta.scrollLeft; gutter.scrollTop = ta.scrollTop; };
  const paint = () => {
    hl.innerHTML = highlight(ta.value, hlLang) + "\n ";
    gutter.textContent = Array.from({ length: ta.value.split("\n").length }, (_, i) => i + 1).join("\n");
    syncScroll();
  };
  const insert = t => {
    ta.focus();
    if (!document.execCommand || !document.execCommand("insertText", false, t)) { ta.setRangeText(t, ta.selectionStart, ta.selectionEnd, "end"); ta.dispatchEvent(new Event("input")); }
  };
  ta.addEventListener("input", () => { paint(); onChange && onChange(ta.value); });
  ta.addEventListener("scroll", syncScroll);
  ta.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); onCtrlEnter && onCtrlEnter(); return; }
    if (ta.readOnly) return;
    if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); insert(indentUnit); return; }
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const before = ta.value.slice(0, ta.selectionStart), line = before.slice(before.lastIndexOf("\n") + 1);
      let ind = line.match(/^\s*/)[0];
      if (lang === "python" ? /:\s*(#.*)?$/.test(line) : /[{(\[>]\s*$/.test(line) && !/\/>\s*$/.test(line)) ind += indentUnit;
      e.preventDefault(); insert("\n" + ind); return;
    }
    if (e.key === "}" && lang !== "python") {
      const before = ta.value.slice(0, ta.selectionStart), line = before.slice(before.lastIndexOf("\n") + 1);
      if (/^\s{2,}$/.test(line)) { e.preventDefault(); ta.setSelectionRange(ta.selectionStart - 2, ta.selectionStart); insert("}"); }
    }
  });
  paint();
  return {
    get value() { return ta.value; },
    set value(v) { ta.value = v; paint(); },
    setReadOnly(b) { ta.readOnly = b; },
    focus() { ta.focus(); },
    textarea: ta,
  };
}
