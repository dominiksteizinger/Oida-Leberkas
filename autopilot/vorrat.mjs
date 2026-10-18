// Zählt, wie viele Bilder der Bibliothek noch nie in einem Post verwendet wurden.
// Ausgabe: unbenutzt=<Zahl> für den Workflow, der bei knappem Vorrat ein Issue an Dominik anlegt.
import fs from "node:fs";
import path from "node:path";

const HIER = path.dirname(new URL(import.meta.url).pathname);
const bibliothek = JSON.parse(fs.readFileSync(path.join(HIER, "bibliothek.json"), "utf8"));
const liste = path.join(HIER, "..", "tagebuch", "eintraege.json");
const eintraege = fs.existsSync(liste) ? JSON.parse(fs.readFileSync(liste, "utf8")) : [];
const benutzt = new Set(eintraege.flatMap((e) => [e.bild, e.bild_folie1, e.bild_folie2]).filter(Boolean));
const frei = bibliothek.filter((b) => !benutzt.has(b.datei)).map((b) => b.datei);
console.log(`Bibliothek: ${bibliothek.length} Bilder, ${frei.length} noch unbenutzt.`);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `unbenutzt=${frei.length}\ngesamt=${bibliothek.length}\n`);
