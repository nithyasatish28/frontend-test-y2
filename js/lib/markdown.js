// A small, safe Markdown for question prompts and options.
//   **bold**  *italic*  `code`  [link](https://…)
//   - bullet   1. numbered   > tip box   ```js fenced code```
import { esc } from "./util.js";
import { highlight } from "./highlight.js";

export function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, "$1<i>$2</i>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

export function markdown(src) {
  const lines = String(src || "").replace(/\r/g, "").split("\n");
  let out = "", i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = line.match(/^```\s*(\w+)?\s*$/);
    if (fence) {
      const body = []; i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++]);
      i++;
      out += `<pre class="show">${highlight(body.join("\n"), fence[1] || "js")}</pre>`;
      continue;
    }
    if (/^\s*$/.test(line)) { i++; continue; }
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ""));
      out += `<ul>${items.map(t => `<li>${inline(t)}</li>`).join("")}</ul>`;
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ""));
      out += `<ol>${items.map(t => `<li>${inline(t)}</li>`).join("")}</ol>`;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const body = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ""));
      out += `<p class="tip">${inline(body.join(" "))}</p>`;
      continue;
    }
    const para = [];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(```|>|\s*[-*]\s|\s*\d+[.)]\s)/.test(lines[i])) para.push(lines[i++]);
    out += `<p>${inline(para.join(" "))}</p>`;
  }
  return out;
}
