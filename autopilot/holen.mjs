// Holt den nächsten fertigen Post aus der Warteschlange: offene Issues mit Label „warteschlange“, ältestes zuerst.
// Nur Issues vom Repo-Owner zählen: Die Vorlage „Fertiger Post“ setzt das Label auch bei Fremden, das Repo ist öffentlich.
// Der Post steht als JSON-Block im Issue (Aufbau siehe eintrag.mjs und README). Ergebnis: tagebuch/<id>/eintrag.json
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Eintrag } from "./eintrag.mjs";
import { OHNE_BILD } from "./formate.mjs";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const WURZEL = path.join(HIER, "..");
const [id, datum, slot] = process.argv.slice(2);
if (!id || !datum || !slot) throw new Error("Aufruf: node holen.mjs <id> <datum> <slot>");
const repo = process.env.GITHUB_REPOSITORY;
const gh = (...args) => execFileSync("gh", args, { encoding: "utf8" });
const ausgabe = (zeilen) => process.env.GITHUB_OUTPUT && fs.appendFileSync(process.env.GITHUB_OUTPUT, zeilen);

const bibliothek = new Set(JSON.parse(fs.readFileSync(path.join(HIER, "bibliothek.json"), "utf8")).map((b) => b.datei));
const musik = new Set(JSON.parse(fs.readFileSync(path.join(HIER, "musik.json"), "utf8")).map((m) => m.datei));

function pruefe(body) {
  const block = body.match(/```json\s*([\s\S]*?)```/);
  if (!block) throw new Error("Kein ```json-Block im Issue");
  const roh = JSON.parse(block[1]);
  const e = Eintrag.parse(roh);
  if (!OHNE_BILD.has(e.inhalt.format) && !e.bild) throw new Error(`Format ${e.inhalt.format} braucht ein Bild`);
  if (e.bild && !bibliothek.has(e.bild)) throw new Error(`Bild ${e.bild} gibt es nicht in bibliothek.json`);
  if (e.musik && !musik.has(e.musik)) throw new Error(`Musik ${e.musik} gibt es nicht in musik.json`);
  return { e, wunschSlot: roh.slot ? String(roh.slot) : null };
}

// Nur Issues vom Repo-Owner: Die Vorlage „Fertiger Post“ setzt das Label automatisch, auch bei Fremden.
const owner = process.env.GITHUB_REPOSITORY_OWNER;
if (!owner) throw new Error("GITHUB_REPOSITORY_OWNER fehlt");
const offen = JSON.parse(gh("issue", "list", "--repo", repo, "--label", "warteschlange", "--state", "open", "--author", owner, "--limit", "100", "--json", "number,body,createdAt"))
  .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

const passend = [];
for (const issue of offen) {
  try {
    const { e, wunschSlot } = pruefe(issue.body);
    if (!wunschSlot || wunschSlot === slot) passend.push({ issue, e });
  } catch (err) {
    console.error(`Issue #${issue.number} übersprungen: ${err.message}`);
    gh("issue", "comment", String(issue.number), "--repo", repo, "--body", `Konnte diesen Post nicht lesen: ${err.message}`);
    gh("issue", "edit", String(issue.number), "--repo", repo, "--remove-label", "warteschlange", "--add-label", "fehler");
  }
}

if (!passend.length) {
  console.log(`Warteschlange leer (${offen.length} offen, keiner passt zu ${slot} Uhr).`);
  ausgabe("gefunden=false\n");
  process.exit(0);
}

const { issue, e } = passend[0];
const ordner = path.join(WURZEL, "tagebuch", id);
fs.mkdirSync(ordner, { recursive: true });
fs.writeFileSync(path.join(ordner, "eintrag.json"), JSON.stringify({ id, datum, slot, ...e, quelle: `#${issue.number}` }, null, 2) + "\n");
console.log(`Post aus #${issue.number} (${e.inhalt.format}), noch ${passend.length - 1} in der Warteschlange.`);
ausgabe(`gefunden=true\nissue=${issue.number}\nrest=${passend.length - 1}\n`);
