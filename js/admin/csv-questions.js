// Questions as a spreadsheet: download a template, fill it in Excel or Google Sheets, upload it.
// One row = one question. Columns:
//
//   part        the part it belongs to, e.g. "Multiple choice". Parts appear in the order they first show up.
//   type        mcq | blanks | code          ("debugging" also works: it's a code question)
//   language    mcq/blanks: js, python, shell or text (for colouring)   code: js, react, python or terminal
//   title       a few words
//   question    what students read (Markdown: **bold**, `code`, - lists)
//   code        mcq: code shown above the options · blanks: code with __1__, __2__ … · code: the starter code
//   option_a … option_f    mcq options
//   answer      mcq: the letter of the right option (A–F)
//               blanks: the answers in blank order, separated by ;;   other accepted answers with OR
//                       e.g.   useState ;; setLikes ;; 0 ;; likes + 1 OR 1 + likes
//   any_order   blanks: yes if the blanks can be swapped
//   solution    code: the model answer (only you see it)
//   tests       code: one test per line:   name | check | compare | expected | message (optional)
//               (a | with a space on both sides separates the parts, so JavaScript’s || is safe)
//               compare is one of: equals, contains, matches, is true, code matches
//   setup       code: hidden test setup (sample data). Terminal questions: settings as JSON (optional)
//   preview     react: the component shown in the preview (default App)
//   input       python: sample input for input(), one line each
//   hint        optional
import { esc, uid as randomId, download, csvLine, toast } from "../lib/util.js";
import { blankNumbers } from "../lib/grade.js";
import { DEFAULT_TERMINAL } from "../runner/terminal.js";
import { parseCSV } from "./import-old.js";
import { dialog } from "./dialog.js";

export const COLUMNS = ["part", "type", "language", "title", "question", "code", "option_a", "option_b", "option_c", "option_d", "option_e", "option_f",
  "answer", "any_order", "solution", "tests", "setup", "preview", "input", "hint"];
const LETTERS = "ABCDEF";
const OPS_OUT = { equals: "equals", includes: "contains", matches: "matches", truthy: "is true", source: "code matches" };
const OPS_IN = { equals: "equals", "is equal to": "equals", "==": "equals", contains: "includes", includes: "includes", "contains the text": "includes",
  matches: "matches", "matches the pattern": "matches", "is true": "truthy", true: "truthy", truthy: "truthy",
  "code matches": "source", source: "source", "their code matches the pattern": "source" };

/* ─────────── set → rows (for export) ─────────── */
export function setToRows(set) {
  const secTitle = id => (set.sections.find(s => s.id === id) || {}).title || "";
  return set.questions.map(q => {
    const r = Object.fromEntries(COLUMNS.map(c => [c, ""]));
    Object.assign(r, { part: secTitle(q.section), type: q.type, title: q.title || "", question: q.prompt || "", hint: q.hint || "" });
    if (q.type === "mcq") {
      r.language = q.codeLang || "js"; r.code = q.code || "";
      (q.options || []).slice(0, 6).forEach((o, i) => (r["option_" + "abcdef"[i]] = o));
      r.answer = LETTERS[q.answer] || "";
    } else if (q.type === "blanks") {
      r.language = q.lang || "js"; r.code = q.code || ""; r.any_order = q.anyOrder ? "yes" : "";
      r.answer = blankNumbers(q.code).map(n => ((q.blanks || []).find(b => Number(b.n) === n)?.accept || []).filter(a => String(a).trim()).join(" OR ")).join(" ;; ");
    } else {
      r.language = q.lang || "js"; r.code = q.starter || ""; r.solution = q.solution || ""; r.preview = q.lang === "react" ? q.preview || "App" : "";
      r.input = q.stdin || "";
      r.setup = q.lang === "terminal" ? JSON.stringify(q.terminal || DEFAULT_TERMINAL) : q.setup || "";
      r.tests = (q.tests || []).map(t => [t.name || "", t.op === "source" ? "" : t.expr || "", OPS_OUT[t.op || "equals"], t.op === "truthy" ? "" : t.expected || "", t.msg || ""]
        .join(" | ").replace(/( \| )+$/, "")).join("\n");
    }
    return r;
  });
}
export const rowsToCSV = rows => "﻿" + [csvLine(COLUMNS)].concat(rows.map(r => csvLine(COLUMNS.map(c => r[c] ?? "")))).join("\r\n");

/* ─────────── rows → set (for upload) ─────────── */
const yes = v => /^(y|yes|true|1|x)$/i.test(String(v || "").trim());
function normLang(v, forCode) {
  const s = String(v || "").trim().toLowerCase();
  if (/^(py|python)/.test(s)) return "python";
  if (forCode && /^(react|jsx)/.test(s)) return "react";
  if (/^(terminal|shell|bash|sh|cmd)/.test(s)) return forCode ? "terminal" : "shell";
  if (!forCode && /^(text|plain|none)/.test(s)) return "text";
  return "js";
}
function normType(v) {
  const s = String(v || "").trim().toLowerCase();
  if (/^(mcq|multiple|choice)/.test(s)) return "mcq";
  if (/^(blank|fill)/.test(s)) return "blanks";
  if (/^(code|debug|program|write)/.test(s)) return "code";
  return null;
}

export function rowsToSet(table) {
  const head = (table[0] || []).map(h => String(h).trim().toLowerCase().replace(/\s+/g, "_"));
  const col = name => head.indexOf(name);
  if (col("type") === -1 || col("title") === -1) throw new Error("This doesn’t look like the question template: it needs at least the columns type and title. Download the template to see the layout.");
  const get = (r, name) => { const i = col(name); return i === -1 ? "" : String(r[i] ?? "").replace(/\r\n/g, "\n"); };
  const sections = [], questions = [], problems = [];
  const sectionFor = title => {
    const t = title.trim() || "Questions";
    let s = sections.find(x => x.title.toLowerCase() === t.toLowerCase());
    if (!s) { s = { id: "s" + randomId(6), title: t }; sections.push(s); }
    return s.id;
  };
  table.slice(1).forEach((r, k) => {
    const rowNo = k + 2;                                   // as Excel numbers it, with the header on row 1
    if (!r.some(x => String(x).trim())) return;
    const type = normType(get(r, "type"));
    if (!type) { problems.push(`Row ${rowNo}: type “${get(r, "type")}” isn’t mcq, blanks or code, so it was skipped.`); return; }
    const q = { id: "q" + randomId(8), section: sectionFor(get(r, "part")), type, title: get(r, "title").trim(), prompt: get(r, "question").trim(), hint: get(r, "hint").trim() };
    if (!q.title) problems.push(`Row ${rowNo}: has no title.`);
    if (type === "mcq") {
      q.code = get(r, "code").replace(/\s+$/, ""); q.codeLang = normLang(get(r, "language"), false);
      q.options = "abcdef".split("").map(l => get(r, "option_" + l).trim()).filter(Boolean);
      const a = get(r, "answer").trim().toUpperCase();
      q.answer = /^[A-F]$/.test(a) ? LETTERS.indexOf(a) : /^[1-6]$/.test(a) ? Number(a) - 1 : -1;
      if (q.options.length < 2) problems.push(`Row ${rowNo}: multiple choice needs at least 2 options.`);
      if (!(q.answer >= 0 && q.answer < q.options.length)) { problems.push(`Row ${rowNo}: answer should be the letter of an option (A–${LETTERS[Math.max(1, q.options.length - 1)]}).`); q.answer = 0; }
    } else if (type === "blanks") {
      q.code = get(r, "code").replace(/\s+$/, ""); q.lang = normLang(get(r, "language"), false); q.anyOrder = yes(get(r, "any_order"));
      const nums = blankNumbers(q.code);
      const parts = get(r, "answer").split(/\s*;;\s*|\n/).map(s => s.trim());
      q.blanks = nums.map((n, i) => ({ n, accept: (parts[i] || "").split(/\s+OR\s+/).map(s => s.trim()).filter(Boolean) }));
      if (!nums.length) problems.push(`Row ${rowNo}: the code has no blanks. Write __1__, __2__ where they go.`);
      else if (parts.filter(Boolean).length !== nums.length) problems.push(`Row ${rowNo}: the code has ${nums.length} blank${nums.length === 1 ? "" : "s"} but the answer has ${parts.filter(Boolean).length}. Separate them with ;;`);
    } else {
      q.lang = normLang(get(r, "language"), true);
      q.starter = get(r, "code"); q.solution = get(r, "solution"); q.setup = ""; q.preview = q.lang === "react" ? (get(r, "preview").trim() || "App") : "";
      if (q.lang === "python" && get(r, "input")) q.stdin = get(r, "input");
      if (q.lang === "terminal") {
        q.terminal = JSON.parse(JSON.stringify(DEFAULT_TERMINAL));
        const s = get(r, "setup").trim();
        if (s) { try { Object.assign(q.terminal, JSON.parse(s)); } catch { problems.push(`Row ${rowNo}: the terminal settings in setup aren’t valid JSON, so the default folders were used.`); } }
        q.tests = [];
      } else {
        q.setup = get(r, "setup");
        q.tests = get(r, "tests").split("\n").map(s => s.trim()).filter(Boolean).map((line, j) => {
          const [name = "", expr = "", cmp = "", expected = "", ...msg] = line.split(/(?<=\s)\|(?=\s)/).map(s => s.trim());
          const op = OPS_IN[cmp.toLowerCase()];
          if (!op) problems.push(`Row ${rowNo}, test ${j + 1}: compare “${cmp}” should be equals, contains, matches, is true or code matches.`);
          return { name: name || expr, expr: op === "source" ? "" : expr, op: op || "equals", expected, msg: msg.join(" | ") };
        });
        if (!q.tests.length) problems.push(`Row ${rowNo}: code question has no tests, so it can never be marked correct.`);
      }
    }
    questions.push(q);
  });
  if (!questions.length) throw new Error("No questions found. Fill in at least one row under the header.");
  return { sections, questions, problems };
}

/* ─────────── the template ─────────── */
const EXAMPLES = [
  { part: "Multiple choice", type: "mcq", language: "js", title: "Destructuring an object", question: "What is `price` after this line?",
    code: 'const { name, price } = { name: "Dosa", price: 60 };', option_a: "`undefined`", option_b: "`60`", option_c: '`"price"`', option_d: "An error", answer: "B",
    hint: "Destructuring pulls out each property by its name." },
  { part: "Multiple choice", type: "mcq", language: "python", title: "range", question: "Which numbers does this print?",
    code: "for i in range(1, 4):\n    print(i)", option_a: "0, 1, 2, 3", option_b: "1, 2, 3", option_c: "1, 2, 3, 4", answer: "B" },
  { part: "Fill in the blanks", type: "blanks", language: "js", title: "useState", question: "A like button that starts at 0 and goes up by 1.",
    code: 'import { __1__ } from "react";\n\nfunction LikeButton() {\n  const [likes, __2__] = useState(__3__);\n  return <button onClick={() => setLikes(__4__)}>❤️ {likes}</button>;\n}',
    answer: "useState ;; setLikes ;; 0 ;; likes + 1 OR 1 + likes" },
  { part: "Fill in the blanks", type: "blanks", language: "js", title: "Destructuring", question: "Fill in the blanks so the console shows `Kavya C`.",
    code: 'const student = { name: "Kavya", block: "C" };\nconst { __1__, __2__ } = student;\nconsole.log(name, block);', answer: "name OR block ;; name OR block", any_order: "yes" },
  { part: "Write the code", type: "code", language: "js", title: "Cheap titles",
    question: "Write `cheapTitles(products, maxPrice)`. It gives back a **new array** with the title of every product whose price is ≤ `maxPrice`.",
    code: "function cheapTitles(products, maxPrice) {\n  // your code\n}\n",
    solution: "function cheapTitles(products, maxPrice) {\n  return products.filter(p => p.price <= maxPrice).map(p => p.title);\n}\n",
    setup: 'const products = [{ title: "Notebook", price: 40 }, { title: "Backpack", price: 900 }, { title: "Pen", price: 10 }];',
    tests: 'cheapTitles(products, 50) → ["Notebook", "Pen"] | cheapTitles(products, 50) | equals | ["Notebook", "Pen"]\nNothing cheap enough → [] | cheapTitles(products, 5) | equals | []\nA price equal to maxPrice counts | cheapTitles(products, 40) | equals | ["Notebook", "Pen"] | Got {got}. Use <= so 40 counts.' },
  { part: "Write the code", type: "code", language: "react", title: "A greeting card", preview: "App",
    question: "Write `Greeting` that shows `Hello, {name}!` in an `<h2>`, using the `name` prop. Use it in `App`.",
    code: "function Greeting(/* props */) {\n  return <h2></h2>;\n}\n\nfunction App() {\n  return <Greeting name=\"Priya\" />;\n}\n",
    solution: "function Greeting({ name }) {\n  return <h2>Hello, {name}!</h2>;\n}\n\nfunction App() {\n  return <Greeting name=\"Priya\" />;\n}\n",
    tests: 'Shows the name | (await render(Greeting, { name: "Ada" })).texts("h2") | equals | ["Hello, Ada!"]\nUses destructuring | | code matches | Greeting\\s*\\(\\s*\\{ | Write function Greeting({ name }).' },
  { part: "Write the code", type: "code", language: "python", title: "Add two numbers", input: "3\n4",
    question: "Read two numbers with `input()` and print `Sum: 7`.",
    code: 'a = input("First number: ")\n', solution: 'a = int(input("First number: "))\nb = int(input("Second number: "))\nprint("Sum:", a + b)\n',
    tests: 'With 3 and 4 | OUTPUT | contains | Sum: 7\nWith 10 and -2 | run("10\\n-2") | contains | Sum: 8\nUses int() | | code matches | \\bint\\s*\\( | Turn the text into a number with int().' },
  { part: "Debugging", type: "code", language: "python", title: "Counting vowels",
    question: "`count_vowels(\"banana\")` should be 3. Fix the **one line** that is wrong.",
    code: 'def count_vowels(word):\n    count = 0\n    for letter in word:\n        if letter in "aeiou":\n            count = 1\n    return count\n',
    solution: 'def count_vowels(word):\n    count = 0\n    for letter in word:\n        if letter in "aeiou":\n            count = count + 1\n    return count\n',
    tests: 'banana → 3 | count_vowels("banana") | equals | 3\nsky → 0 | count_vowels("sky") | equals | 0',
    hint: "count = 1 sets it to 1 every time." },
  { part: "Debugging", type: "code", language: "terminal", title: "Run the app",
    question: "You are in **Desktop**. Your Vite app is in `Desktop/frontend/canteen-react`. Go into it, install the packages and start it.",
    code: "# You are in: Desktop\n", solution: "cd frontend/canteen-react\nnpm install\nnpm run dev\n",
    setup: '{"start": "Desktop", "app": "Desktop/frontend/canteen-react", "script": "dev"}' },
];
export const downloadTemplate = () => download("question-template.csv", rowsToCSV(EXAMPLES), "text/csv");
export const downloadSetCSV = set => download(`${(set.title || "questions").replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}.csv`, rowsToCSV(setToRows(set)), "text/csv");

/* ─────────── upload dialog ─────────── */
export async function uploadCSV(ctx, file) {
  let parsed;
  try { parsed = rowsToSet(parseCSV(await file.text())); }
  catch (e) { toast(e.message, "err"); return; }
  const { sections, questions, problems } = parsed;
  const byType = t => questions.filter(q => q.type === t).length;
  const d = dialog(`
    <div class="dlg-body">
      <h2>New question set from ${esc(file.name)}</h2>
      <p style="margin-top:0">Found <b>${questions.length} question${questions.length === 1 ? "" : "s"}</b> in ${sections.length} part${sections.length === 1 ? "" : "s"}
        (${byType("mcq")} multiple choice · ${byType("blanks")} blanks · ${byType("code")} code).</p>
      ${problems.length ? `<div class="issues"><b>Check these after importing</b> (they’re also flagged in the editor):<ul>${problems.slice(0, 10).map(p => `<li>${esc(p)}</li>`).join("")}${problems.length > 10 ? `<li>…and ${problems.length - 10} more</li>` : ""}</ul></div>` : ""}
      <label class="field"><span>Set title</span><input data-title value="${esc(file.name.replace(/\.csv$/i, "").replace(/[-_]+/g, " "))}"></label>
      <div class="form-grid cols-3">
        <label class="field"><span>Minutes</span><input data-min type="number" min="1" max="300" value="45"></label>
        <label class="field"><span>Points</span><input data-pts type="number" min="0.5" step="0.5" value="1"></label>
        <label class="field"><span>Hint cost</span><input data-hint type="number" min="0" step="0.25" value="0.5"></label>
      </div>
      <p class="err" data-err></p>
    </div>
    <div class="dlg-foot"><button class="btn ghost" data-close type="button">Cancel</button><button class="btn" data-go type="button">Create the set</button></div>`);
  const $ = s => d.el.querySelector(s);
  $("[data-go]").addEventListener("click", async e => {
    const btn = e.currentTarget;
    if (!$("[data-title]").value.trim()) { $("[data-err]").textContent = "Give the set a title."; return; }
    btn.disabled = true;
    try {
      const id = await ctx.store.saveSet(null, {
        title: $("[data-title]").value.trim(), description: `Imported from ${file.name}`,
        minutes: Math.round(Number($("[data-min]").value)) || 45, points: Number($("[data-pts]").value) || 1, hintPenalty: Number($("[data-hint]").value) || 0,
        sections, questions,
      });
      d.close("ok"); toast("Question set created. Run the tests on each code question’s model answer to be sure.");
      ctx.go("#/questions/" + id);
    } catch (ex) { $("[data-err]").textContent = ex.message; btn.disabled = false; }
  });
  await d.done;
}
