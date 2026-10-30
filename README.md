# Checkpoint

A test-taking app for a class: students open the session’s link and type their **name** (no accounts), wait in a waiting room, and start together when you press Start. You watch every answer live, keep every past session, and write your own questions — multiple choice, fill in the blanks, and code in **JavaScript, React, Python** or **terminal commands**.

- `index.html` — the student page
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

Questions → *Add a starter set* is already done for you in the demo. Make a session (Sessions → New session), join as the student, press Start. "Reset demo data" in the yellow bar starts over.

## 2. Set up Firebase (about 15 minutes, once)

1. Go to <https://console.firebase.google.com> → **Add project**. Google Analytics isn't needed.
2. **Add a web app**: on the project's home page press the `</>` icon, give it a name, and copy the `firebaseConfig` it shows. Paste the values into **`js/config.js`** (replace the `PASTE_HERE` block). Also set `APP_TITLE` there.
3. **Authentication** → *Get started* → *Sign-in method*: enable **Email/Password** (for you) and **Anonymous** (for students, who only type a name) → Save.
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
   - or **GitHub Pages / any static host**, like the old version. Then add that domain in Authentication → Settings → **Authorized domains**.
7. Open **`admin.html`** on your site. The first time it shows **Set up**: create your instructor account (your real email, so you can reset the password). Do this straight away — only the first account becomes the instructor.

## 3. Running a class

1. **Questions** → *Add a starter set* (the original JS + React test, or the Python sample), upload a CSV, or make your own.
2. **Sessions** → *New session*: pick the set, the title, and the time limit.
3. Copy the session’s **Student link** from its page and share it. Every session has its own link.
4. Students open the link and type their full name. They land in the waiting room. (“Not you? Start again” lets them fix a typo before the test starts.)
5. **Live** shows who has joined. Press **Start the test** (twice, to confirm). Everyone's test opens at once and the timer is the same for all.
6. Watch the grid fill in. Click a student to see exactly what they answered. **+5 minutes** and **End the test now** work for everyone instantly. When time runs out, every open test submits itself.
7. **Download scores** or **Download all answers** (CSV, opens in Excel/Sheets).
8. Every session stays in **Sessions** — open any of them later to see the results again. For the next class, make a new session and share its new link.

**Tips**
- **The link closes when the test is over.** Students who are still on the page see their score for 10 minutes after the end; after that the link shows “This test link is closed” to everyone, so it can’t be passed on to the next batch.
- If a student closes the tab by mistake, they open the same link **on the same computer** and carry on where they were. On a different computer they’d start as a new entry.
- Anyone with the link can join under any name, so share it only with the class. Two students typing the same name show up as two separate rows.
- If a student’s test went wrong, open them in the session and press **Clear this student’s attempt**: they start again from empty (if the test is still open).
- **Forgotten instructor password**: “Forgot the password?” on the login screen emails a reset link.
- **Another instructor**: they need an account first — Firebase console → Authentication → *Add user* (their email and a password) → copy their **User UID** → Firestore → *Start collection* `admins` (if needed) → *Add document* with Document ID = that UID, fields `email` and `name`.

## 4. Writing questions

Questions → open a set. Each set has **parts** (A, B, C…) and questions inside them; labels like `B3` are made for you. Set the time limit, points per question, and the hint cost for the whole set. **Preview as a student** tries any question exactly as students see it. **Save** (or Ctrl + S) — sessions copy the questions when they're created, so editing a set never changes past results.

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

Python runs in the student's browser (Pyodide). For Python questions the hidden test setup also runs once *before* the student's code, so it can provide stand-in modules for libraries the browser doesn't have (the FastAPI questions do this with a small fake `fastapi` and `functions`). The first Python question downloads about 10 MB, then it's cached. A program that runs for more than 8 seconds is stopped (for loops that never end).

**Writing questions in Excel or Google Sheets.** Questions → **Download CSV template** gives a sheet with one example of every question type. One row is one question; the columns are `part, type, language, title, question, code, option_a…option_f, answer, any_order, solution, tests, setup, preview, input, hint`. Fill it in and use **Upload CSV**: it becomes a new question set and opens in the editor, with any problems flagged. Inside a set, **Download as CSV** gives you that set in the same format.

- `answer`: for multiple choice, the letter (`B`). For blanks, the answers in order separated by `;;`, with other accepted answers joined by `OR`: `useState ;; setLikes ;; likes + 1 OR 1 + likes`.
- `tests` (code questions): one test per line (Alt + Enter in Excel, Ctrl + Enter in Sheets), as `name | check | compare | expected | message`, where compare is `equals`, `contains`, `matches`, `is true` or `code matches`.
- Save from Excel as **CSV UTF-8**, so symbols like ₹ survive.

*Download as a file* saves a set as JSON; *Import a file* on the Question sets page loads one — handy for sharing sets with colleagues or keeping a backup.

## 5. Good to know

- **Free plan limits.** Firebase's free (Spark) plan allows 20,000 writes and 50,000 reads a day. As a rough guide, a 45-minute test with 60 students uses several thousand writes (answers plus a once-a-minute “still here” signal), so a few classes a day fit. Usage is shown in the Firebase console; the pay-as-you-go plan costs very little at this size.
- **How cheat-proof it is.** Answers are checked in the student's browser, as before: multiple-choice and blank answers are only sent as salted hashes, and the database rules stop students from reading other students' answers, opening a session’s link after it closes, changing their answers after they submit, or saving after the time limit (plus 3 minutes' grace). A student who knows browser developer tools could still fake their own score. For high-stakes exams you'd want checking on a server (Firebase Cloud Functions, which needs the pay-as-you-go plan).
- **Old results**: Sessions → **Import old results** brings in the latest class straight from the old Google Sheet (old web app URL + admin key), or older classes from the CSV files the old admin page downloaded. Each one appears as a past session. Do this after Firebase is set up, so they're saved to your account.

## How it's built

Plain HTML, CSS and JavaScript modules — no build step. Everything you'd change is in small files:

```
index.html, admin.html     the two pages
css/                       base.css (shared), student.css, admin.css
js/config.js               your Firebase details and app title  ← edit this
js/store/                  the data layer: firebase.js (real), demo.js (in-browser), index.js picks one
js/lib/                    grade.js (scoring, hashing, sessions' copy of questions), markdown, highlight, util
js/runner/                 runs and checks code: js.js (JS + React), python.js + python-worker.js, terminal.js
js/ui/                     question.js (draws a question for students and previews), editor.js (code editor)
js/student/                app.js (login → session), test.js (waiting room, test, saving, timer), login.js, gate.js
js/admin/                  app.js (login + tabs), session-view.js (Live), sessions.js, sets.js,
                           set-editor.js (question editor), students.js, login.js, dialog.js
js/data/starter-sets.js    the two starter sets
firestore.rules            database security rules (paste into Firebase)
firebase.json              settings for `firebase deploy`
```
