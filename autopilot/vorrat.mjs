// Zählt, wie viele Bilder für den Tag noch passen (Saison, Mindestabstand, Recycling-Regeln aus bildregeln.mjs).
// Ausgabe für den Workflow: frei=<Zahl> (passende Bilder heute), unbenutzt=<Zahl>, gesamt=<Zahl>.
// Der Workflow legt bei frei < VORRAT_WARNUNG ein Issue an Dominik an.
// Aufruf: node vorrat.mjs [JJJJ-MM-TT], sonst heute (Wiener Zeit)
import fs from "node:fs";
import path from "node:path";
import { bildKonfig, kandidaten, pruefeTags } from "./bildregeln.mjs";

const VORRAT_WARNUNG = 7;
const HIER = path.dirname(new URL(import.meta.url).pathname);
const bibliothek = pruefeTags(JSON.parse(fs.readFileSync(path.join(HIER, "bibliothek.json"), "utf8")));
const nutzung = JSON.parse(fs.readFileSync(path.join(HIER, "nutzung.json"), "utf8"));
const heute = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vienna" }).format(new Date());
const datum = process.argv[2] || heute;
const konf = bildKonfig(process.env);

const frei = kandidaten({ bibliothek, nutzung, datum, konf });
const unbenutzt = frei.filter((k) => !k.wiederverwendung).length;
console.log(`Bildvorrat für ${datum}: ${frei.length} passende Bilder, davon ${unbenutzt} noch ungenutzt (von ${bibliothek.length}). Recycling ${konf.recycling ? `an, Abstand ${konf.abstand} Tage` : "aus"}. Warnung unter ${VORRAT_WARNUNG}.`);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `frei=${frei.length}\nunbenutzt=${unbenutzt}\ngesamt=${bibliothek.length}\n`);
