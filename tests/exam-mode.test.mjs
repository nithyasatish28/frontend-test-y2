import { is } from "./helpers.mjs";
const { publishSet, sessionSecret, cyrb53 } = await import("../js/lib/grade.js");
const { STARTER_SETS } = await import("../js/data/starter-sets.js");


const salt = "the-salt";
const set = STARTER_SETS[0];
const practice = publishSet(set, salt);
const exam = publishSet(set, salt, { exam: true });
const secret = sessionSecret(set, salt);
const blob = JSON.stringify(exam);

is("same questions in both", exam.questions.length, practice.questions.length);
is("practice ships MCQ keys", practice.questions.some(q => q.key), true);
is("exam ships NO MCQ key", exam.questions.some(q => "key" in q), false);
is("exam ships NO blank keys", exam.questions.some(q => "keys" in q), false);
is("exam ships NO expected values", exam.questions.some(q => (q.tests || []).some(t => "expected" in t)), false);
is("exam ships NO test expressions", exam.questions.some(q => (q.tests || []).some(t => "expr" in t)), false);
is("but keeps the test names as a checklist", exam.questions.find(q => q.tests?.length).tests[0].name.length > 0, true);
is("starter code still ships", exam.questions.some(q => q.starter), true);
is("hidden setup still ships (Run needs it)", exam.questions.some(q => q.setup), true);

// the real proof: brute-force the exam copy the way a student would
const mcq = exam.questions.find(q => q.type === "mcq");
let cracked = false;
for (let i = 0; i < mcq.options.length; i++) if (cyrb53(`${salt}:${mcq.id}:${i}`) === mcq.key) cracked = true;
is("an MCQ cannot be cracked: there is no key", cracked, false);

// No test's expected value ships as test data. (Question *content* may still state a target —
// "make it print X" is the task in a debugging question — which is authoring, not a key leak.)
const expectedValues = secret.questions.flatMap(q => (q.tests || []).map(t => String(t.expected ?? "").trim())).filter(v => v.length > 2);
const asTestData = exam.questions.flatMap(q => (q.tests || []).flatMap(t => Object.values(t))).map(String);
is("not one expected value ships as test data", expectedValues.filter(v => asTestData.some(x => x.includes(v))), []);
is("test objects carry nothing but a name", [...new Set(exam.questions.flatMap(q => (q.tests || []).flatMap(t => Object.keys(t))))], ["name"]);

// the instructor's copy has everything
is("secret keeps the salt", secret.salt, salt);
is("secret keeps the MCQ keys", secret.questions.filter(q => q.key).length > 0, true);
is("secret keeps the expected values", secret.questions.some(q => (q.tests || []).some(t => "expected" in t)), true);
is("secret keeps the marking notes", Object.keys(secret.notes).length, 2);
let ok = false;
const sm = secret.questions.find(q => q.id === mcq.id);
for (let i = 0; i < sm.options.length; i++) if (cyrb53(`${secret.salt}:${sm.id}:${i}`) === sm.key) ok = true;
is("and can still mark with them", ok, true);

