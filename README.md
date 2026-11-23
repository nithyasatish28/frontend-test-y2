# Checkpoint

A test-taking app for a class: students open the session’s link and type their **name** (no accounts), wait in a waiting room, and start together when you press Start. You watch every answer live, keep every past session, and write your own questions — multiple choice, fill in the blanks, and code in **JavaScript, React, Python** or **terminal commands**.

- `test.html` — the student page (the bare web address is the instructor page)
- `admin.html` — the instructor page (Live · Sessions · Questions · Students)

Data lives in **Firebase** (free plan is enough for a class). Until you add your Firebase details, the app runs in **demo mode**, with everything stored in your browser.

---

## 1. Try it first (demo mode, 2 minutes)

The pages are JavaScript modules, so they need a small web server (double-clicking the file won't work). In this folder:

```
npx serve .
```
(or `python -m http.server 8000`), then open:

- `http://localhost:3000/admin.html` — log in with **demo@example.com / demo1234**
- make a session, then open its **student link** in another tab and type a name

The starter sets are already there. Make a session (Sessions → New session), join as the student, press Start. "Reset demo data" in the yellow bar starts over.

## 2. Set up Firebase (about 15 minutes, once)

1. Go to <https://console.firebase.google.com> → **Add project**. Google Analytics isn't needed.
2. **Add a web app**: on the project's home page press the `</>` icon, give it a name, and copy the `firebaseConfig` it shows. Paste the values into **`js/config.js`** (replace the `PASTE_HERE` block). Also set `APP_TITLE` there.
3. **Authentication** → *Get started* → *Sign-in method*: enable **Google** and **Email/Password** (both for instructors) and **Anonymous** (for students, who only type a name) → Save. For Google, pick a support email when it asks; nothing else needs changing.
4. **Firestore Database** → *Create database* → pick a location near you (for India: `asia-south1`, Mumbai) → **production mode**.
5. Firestore → **Rules** tab → delete what's there, paste the whole of **`firestore.rules`**, press **Publish**. (The app doesn't work until the rules are published.)
6. **Put the folder online.** Either:
   - **Firebase Hosting** (this folder is ready for it):
     ```
     npm install -g firebase-tools
     firebase login
     firebase use --add          # pick your project
     firebase deploy             # uploads the pages and the rules
     ```
     Your site is `https://<project-id>.web.app`.

     **Your own web address.** Firebase console → Hosting → *Add custom domain* → type the address you want (`checkpoint.yourschool.edu`). It gives you a TXT record to prove you own the domain, then the records to point at it; add those wherever your DNS lives. The certificate is free and automatic. Two things to watch: if your DNS is on **Cloudflare**, set those records to **DNS only** (grey cloud, not the orange one) or the certificate can't be issued; and whatever address you end up on, add it under **Authentication → Settings → Authorized domains**, or nobody will be able to log in.
   - or **GitHub Pages / any static host**, like the old version. Then add that domain in Authentication → Settings → **Authorized domains**.
7. Open **`admin.html`** on your site. The first time it shows **Set up**: make your instructor account with your **@atriauniversity.edu.in** email. Firebase emails you a link; open it, come back, and press *I've done that*. You become the instructor. Do this straight away — the first account is the only one that lets itself in.

## 3. Running a class

1. **Questions** — the two starter sets (the original JS + React test and a Python sample) are already there the first time you look, as your own copies to change or delete. You can also upload a CSV or make a set from scratch.
2. **Sessions** → *New session*: pick the set, the title, and the time limit. Two choices here decide how the test behaves:
   - **Exam** — nothing that could give an answer away is sent to the student's browser: no answer keys, no expected values for the code checks. Students answer and submit; the app marks nothing. You mark afterwards and release the results. Leave it off for practice, where the test marks itself as students go and they see straight away how they did.
   - **Mark written answers while the test is running** — see step 8.
3. Copy the session’s **Student link** from its page and share it. Every session has its own link.
4. Students open the link and type their full name. They land in the waiting room. (“Not you? Start again” lets them fix a typo before the test starts.)
5. **Live** shows who has joined. Press **Start the test** (twice, to confirm). Everyone's test opens at once and the timer is the same for all.
6. Watch the grid fill in. Click a student to see exactly what they answered. **+5 minutes** and **End the test now** work for everyone instantly. When time runs out, every open test submits itself.
7. **For an exam**: when it has ended, press **Mark this test**. Every multiple-choice, blanks and code answer is marked against the copy kept back from the students, and the results written. Then **Release results to students** — they can open their link and see what they scored, which option was right, and the accepted answers for any blanks they got wrong. The link stays open for **6 hours** after the test ends.
8. **Download scores** or **Download all answers** (CSV, opens in Excel/Sheets).
9. **Written answers** are marked by you, not the app. When you make the session you choose when: leave *Mark written answers while the test is running* off and you mark each student once they submit (or once the test ends); switch it on and every written question gets its own **Hand in this answer** button, so the moment a student presses it the answer locks and appears in **Mark written answers** for you to score. That suits a long paper you want to mark as it comes in. You can change your mind from inside the marking window. (A mark also remembers the text it was given for, so if an answer ever does change afterwards it is flagged *answered again since you marked it*.)
10. **Re-grade & verify** (next to the download buttons) marks every answer again from what the students actually typed and lists anything that disagrees with the mark their browser saved. Worth a look after every test: it is what catches a faked score. Once the test has ended you can apply the corrections in one press. Tick *Re-run code tests too* to re-run each student's saved code as well — thorough, but slow.
11. Every session stays in **Sessions** — open any of them later to see the results again. For the next class, make a new session and share its new link.

**Tips**
- **The link closes when the test is over.** Students who are still on the page see their score for 10 minutes after the end; after that the link shows “This test link is closed” to everyone, so it can’t be passed on to the next batch.
- If a student closes the tab by mistake, they open the same link **on the same computer** and carry on where they were. On a different computer they’d start as a new entry.
- Anyone with the link can join under any name, so share it only with the class. Two students typing the same name show up as two separate rows.
- If a student’s test went wrong, open them in the session and press **Clear this student’s attempt**: they start again from empty (if the test is still open).
- **Forgotten instructor password**: “Forgot the password?” on the login screen emails a reset link.
- **Another instructor**: they do it themselves now. On `admin.html` they press *Create an instructor account*, use their **@atriauniversity.edu.in** email, open the link Firebase sends them, and ask to be let in. You approve them on the **Instructors** tab — the tab shows a count when someone is waiting. Until you approve, they can't see a single question, answer or score. You can also remove an instructor there (but not yourself).

## 3a. Who can be an instructor

Instructors sign themselves up, with three gates in the way:

Instructors can sign in with **Google** (one press, no password to remember) or with an email and password. Either way the same three gates apply:

1. **The email domain.** Only `@atriauniversity.edu.in` addresses. Set in two places that must agree: `INSTRUCTOR_EMAIL_DOMAIN` in `js/config.js` (for the message on screen) and `workEmail()` in `firestore.rules` (which is the one that actually enforces it). Change both, then publish the rules again.
2. **The email itself.** With Google that is settled by signing in. With a password they have to open the link Firebase sends, so either way only someone who can read that mailbox gets in. A made-up address on the right domain gets nowhere.
3. **The super admin.** One person approves every request, on the **Instructors** tab. Not any instructor — only the super admin. Signing in is not the same as being let in: anyone with a work address can reach the waiting room, and no further.

The Google button asks Google to show only `@atriauniversity.edu.in` accounts, which is a convenience rather than a lock — someone could still arrive with a personal address. They are told it can't be made an instructor, and the database refuses them everything regardless of how they signed in.

Gate 3 is there because at most universities students have an address on the same domain as staff. Without it, any student could make themselves an instructor and read every answer. If your students are on a *different* domain and you'd rather skip approval, change the `pendingAdmins` rule in `firestore.rules` so a verified work email may write its own `admins/{uid}` document, and have `login.js` call that instead of `requestAccess()`.

Anyone can still make a Firebase account with any email — that is just a login, and it gets them exactly what a student with no link gets: nothing.

### The super admin

**The first account you set up is the super admin.** There is nothing to create: if you already set this app up, your account is it, and you don't need to change anything in Firestore. You can check which one it is in the Firebase console → Firestore → `meta/owner`.

Only the super admin can:

- let a new instructor in, or decline them (nobody else can even see the waiting list)
- remove an instructor
- make another instructor a super admin, or take that back

Everyone else is an ordinary instructor: they get **Live**, **Sessions** and **Questions**, and that is all. There is no Instructors tab for them, and the rules refuse them the list as well, so they never see another instructor's name or email address — not in the page, and not through the browser console either.

### Everyone's work is their own

Each instructor sees only the question sets and sessions **they** made, and only their own students' answers. The super admin sees everything, so they can help when something goes wrong; next to another instructor's set or session they see whose it is.

This is enforced by the database, not just hidden in the page: a question set carries the `ownerUid` of whoever made it, and the rules only hand over a document to its owner or the super admin.

**The first time you open the Instructors tab after updating**, anything made before this — your existing sets and sessions — will be listed as having no owner, with a button to make them yours. Nobody else can see them until you do.

**Make a second super admin.** If you are the only one and you lose your account, nobody can ever approve anyone again. On the **Instructors** tab, press *Make super admin* next to someone you trust with the whole app. Nobody can change their own role, so you cannot lock yourself out by accident.

**Handing it over** (leaving, or changing email): make the new person a super admin first, then they remove your account. If you have already lost access to the only super admin account, recover it in the Firebase console: Firestore → `admins` → the document whose id matches the person you want → add a field `role` with the value `super`.

## 4. Writing questions

Questions → open a set. Each set has **parts** (A, B, C…) and questions inside them; labels like `B3` are made for you. Set the time limit, the default points per question, and the hint cost for the whole set. Any question can have its own **Points** (in the editor, or the `points` column of the CSV); leave it empty to use the default. **Preview as a student** tries any question exactly as students see it. **Save** (or Ctrl + S) — sessions copy the questions when they're created, so editing a set never changes past results.

- **Multiple choice**: optional code shown above, 2–8 options, mark the correct one. Use `` `backticks` `` for code in options.
- **Fill in the blanks**: write the code with `__1__`, `__2__`… where the blanks go (*Insert a blank* does this), then list the accepted answers for each blank, one per line. Spaces and a final `;` are ignored; capitals count. Tick *any order* when blanks can be swapped (like `{ name, block }`).
- **Code** (JavaScript, React, Python, or Terminal): starter code, a model answer (only you see it), and **tests**. Each test has a name students see, something to check, and how to compare it:

  | Language | “Check this” example | Compare | Expected |
  |---|---|---|---|
  | JavaScript | `cheapTitles(products, 50)` | is equal to | `["Notebook", "Pen"]` |
  | React | `(await render(Menu)).count("li")` | is equal to | `4` |
  | React + fetch | `(await render(UserList, {}, { reply: USERS })).text` | contains the text | `Grace` |
  | Python | `even_numbers([1, 2, 3, 4])` | is equal to | `[2, 4]` |
  | Python + input() | `run("10\n-2")` | contains the text | `Sum: 8` |
  | Any | — | their code matches the pattern | `\bfor\b` |

  Sample data used by tests (like `products` or `USERS`) goes in **Hidden test setup**. The “How … tests work” box under Tests lists everything you can use. Always press **Run the tests on the model answer** (all should pass) and **…on the starter code** (they shouldn't).
- **Terminal** questions play the students' commands in a pretend terminal; set the folders, where it opens, the app's folder, and whether it starts with `npm run dev` (Vite) or `npm start`. The checks are built in.

Python runs in the student's browser (Pyodide). For Python questions the hidden test setup runs once *before* the student's code, and **everything it defines is there for the student's program to use** — so a setup that builds a `df` lets you write "`df` is already loaded" in the question. It can also provide stand-in modules for libraries the browser doesn't have (the FastAPI questions do this with a small fake `fastapi` and `functions`). The first Python question downloads about 10 MB, then it's cached. A program that runs for more than 8 seconds is stopped (for loops that never end).

**Libraries like pandas.** `import pandas` works, and so does numpy and the rest of what Pyodide ships. The app reads the imports in the question's setup and the student's code, fetches only what is actually imported, and keeps it for the rest of the session. It is a real download — about 7.5 MB for pandas and what it needs (numpy, dateutil, pytz, six), on top of Python itself — so the student sees "Loading pandas…" the first time, and the 8-second limit is paused while it downloads rather than counting against the program. For a class, expect the first run of a pandas question to take a while on each machine; everything after that is instant. If a package isn't in Pyodide at all, the hidden-setup stand-in trick above is still the way.

**Writing questions in Excel or Google Sheets.** Questions → **Download CSV template** gives a sheet with one example of every question type. One row is one question; the columns are `part, type, points, language, title, question, code, option_a…option_f, answer, any_order, solution, tests, setup, preview, input, hint`. Fill it in and use **Upload CSV**: it becomes a new question set and opens in the editor, with any problems flagged. Inside a set, **Download as CSV** gives you that set in the same format.

- `answer`: for multiple choice, the letter (`B`). For blanks, the answers in order separated by `;;`, with other accepted answers joined by `OR`: `useState ;; setLikes ;; likes + 1 OR 1 + likes`.
- `tests` (code questions): one test per line (Alt + Enter in Excel, Ctrl + Enter in Sheets), as `name | check | compare | expected | message`, where compare is `equals`, `contains`, `matches`, `is true` or `code matches`.
- Save from Excel as **CSV UTF-8**, so symbols like ₹ survive.

*Download as a file* saves a set as JSON, as a quick backup. To move a set between people or projects, use **Download as CSV** and **Upload CSV** — the CSV carries everything a set holds and can be read and edited in a spreadsheet.

## 5. Good to know

- **Free plan limits.** Firebase's free (Spark) plan allows 20,000 writes and 50,000 reads a day. As a rough guide, a 45-minute test with 60 students uses several thousand writes (answers plus a once-a-minute “still here” signal), so a few classes a day fit. Usage is shown in the Firebase console; the pay-as-you-go plan costs very little at this size.
- **Part marks.** A question set can give part marks (it's a switch on the set, on for new ones): 3 of 4 blanks right is worth three quarters of the question, and so is 3 of 4 checks passing. A student who once passed every check keeps the whole mark even if they edit afterwards and break something — nobody loses a mark they had already earned.

- **How cheat-proof it is.** Answers are checked in the student's browser, as before: multiple-choice and blank answers are only sent as salted hashes, and the database rules stop students from reading other students' answers, opening a session’s link after it closes, changing their answers after they submit, or saving after the time limit (plus 3 minutes' grace).

  Two things worth being clear about.

  **A faked mark can be found afterwards.** A student who knows browser developer tools can write a “correct” mark for their own answer. But what they typed is saved too, and the session keeps the answer keys — so **Re-grade & verify** in the session marks everything again and shows you where the saved mark disagrees. Use it after every test. (Hints can't be checked this way, and a code answer that passed and was then edited is honestly ambiguous — both are reported as “couldn't be checked” rather than guessed at.)

  **The hashes are not a lock — so use Exam for anything that matters.** In an ordinary session the browser has to mark the answers, so it has to hold something to mark them against. The salt sits on the session, and a multiple-choice answer is one of at most eight options, so it can be worked out by trying each one. Code questions ship their tests, because the code runs in the browser. Re-grading cannot see any of this: the student really did pick the right option.

  **Exam** mode removes all of it. No keys, no expected values, no salt — the browser is given nothing to mark with, because it does no marking. That is the setting to use for a test that counts. (What a question's own words give away is still up to you: if the starter code says `// should print 110`, students read that. The question editor warns you when a *test name* contains its expected value, since students see those too.)
- **Old results**: Sessions → **Import old results** brings in the latest class straight from the old Google Sheet (old web app URL + admin key), or older classes from the CSV files the old admin page downloaded. Each one appears as a past session. Do this after Firebase is set up, so they're saved to your account.

## How it's built

Plain HTML, CSS and JavaScript modules — no build step. Everything you'd change is in small files:

```
admin.html, test.html      the two pages: admin.html is served at the bare address,
                           test.html is what a session link opens
css/                       base.css (shared), student.css, admin.css
js/config.js               your Firebase details and app title  ← edit this
js/store/                  the data layer: firebase.js (real), demo.js (in-browser), index.js picks one
js/lib/                    grade.js (scoring, hashing, sessions' copy of questions), markdown, highlight, util
js/runner/                 runs and checks code: js.js (JS + React), python.js + python-worker.js, terminal.js
js/ui/                     question.js (draws a question for students and previews), editor.js (code editor)
js/student/                app.js (login → session), test.js (waiting room, test, saving, timer), login.js, gate.js
js/admin/                  app.js (login + tabs), session-view.js (Live), sessions.js, sets.js,
                           set-editor.js (question editor), regrade.js (marks every answer again),
                           instructors.js (who can get in), csv-questions.js, import-old.js,
                           login.js (login, signing up, approval), dialog.js
js/data/starter-sets.js    the two starter sets
vendor/                    React, React DOM and Babel, kept here instead of loaded from a CDN
firestore.rules            database security rules (paste into Firebase)
firebase.json              settings for `firebase deploy`
```

## Tests

```
npm install     # once, for the tests that drive the pages (jsdom)
npm test
```

Twenty files under `tests/`, run by `tests/run.mjs`. No framework: `is(name, got, want)` from
`tests/helpers.mjs`, which also provides the browser stand-ins. The ones that need a DOM skip
themselves with a note if `npm install` hasn't been run, so `npm test` works either way.

They cover the parts that fail silently and expensively: scoring and part marks, answer keys and
what an exam does *not* send to a student, marking and re-grading, registration and the super
admin, who can see whose work, and the student's page driven for real — typing an answer, handing
it in, a mark arriving. `firebase.json` keeps `tests/`, `package.json` and `node_modules/` out of
anything deployed.
