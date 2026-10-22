// Füllt den Stimmen-Cache vorab für alle Posts in der Warteschlange, damit das Reel live keinen Gemini-Aufruf braucht.
//   node stimme-vorab.mjs [--max 100] [--pause 8]
// Reihenfolge wie beim Posten (ältestes Issue zuerst). Pro Lauf höchstens --max neue Sätze mit --pause Sekunden Abstand
// (Free-Tier-Limit von Gemini-TTS), bei einem 429 nach den Wiederholungen hört der Lauf auf. Der Workflow „Stimmen vorab“ läuft täglich weiter.
// Welche Sätze gesprochen werden, bestimmt render.mjs (schritte.json): jedes Issue wird dazu einmal gerendert.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Eintrag } from "./eintrag.mjs";
import { imCache, vorfuellen, sprechtext } from "./stimme.mjs";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const arg = (n, std) => { const k = process.argv.indexOf(`--${n}`); return k > 0 ? Number(process.argv[k + 1]) : std; };
const MAX = arg("max", 100);
const PAUSE = arg("pause", 8) * 1000;
const STIL = process.env.STIMME_STIL || undefined;
const repo = process.env.GITHUB_REPOSITORY;
const owner = process.env.GITHUB_REPOSITORY_OWNER;
if (!repo || !owner) throw new Error("GITHUB_REPOSITORY und GITHUB_REPOSITORY_OWNER fehlen");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const offen = JSON.parse(execFileSync("gh", ["issue", "list", "--repo", repo, "--label", "warteschlange", "--state", "open", "--author", owner, "--limit", "200", "--json", "number,body,createdAt"], { encoding: "utf8" }))
  .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

const saetze = [];
const gesehen = new Set();
for (const issue of offen) {
  const id = `vorab-${issue.number}`;
  const ordner = path.join(HIER, "..", "tagebuch", id);
  try {
    const post = JSON.parse(issue.body.match(/```json\s*([\s\S]*?)```/)[1]);
    const e = Eintrag.parse(post);
    fs.mkdirSync(ordner, { recursive: true });
    fs.writeFileSync(path.join(ordner, "eintrag.json"), JSON.stringify({ id, datum: "2026-11-10", slot: "07", ...e }));
    execFileSync("node", ["render.mjs", id], { cwd: HIER, stdio: "ignore" });
    const roh = JSON.parse(fs.readFileSync(path.join(ordner, "schritte.json"), "utf8"));
    for (const s of Array.isArray(roh) ? roh : roh.schritte) {
      const t = sprechtext(s.text);
      if (t && !gesehen.has(t)) { gesehen.add(t); saetze.push({ t, issue: issue.number }); }
    }
  } catch (err) {
    console.warn(`#${issue.number} übersprungen: ${err.message.split("\n")[0]}`);
  } finally {
    fs.rmSync(ordner, { recursive: true, force: true });
  }
}

const fehlend = saetze.filter((s) => !imCache(s.t, STIL));
console.log(`${offen.length} Posts, ${saetze.length} verschiedene Sätze, ${saetze.length - fehlend.length} im Cache, ${fehlend.length} fehlen.`);
let neu = 0;
for (const s of fehlend) {
  if (neu >= MAX) { console.log(`Tageslimit des Skripts (${MAX}) erreicht, der Rest kommt beim nächsten Lauf.`); break; }
  try {
    await vorfuellen(s.t, STIL);
    neu++;
    await sleep(PAUSE);
  } catch (err) {
    console.warn(`Abbruch bei #${s.issue}: ${err.message.slice(0, 200)}`);
    break;
  }
}
console.log(`Neu im Cache: ${neu}, noch offen: ${fehlend.length - neu}.`);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `neu=${neu}\noffen=${fehlend.length - neu}\n`);
