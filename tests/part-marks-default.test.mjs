import { is } from "./helpers.mjs";
import { readFileSync } from "node:fs";
const { publishSet, entryPoints } = await import("../js/lib/grade.js");

// A code question worth 4, with 4 checks. The student passes 3.
const set = { sections: [{ id: "s1", title: "A" }], questions: [
  { id: "c1", section: "s1", type: "code", title: "Code", prompt: "", lang: "js", starter: "",
    tests: [1,2,3,4].map(i => ({ name: "t"+i, expr: "1", op: "equals", expected: "1" })) }] };
const q = publishSet(set, "s").questions[0];
const three = { checks: "3/4" };
const base = { ...publishSet(set, "s"), points: 4, hintPenalty: 0.5 };

is("three checks of four, part marks on", entryPoints(three, { ...base, partMarks: true }, q), 3);
is("...and off", entryPoints(three, { ...base, partMarks: false }, q), 0);

// what a session copies from a set, now that the flag defaults to on
const sessions = readFileSync(new URL("../js/admin/sessions.js", import.meta.url), "utf8");
is("a set with no flag still gets part marks", sessions.includes("partMarks: s.partMarks !== false"), true);
const csv = readFileSync(new URL("../js/admin/csv-questions.js", import.meta.url), "utf8");
is("an uploaded set says so outright", /partMarks: true/.test(csv), true);
const editor = readFileSync(new URL("../js/admin/set-editor.js", import.meta.url), "utf8");
is("the switch reads ticked for an old set", editor.includes('set.partMarks !== false ? "checked"'), true);
is("turning it off is respected", entryPoints(three, { ...base, partMarks: false }, q), 0);
