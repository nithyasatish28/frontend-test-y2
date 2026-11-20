// Which database the page talks to. Getting this wrong once meant a "demo" page quietly
// writing to the real project, so the cases are pinned.
import { is } from "./helpers.mjs";

const cases = [
  ["?demo", "#/instructors", true, "the documented way"],
  ["", "#/instructors?demo", true, "written after the hash"],
  ["?s=abc&demo=1", "", true, "a demo student link"],
  ["", "#/live", false, "a plain admin page"],
  ["", "", false, "no parameters at all"],
  ["?s=abc", "", false, "a real student link"],
  ["?demonstration=1", "", false, "a lookalike parameter"],
];
for (const [search, hash, want, label] of cases) {
  globalThis.location = { search, hash };
  const { isDemo } = await import(`../js/config.js?v=${Math.random()}`);
  is(`${label}  (search "${search}" hash "${hash}")`, isDemo(), want);
}
