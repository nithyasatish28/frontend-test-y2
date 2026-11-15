# vendor/

The three libraries the pages load with a plain `<script>` tag, kept in the repo instead of
fetched from a CDN at run time. A test must not depend on cdnjs being reachable from the
college network while it is in progress, and these files never change under us.

| File | Library | Version | Used for |
|---|---|---|---|
| `react.production.min.js` | React | 18.3.1 | running React answers, and the preview in the question editor |
| `react-dom.production.min.js` | React DOM | 18.3.1 | same |
| `babel.min.js` | @babel/standalone | 7.23.5 | JSX → JavaScript, and syntax errors with line numbers for plain JS |

They are loaded as globals (`React`, `ReactDOM`, `Babel`) — see `js/runner/js.js`.

## Refreshing them

Keep the version numbers here, in the table above, and in the comment at the top of
`index.html` and `admin.html` in step with each other.

```sh
cd vendor
curl -O https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js
curl -O https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js
curl -O https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js
```

Then open a React question and a plain JavaScript question in the question editor and press
**Run the tests on the model answer**. If Babel is broken you get "The JSX helper didn't load".

## Still from a CDN

**Pyodide** (Python in the browser) is still fetched from jsDelivr — see `PYODIDE_URL` in
`js/config.js`. It is about 20 MB across many files, which is more than Firebase Hosting's free
daily transfer allowance can serve to a class. To self-host it anyway, download the release from
<https://github.com/pyodide/pyodide/releases>, unpack it into `vendor/pyodide/`, and set
`PYODIDE_URL = "vendor/pyodide/"`.

**The Firebase SDK** (`js/store/firebase.js`) and **Google Fonts** come from Google's own servers.
Self-hosting them buys nothing: if Google is unreachable, Firestore is unreachable too, and the
app has nothing to talk to. The fonts fall back to system faces on their own (`css/base.css`).
