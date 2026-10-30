// A pretend terminal for "run the app from the terminal" questions.
// Settings (question.terminal):
//   tree    folders as objects, files as 1, e.g. { "Desktop": { "my-app": { "package.json": 1 } } }
//   start   the folder the terminal opens in, e.g. "Desktop"
//   app     the app's folder, e.g. "Desktop/frontend/canteen-react" (gets a package.json automatically)
//   script  how the app starts: "dev" (npm run dev, Vite) or "start" (npm start, Create React App)
export const DEFAULT_TERMINAL = {
  tree: { Desktop: { frontend: { "canteen-react": { "package.json": 1, "index.html": 1, src: {}, public: {} }, "react-basics": {} }, "notes.txt": 1 }, Documents: {}, Downloads: {} },
  start: "Desktop",
  app: "Desktop/frontend/canteen-react",
  script: "dev",
};

const split = p => String(p || "").split("/").filter(Boolean);

export function simTerminal(code, cfg = DEFAULT_TERMINAL) {
  const tree = JSON.parse(JSON.stringify(cfg.tree || {}));
  const appPath = split(cfg.app);
  { let n = tree; for (const k of appPath) n = n[k] = typeof n[k] === "object" ? n[k] : {}; n["package.json"] = 1; }
  const script = cfg.script || "dev";
  const startCmd = script === "start" ? "npm start" : `npm run ${script}`;
  let cwd = split(cfg.start), installed = false, running = false;
  const out = [], log = [];
  const say = text => out.push({ kind: "log", text }), err = text => out.push({ kind: "err", text });
  const node = path => path.reduce((n, k) => (n && typeof n === "object" ? n[k] : undefined), tree);
  const where = () => "~" + (cwd.length ? "/" + cwd.join("/") : "");
  const listing = dir => Object.keys(dir || {}).map(k => typeof dir[k] === "object" ? k + "/" : k).join("   ") || "(empty)";
  const lines = code.split("\n").flatMap(l => l.split("&&")).map(l => l.trim().replace(/^[$>]\s+/, "")).filter(l => l && !l.startsWith("#") && !l.startsWith("//"));
  for (const line of lines) {
    out.push({ kind: "cmd", text: `${where()} $ ${line}` });
    if (running) { out.push({ kind: "info", text: "(The app is still running in this terminal. In real life, press Ctrl + C to stop it first.)" }); continue; }
    const [cmd, ...args] = line.split(/\s+/), c = cmd.toLowerCase();
    const hasPkg = () => { const d = node(cwd); return !!(d && d["package.json"]); };
    const noPkg = () => err(`npm error: Could not read package.json. There is no package.json in ${where()}.\n→ Are you inside the app’s folder?`);
    const startApp = () => {
      if (!hasPkg()) return noPkg();
      if (!installed) return err(`sh: ${script === "start" ? "react-scripts" : "vite"}: command not found\n→ The packages aren’t installed yet. Run npm install first.`);
      running = true; log.push({ cmd: "start", at: cwd.join("/") });
      say(script === "start" ? "Compiled successfully!\n\n  Local:  http://localhost:3000" : "  VITE v5.4.10  ready in 412 ms\n\n  ➜  Local:   http://localhost:5173/\n  ➜  press h + enter to show help");
    };
    if (c === "cd") {
      const target = args.join(" ").replace(/^["']|["']$/g, "").replace(/\\/g, "/");
      if (!target || target === "~") { cwd = []; continue; }
      if (target.startsWith("/") || /^[a-z]:/i.test(target)) { err(`cd: ${target}: write the path from where you are, like: cd frontend`); continue; }
      let next = target.startsWith("~") ? [] : cwd.slice(), ok = true;
      for (const part of target.replace(/^~\/?/, "").split("/")) {
        if (!part || part === ".") continue;
        if (part === "..") { next.pop(); continue; }
        const d = node(next), k = d && Object.keys(d).find(x => x.toLowerCase() === part.toLowerCase());
        if (!k || typeof d[k] !== "object") { err(`cd: ${part}: ${k ? "that’s a file, not a folder" : "no such folder"}\n→ In ${"~" + (next.length ? "/" + next.join("/") : "")} there is: ${listing(d)}`); ok = false; break; }
        next.push(k);
      }
      if (ok) cwd = next;
    } else if (c === "ls" || c === "dir") say(listing(node(cwd)));
    else if (c === "pwd") say(where());
    else if (c === "clear" || c === "cls") out.length = 0;
    else if (c === "code") say("(VS Code opens this folder.)");
    else if (c === "npm") {
      const sub = (args[0] || "").toLowerCase();
      if (sub === "install" || sub === "i") {
        if (!hasPkg()) noPkg();
        else { installed = true; log.push({ cmd: "install", at: cwd.join("/") }); say("added 213 packages, and audited 214 packages in 9s\nfound 0 vulnerabilities"); }
      } else if (sub === "run" && (args[1] || "").toLowerCase() === script) startApp();
      else if (sub === "start" && script === "start") startApp();
      else if (sub === "start") { if (!hasPkg()) noPkg(); else err(`npm error: Missing script: "start"\n→ This app starts with ${startCmd}.`); }
      else if (sub === "run") err(`npm error: Missing script: "${args[1] || ""}"\n→ This app has: ${script}, build, preview`);
      else err(`npm: "${args[0] || ""}" isn’t a command this terminal knows. Try npm install or ${startCmd}.`);
    } else if (c === "npx") err("npx isn’t needed here: the app is already made. Go into its folder, install, and start it.");
    else err(`${cmd}: command not found\n→ This pretend terminal knows: cd, ls, pwd, npm install, ${startCmd}.`);
  }
  return { out, log, cwd: cwd.join("/"), count: lines.length, startCmd };
}

export function checkTerminal(q, code) {
  const cfg = { ...DEFAULT_TERMINAL, ...(q.terminal || {}) };
  const t = simTerminal(code, cfg);
  const app = split(cfg.app).join("/");
  const inst = t.log.findIndex(l => l.cmd === "install"), start = t.log.findIndex(l => l.cmd === "start");
  const startRe = cfg.script === "start" ? /npm\s+start\b/i : new RegExp(`npm\\s+run\\s+${cfg.script}\\b`, "i");
  return [
    { name: `Ends up in the folder ${app}`, pass: t.count > 0 && t.cwd === app, why: !t.count ? "Write your commands first, one per line." : `After your commands you are in ~/${t.cwd}. The app is in ~/${app}.` },
    { name: "Installs the packages: npm install (or npm i)", pass: inst !== -1, why: /npm\s+(install|i)\b/i.test(code) ? "npm install ran in a folder with no package.json. Go into the app’s folder first." : "There’s no npm install." },
    { name: `Starts the app: ${t.startCmd}`, pass: start !== -1, why: startRe.test(code) ? `${t.startCmd} didn’t work. Press Run and read the red line in the terminal.` : /npm\s+(start|run)/i.test(code) ? `This app starts with ${t.startCmd}.` : `There’s no ${t.startCmd}.` },
    { name: "Installs before it starts", pass: inst !== -1 && start !== -1 && inst < start, why: inst === -1 ? "The packages are never installed." : "The app never starts." },
  ].map(r => (r.pass ? { name: r.name, pass: true, why: "" } : r));
}
