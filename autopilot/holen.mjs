// Holt den nächsten fertigen Post aus der Warteschlange: offene Issues mit Label „warteschlange“, Posts mit Ablaufdatum zuerst, sonst ältestes zuerst.
// Nur Issues vom Repo-Owner zählen: Die Vorlage „Fertiger Post“ setzt das Label auch bei Fremden, das Repo ist öffentlich.
// Der Post steht als JSON-Block im Issue (Aufbau siehe eintrag.mjs und README). Ergebnis: tagebuch/<id>/eintrag.json
// Prüft außerdem die Bildregeln (Saison, Mindestabstand, kein identischer Text) und trägt die Nutzung in nutzung.json ein.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Eintrag } from "./eintrag.mjs";
import { OHNE_BILD } from "./formate.mjs";
import { bildKonfig, pruefeBild, pruefeTags, verbuchen } from "./bildregeln.mjs";
import { pruefeWortfilter } from "./wortfilter.mjs";
import { mechanikLesen, pruefeQuote, verlaufLesen } from "./humorquote.mjs";
import { reihenfolge } from "./reihenfolge.mjs";
import { bildMass, pruefeAusschnitt } from "./ausschnitt.mjs";
import { zielgruppeLesen, pruefeZielgruppe, zgVerlaufLesen, sortiereKandidaten } from "./zielgruppe.mjs";

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
  // Wortfilter: Leberkäse/Semmel nie in Text, Caption oder Hashtags (nur im Bild erlaubt)
  pruefeWortfilter(e);
  if (!OHNE_BILD.has(e.inhalt.format) && !e.bild) throw new Error(`Format ${e.inhalt.format} braucht ein Bild`);
  if (e.bild && !bekannt.has(e.bild)) throw new Error(`Bild ${e.bild} gibt es nicht in bibliothek.json`);
  // Kopf muss im Bild bleiben (Sticker im szene-Format schneiden ihn ab, ausschnitt.mjs)
  if (e.bild) {
    const b = bibliothek.find((x) => x.datei === e.bild);
    let mass = null;
    try { mass = bildMass(path.join(HIER, "bilder", e.bild)); } catch {}
    const ausschnitt = pruefeAusschnitt(e, b, mass);
    if (ausschnitt.length) throw new Error(ausschnitt.join("; "));
  }
  // ab/bis (optional, JJJJ-MM-TT): Post nur in diesem Zeitraum, z. B. für Anlässe (Allerheiligen, Martinstag)
  for (const k of ["ab", "bis"]) if (roh[k] !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(roh[k])) throw new Error(`${k} muss JJJJ-MM-TT sein`);
  // trend und annahme wandern ins Tagebuch, damit die Auswertung danach gruppieren kann (messung.mjs)
  const merkmale = Object.fromEntries(["trend", "annahme"].filter((k) => typeof roh[k] === "string" && roh[k].trim()).map((k) => [k, roh[k].trim()]));
  return { e, merkmale, mechanik: mechanikLesen(roh), ...zielgruppeLesen(roh), wunschSlot: roh.slot ? String(roh.slot) : null, ab: roh.ab || null, bis: roh.bis || null };
}

// Nur Issues vom Repo-Owner: Die Vorlage „Fertiger Post“ setzt das Label automatisch, auch bei Fremden.
const owner = process.env.GITHUB_REPOSITORY_OWNER;
if (!owner) throw new Error("GITHUB_REPOSITORY_OWNER fehlt");
// ISSUE (optional, z. B. per Hand gestartet): nur dieser Post, sonst der älteste passende.
const gewaehlt = process.env.ISSUE ? Number(process.env.ISSUE) : null;
const offen = JSON.parse(gh("issue", "list", "--repo", repo, "--label", "warteschlange", "--state", "open", "--author", owner, "--limit", "100", "--json", "number,body,createdAt"))
  .filter((issue) => !gewaehlt || issue.number === gewaehlt)
  .sort(reihenfolge);

const ablehnen = (issue, meldung) => {
  console.error(`Issue #${issue.number} übersprungen: ${meldung}`);
  gh("issue", "comment", String(issue.number), "--repo", repo, "--body", meldung);
  gh("issue", "edit", String(issue.number), "--repo", repo, "--remove-label", "warteschlange", "--add-label", "fehler");
};

// Unter den Posts, die zum Slot und zu den Quoten passen, kommt der dran, den sortiereKandidaten vorne sieht und dessen Bild passt. Bildregel-Fehler landen wie ungültige Posts im Label „fehler“.
let gefunden = null;
let zurueck = null; // erster Post, den eine Quote zurückstellt; kommt nur dran, wenn nichts anderes passt
// Mechaniken und Zielgruppen der zuletzt gepostenden Posts
const verlauf = verlaufLesen(path.join(WURZEL, "tagebuch"), id);
const zgVerlauf = zgVerlaufLesen(path.join(WURZEL, "tagebuch"), id);
const kandidaten = [];
let gelesen = 0;
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
  gelesen++;
  if ((p.wunschSlot && p.wunschSlot !== slot) || (p.ab && datum < p.ab)) continue;
  // Humor-Quote: zu oft dieselbe Mechanik hintereinander → zurückstellen. Anlass-Posts (ab/bis) laufen immer, sonst verpassen sie ihren Tag.
  // Zielgruppen-Quote (zielgruppe.mjs) genauso: zu oft dieselbe Lebenslage oder Region → zurückstellen.
  const quote = pruefeQuote(verlauf, p.mechanik);
  const zg = pruefeZielgruppe(zgVerlauf, p);
  const grund = !quote.ok ? `Humor-Quote: ${quote.grund}` : !zg.ok ? `Zielgruppen-Quote: ${zg.grund}` : null;
  const k = { issue, p, e: p.e, merkmale: p.merkmale, mechanik: p.mechanik, zielgruppe: p.zielgruppe, region: p.region, rang: kandidaten.length, datiert: !!(p.ab || p.bis) };
  if (grund && !p.ab && !p.bis) {
    console.log(`#${issue.number} zurückgestellt, ${grund}.`);
    zurueck = zurueck || { ...k, warnung: grund };
    continue;
  }
  kandidaten.push(k);
}
for (const k of sortiereKandidaten(kandidaten, zgVerlauf)) {
  if (k.e.bild) {
    const regel = pruefeBild({ bibliothek, nutzung, bild: k.e.bild, datum, konf, id, e: k.e });
    if (!regel.ok) {
      ablehnen(k.issue, `Bild passt nicht: ${regel.grund}. Bitte den Post mit einem anderen Bild oder neuem Text neu anlegen (Bildwahl: node autopilot/bildwahl.mjs ${datum}).`);
      gelesen--;
      continue;
    }
  }
  gefunden = k;
  break;
}
let quoteWarnung = "";
if (!gefunden && zurueck?.e.bild && !pruefeBild({ bibliothek, nutzung, bild: zurueck.e.bild, datum, konf, id, e: zurueck.e }).ok) {
  ablehnen(zurueck.issue, `Bild passt nicht mehr zum heutigen Tag. Bitte den Post mit einem anderen Bild neu anlegen (Bildwahl: node autopilot/bildwahl.mjs ${datum}).`);
  gelesen--;
  zurueck = null;
}
if (!gefunden && zurueck) {
  // Nichts anderes da: lieber posten als ausfallen, aber Dominik bekommt die Warnung (Schritt im Workflow)
  gefunden = zurueck;
  quoteWarnung = `#${zurueck.issue.number}: ${zurueck.warnung}`;
  console.log(`::warning::Quote verletzt, weil nichts anderes in der Warteschlange passt: ${quoteWarnung}`);
}

if (!gefunden) {
  console.log(`Warteschlange leer (${offen.length} offen, keiner passt zu ${slot} Uhr).`);
  ausgabe("gefunden=false\n");
  process.exit(0);
}

const { issue, e } = gefunden;
const verbleibend = gelesen - 1;
const ordner = path.join(WURZEL, "tagebuch", id);
fs.mkdirSync(ordner, { recursive: true });
fs.writeFileSync(path.join(ordner, "eintrag.json"), JSON.stringify({ id, datum, slot, ...e, ...(gefunden.mechanik ? { mechanik: gefunden.mechanik } : {}), ...(gefunden.zielgruppe ? { zielgruppe: gefunden.zielgruppe } : {}), region: gefunden.region || "dach", ...gefunden.merkmale, ...(gefunden.p.ab || gefunden.p.bis ? { anlass: { ab: gefunden.p.ab, bis: gefunden.p.bis } } : {}), quelle: `#${issue.number}` }, null, 2) + "\n");
if (e.bild) {
  nutzung = verbuchen(nutzung, { id, datum, slot, bild: e.bild, e });
  fs.writeFileSync(nutzungDatei, JSON.stringify(nutzung, null, 2) + "\n");
}
console.log(`Post aus #${issue.number} (${e.inhalt.format}), noch ${verbleibend} in der Warteschlange.`);
ausgabe(`gefunden=true\nissue=${issue.number}\nrest=${verbleibend}\nquote_warnung=${quoteWarnung}\n`);
