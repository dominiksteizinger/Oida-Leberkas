// Holt den nächsten fertigen Post aus der Warteschlange: offene Issues mit Label „warteschlange“, ältestes zuerst.
// Nur Issues vom Repo-Owner zählen: Die Vorlage „Fertiger Post“ setzt das Label auch bei Fremden, das Repo ist öffentlich.
// Der Post steht als JSON-Block im Issue (Aufbau siehe eintrag.mjs und README). Ergebnis: tagebuch/<id>/eintrag.json
// Prüft außerdem die Bildregeln (Saison, Mindestabstand, kein identischer Text) und trägt die Nutzung in nutzung.json ein.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Eintrag } from "./eintrag.mjs";
import { OHNE_BILD } from "./formate.mjs";
import { bildKonfig, pruefeBild, pruefeTags, verbuchen } from "./bildregeln.mjs";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const WURZEL = path.join(HIER, "..");
const [id, datum, slot] = process.argv.slice(2);
if (!id || !datum || !slot) throw new Error("Aufruf: node holen.mjs <id> <datum> <slot>");
const repo = process.env.GITHUB_REPOSITORY;
const gh = (...args) => execFileSync("gh", args, { encoding: "utf8" });
const ausgabe = (zeilen) => process.env.GITHUB_OUTPUT && fs.appendFileSync(process.env.GITHUB_OUTPUT, zeilen);

const bibliothek = pruefeTags(JSON.parse(fs.readFileSync(path.join(HIER, "bibliothek.json"), "utf8")));
const bekannt = new Set(bibliothek.map((b) => b.datei));
const nutzungDatei = path.join(HIER, "nutzung.json");
let nutzung = JSON.parse(fs.readFileSync(nutzungDatei, "utf8"));
const konf = bildKonfig(process.env);

function pruefe(body) {
  const block = body.match(/```json\s*([\s\S]*?)```/);
  if (!block) throw new Error("Kein ```json-Block im Issue");
  const roh = JSON.parse(block[1]);
  const e = Eintrag.parse(roh);
  if (!OHNE_BILD.has(e.inhalt.format) && !e.bild) throw new Error(`Format ${e.inhalt.format} braucht ein Bild`);
  if (e.bild && !bekannt.has(e.bild)) throw new Error(`Bild ${e.bild} gibt es nicht in bibliothek.json`);
  // ab/bis (optional, JJJJ-MM-TT): Post nur in diesem Zeitraum, z. B. für Anlässe (Allerheiligen, Martinstag)
  for (const k of ["ab", "bis"]) if (roh[k] !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(roh[k])) throw new Error(`${k} muss JJJJ-MM-TT sein`);
  return { e, wunschSlot: roh.slot ? String(roh.slot) : null, ab: roh.ab || null, bis: roh.bis || null };
}

// Nur Issues vom Repo-Owner: Die Vorlage „Fertiger Post“ setzt das Label automatisch, auch bei Fremden.
const owner = process.env.GITHUB_REPOSITORY_OWNER;
if (!owner) throw new Error("GITHUB_REPOSITORY_OWNER fehlt");
// ISSUE (optional, z. B. per Hand gestartet): nur dieser Post, sonst der älteste passende.
const gewaehlt = process.env.ISSUE ? Number(process.env.ISSUE) : null;
const offen = JSON.parse(gh("issue", "list", "--repo", repo, "--label", "warteschlange", "--state", "open", "--author", owner, "--limit", "100", "--json", "number,body,createdAt"))
  .filter((issue) => !gewaehlt || issue.number === gewaehlt)
  .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

const ablehnen = (issue, meldung) => {
  console.error(`Issue #${issue.number} übersprungen: ${meldung}`);
  gh("issue", "comment", String(issue.number), "--repo", repo, "--body", meldung);
  gh("issue", "edit", String(issue.number), "--repo", repo, "--remove-label", "warteschlange", "--add-label", "fehler");
};

// Der erste Post, der zum Slot passt und die Bildregeln erfüllt. Bildregel-Fehler landen wie ungültige Posts im Label „fehler“.
let gefunden = null;
let verbleibend = 0;
for (const issue of offen) {
  let p;
  try {
    p = pruefe(issue.body);
  } catch (err) {
    ablehnen(issue, `Konnte diesen Post nicht lesen: ${err.message}`);
    continue;
  }
  if (p.bis && datum > p.bis) {
    ablehnen(issue, `Der Anlass ist vorbei: Post nur bis ${p.bis}, heute ist ${datum}. Bei Bedarf ohne „bis“ neu anlegen.`);
    continue;
  }
  if ((p.wunschSlot && p.wunschSlot !== slot) || (p.ab && datum < p.ab)) { verbleibend++; continue; }
  if (gefunden) { verbleibend++; continue; }
  if (p.e.bild) {
    const regel = pruefeBild({ bibliothek, nutzung, bild: p.e.bild, datum, konf, id, e: p.e });
    if (!regel.ok) {
      ablehnen(issue, `Bild passt nicht: ${regel.grund}. Bitte den Post mit einem anderen Bild oder neuem Text neu anlegen (Bildwahl: node autopilot/bildwahl.mjs ${datum}).`);
      continue;
    }
  }
  gefunden = { issue, e: p.e };
}

if (!gefunden) {
  console.log(`Warteschlange leer (${offen.length} offen, keiner passt zu ${slot} Uhr).`);
  ausgabe("gefunden=false\n");
  process.exit(0);
}

const { issue, e } = gefunden;
const ordner = path.join(WURZEL, "tagebuch", id);
fs.mkdirSync(ordner, { recursive: true });
fs.writeFileSync(path.join(ordner, "eintrag.json"), JSON.stringify({ id, datum, slot, ...e, quelle: `#${issue.number}` }, null, 2) + "\n");
if (e.bild) {
  nutzung = verbuchen(nutzung, { id, datum, slot, bild: e.bild, e });
  fs.writeFileSync(nutzungDatei, JSON.stringify(nutzung, null, 2) + "\n");
}
console.log(`Post aus #${issue.number} (${e.inhalt.format}), noch ${verbleibend} in der Warteschlange.`);
ausgabe(`gefunden=true\nissue=${issue.number}\nrest=${verbleibend}\n`);
