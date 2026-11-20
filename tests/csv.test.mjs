import { is } from "./helpers.mjs";
const { setToRows, rowsToCSV, rowsToSet, COLUMNS } = await import("../js/admin/csv-questions.js");
const { STARTER_SETS } = await import("../js/data/starter-sets.js");
const { parseCSV } = await import("../js/admin/import-old.js");


// ── the downloadable template ──
const src = (await import("node:fs")).readFileSync(new URL("../js/admin/csv-questions.js", import.meta.url), "utf8");
const examples = src.slice(src.indexOf("const EXAMPLES"), src.indexOf("export const downloadTemplate"));
is("template includes a written row", /type: "subjective"/.test(examples), true);

// ── full round trip: a real set → CSV → back to a set ──
const set = STARTER_SETS[0];
const csv = rowsToCSV(setToRows(set));
const back = rowsToSet(parseCSV(csv));
const w0 = set.questions.filter(q => q.type === "subjective");
const w1 = back.questions.filter(q => q.type === "subjective");

is("no import problems", back.problems, []);
is("same number of questions", back.questions.length, set.questions.length);
is("written answers survive the trip", w1.length, w0.length);
is("prompt survives", w1[0].prompt, w0[0].prompt);
is("marking notes survive", w1[0].expected, w0[0].expected);
is("the note under the box survives", w1[0].guidance, w0[0].guidance);
is("the code block survives", w1[0].code, w0[0].code);
is("points survive", w1[0].points, w0[0].points);
is("part name survives", back.sections.map(s => s.title).includes("Written answers"), true);

// ── the words people actually type in the type column ──
// one value per column, in COLUMNS order — solution = marking notes, preview = the note under the box
const row = Object.fromEntries(COLUMNS.map(c => [c, ""]));
Object.assign(row, { part: "Theory", type: "written", points: "4", language: "text",
  title: "Explain", question: "Why?", solution: "my notes", preview: "three sentences" });
const rows = [COLUMNS, COLUMNS.map(c => row[c])];
const typed = rowsToSet(rows);
is('"written" imports as subjective', typed.questions[0].type, "subjective");
is("...with the notes as marking notes", typed.questions[0].expected, "my notes");
is("...and the guidance", typed.questions[0].guidance, "three sentences");
is("...and its points", typed.questions[0].points, 4);

