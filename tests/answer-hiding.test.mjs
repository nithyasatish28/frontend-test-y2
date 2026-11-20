// A failed check never names what was expected: for most questions that IS the answer, and a
// student only has to press Check on empty code to read it. The question editor still sees it.
import { is, fakeDom } from "./helpers.mjs";
await fakeDom();                       // checkJs touches window even on the plain-JS path
const { checkJs } = await import("../js/runner/js.js");
const { checkCode } = await import("../js/runner/index.js");

const q = { lang: "js", setup: "const products = [{ title: 'Notebook', price: 40 }, { title: 'Pen', price: 10 }];",
  tests: [
    { name: "filters by price", expr: "cheapTitles(products, 50)", op: "equals", expected: '["Notebook", "Pen"]' },
    { name: "contains Pen", expr: "cheapTitles(products, 50)", op: "includes", expected: "Pen" },
    { name: "the question's own words", expr: "cheapTitles(products, 50)", op: "equals", expected: '["Notebook"]',
      msg: "Check the price comparison. You gave {got}." },
  ] };

const empty = await checkJs(q, "function cheapTitles(products, maxPrice) {\n  // todo\n}");
is("empty code fails every check", empty.every(r => !r.pass), true);
is("the equals message hides the answer", empty[0].why, "Not right yet. Your code gave nothing back.\n→ Does it return a value?");
is("the includes message hides it too", empty[1].why, "Not right yet. Your code gave nothing back.\n→ Does it return a value?");
is("a question's own message still shows, with {got}", empty[2].why, "Check the price comparison. You gave undefined.");
is("no expected value anywhere", empty.some(r => /Notebook|Expected/.test(r.why)), false);

const wrong = await checkJs(q, "function cheapTitles(p, m) { return p.length; }");
is("what their code gave back is shown", wrong[0].why, "Not right yet. Your code gave back 2.");
is("still no expected value", wrong.some(r => /Notebook|Expected/.test(r.why)), false);

const right = await checkJs(q, "function cheapTitles(p, m) { return p.filter(x => x.price <= m).map(x => x.title); }");
is("a correct answer passes", right[0].pass && right[1].pass, true);

const asStudent = await checkCode(q, "function cheapTitles(p, m) { return p.length; }");
const asAuthor = await checkCode(q, "function cheapTitles(p, m) { return p.length; }", { reveal: true });
is("a student is told nothing about the expected value", /Notebook/.test(asStudent[0].why), false);
is("the question editor is, so an author can write questions", /Notebook/.test(asAuthor[0].why), true);
