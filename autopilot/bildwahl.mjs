// Zeigt, welche Bilder für einen Tag infrage kommen, in Reihenfolge der Empfehlung.
//   node bildwahl.mjs [JJJJ-MM-TT]            Kandidaten für den Tag (heute, sonst das angegebene Datum), Bilder mit sichtbarem Gesicht zuerst
//   node bildwahl.mjs --verlauf <datei.jpg>   frühere Nutzungen und Texte eines Bildes (für einen neuen, anderen Text)
import fs from "node:fs";
import path from "node:path";
import { bildKonfig, kandidaten, pruefeTags, tageZwischen } from "./bildregeln.mjs";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const bibliothek = pruefeTags(JSON.parse(fs.readFileSync(path.join(HIER, "bibliothek.json"), "utf8")));
const nutzung = JSON.parse(fs.readFileSync(path.join(HIER, "nutzung.json"), "utf8"));
const konf = bildKonfig(process.env);
const arg = process.argv[2];

if (arg === "--verlauf") {
  const datei = process.argv[3];
  const frueher = nutzung.filter((n) => n.bild === datei).sort((a, b) => a.datum.localeCompare(b.datum));
  if (!frueher.length) console.log(`${datei}: noch nie verwendet.`);
  for (const n of frueher) console.log(`${n.datum} ${n.slot}: ${n.text || "(ohne Text gespeichert)"}`);
  process.exit(0);
}

const heute = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vienna" }).format(new Date());
const datum = arg || heute;
const liste = kandidaten({ bibliothek, nutzung, datum, konf });
console.log(`Bilder für ${datum} (Recycling ${konf.recycling ? `an, Abstand ${konf.abstand} Tage` : "aus"}):`);
for (const k of liste) {
  const stand = k.wiederverwendung ? `zuletzt ${k.letzte}, vor ${tageZwischen(k.letzte, datum)} Tagen` : "ungenutzt";
  // Sticker schneiden im szene-Format den Kopf ab (ausschnitt.mjs)
  const sticker = bibliothek.find((b) => b.datei === k.datei)?.art === "figur" ? ", Sticker: nur für antwort" : "";
  console.log(`- ${k.datei} (${stand}${k.gesicht === "ja" ? "" : ", Gesicht nicht gut sichtbar"}${sticker}): ${k.beschreibung}`);
}
if (!liste.length) console.log("Kein Bild passt. Neue Bilder nötig.");
