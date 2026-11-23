// Firebase words its errors for developers. A teacher should never see "Firebase: Error
// (auth/argument-error)." — that one reached a real user, so it is pinned here.
import { is } from "./helpers.mjs";
import { readFileSync } from "node:fs";

// friendlyError lives inside a module that fetches the Firebase SDK on import, so it is
// lifted out and run on its own.
const src = readFileSync(new URL("../js/store/firebase.js", import.meta.url), "utf8");
const block = src.slice(src.indexOf("const MESSAGES = {"), src.indexOf("const wrap = fn =>"));
const friendlyError = new Function(`${block.replace(/^export /gm, "")}; return friendlyError;`)();

const say = (code, message) => friendlyError({ code, message }).message;

is("the one a real user hit", say("auth/argument-error", "Firebase: Error (auth/argument-error)."),
   "Fill in both the email and the password.");
is("a missing password", say("auth/missing-password", "Firebase: Error (auth/missing-password)."), "Type your password.");
is("a wrong password", say("auth/invalid-credential", "Firebase: Error (auth/invalid-credential)."), "Wrong password.");
is("a blocked popup", say("auth/popup-blocked", "x").includes("Allow pop-ups"), true);
is("an unknown domain", say("auth/unauthorized-domain", "x").includes("Authorized domains"), true);

// anything we haven't thought of must still read like English
const unknown = say("auth/some-future-code", "Firebase: Error (auth/some-future-code).");
is("an unmapped code never shows Firebase's wording", /Firebase:|Error \(/.test(unknown), false);
is("...but still names the code, so it can be looked up", unknown.includes("auth/some-future-code"), true);
is("...and tells them what to do", unknown.includes("Try again"), true);

// a real sentence from Firebase is worth keeping
is("a message that actually says something is kept",
   say("auth/weird", "The password must be 6 characters long or more."),
   "The password must be 6 characters long or more.");

is("no code, no message", /Something went wrong/.test(friendlyError({}).message), true);

// the login form should never let an empty password reach Firebase in the first place
const login = readFileSync(new URL("../js/admin/login.js", import.meta.url), "utf8");
is("the login form asks for a password first", login.includes('if (!pw) { say("Type your password.")'), true);
