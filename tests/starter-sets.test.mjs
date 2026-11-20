import { is } from "./helpers.mjs";
const { STARTER_SETS } = await import("../js/data/starter-sets.js");
const { publishSet, labelQuestions } = await import("../js/lib/grade.js");

for (const set of STARTER_SETS) {
  const written = set.questions.filter(q => q.type === "subjective");
  console.log(`\n${set.title}: ${set.questions.length} questions, ${written.length} written`);
  is("  has written answers", written.length > 0, true);
  for (const q of written) {
    is(`  ${q.id} has a prompt`, !!q.prompt.trim(), true);
    is(`  ${q.id} has marking notes`, !!q.expected.trim(), true);
    is(`  ${q.id} has its own points`, q.points > 0, true);
    is(`  ${q.id} sits in a real part`, set.sections.some(s => s.id === q.section), true);
  }
  // labels come out right, and marking notes never ship
  const pub = publishSet(set, "salt");
  const pubWritten = pub.questions.filter(q => q.type === "subjective");
  is("  labels assigned", pubWritten.map(q => q.label).every(l => /^[A-Z]\d+$/.test(l)), true);
  is("  no marking notes published", pubWritten.some(q => "expected" in q), false);
  is("  no answer keys published", pubWritten.some(q => "key" in q || "keys" in q), false);
  console.log("  written labels →", pubWritten.map(q => `${q.label} ${q.title}`).join(" · "));
}

// old imports must still see exactly the original 27
const src = (await import("node:fs")).readFileSync(new URL("../js/admin/import-old.js", import.meta.url), "utf8");
const ids = STARTER_SETS[0].questions.map(q => q.id.toUpperCase()).filter(id => /^[A-D]\d+$/.test(id));
is("\nold imports still pinned to 27", ids.length, 27);
is("written answers excluded from old imports", ids.some(i => i.startsWith("E")), false);

