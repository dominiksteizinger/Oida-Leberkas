// Fehlerarten (Dominik 22.10.2026: „erkennen, dass etwas nicht witzig ist und woran das liegt“).
// Ein fester Satz Gründe, den alle Prüfungen benutzen: pruefen.mjs (automatisch), der blinde Gegenleser (gegenleser.md),
// die Flop-3 der Wochenauswertung (messung.mjs) und Dominiks Urteile. Gesammelt in auswertung/gruende.json,
// zurück in den Nachschub über auswertung/signal.json („gruende“).
import fs from "node:fs";

export const FEHLERARTEN = {
  vorwissen: { name: "Vorwissen nötig", frage: "Versteht man es ohne Insider, Trendwort oder Vorgeschichte?" },
  logische_folge: { name: "Schluss nur logische Folge", frage: "Kippt die letzte Zeile etwas, oder folgt sie nur aus dem Setup?" },
  vorhersehbar: { name: "Pointe vorhersehbar", frage: "Hätte die Hälfte der Leser den Schluss erraten?" },
  flach: { name: "Flach, nur Zustand oder Stimmung", frage: "Gibt es ein Gegenüber oder einen Widerspruch?" },
  kontext_unklar: { name: "Kontext unklar", frage: "Ist in 3 Sekunden klar, wer mit wem worüber spricht?" },
  kein_adressat: { name: "Niemand zum Schicken", frage: "An wen schickt man das, mit welchem Satz?" },
  ue40: { name: "Klingt nach Ü40", frage: "Würde eine 22-Jährige das teilen?" },
  pointe_falsch: { name: "Pointe falsch gebaut", frage: "Sagt Resi die Pointe, kurz, ohne Frage und Ausrufezeichen?" },
  zu_lang: { name: "Zu lang", frage: "Höchstens vier Takte, Schluss höchstens 8 Wörter (absage 6)?" },
  bild_passt_nicht: { name: "Bild passt nicht", frage: "Passt das Bild zur Szene, ist der Kopf ganz zu sehen?" },
};

// Automatische Meldungen (schluss.mjs, ausschnitt.mjs, zielgruppe.mjs, humorquote.mjs) einer Fehlerart zuordnen
const MUSTER = [
  [/Flach-Test|Stimmungsposts?|Zustand/i, "flach"],
  [/kein neues konkretes Wort|Wiederholung des Setups/i, "logische_folge"],
  [/Trendwort|Vorwissen/i, "vorwissen"],
  [/ist eine Frage|Ausrufezeichen|sagt das Gegenüber|letzte Wort/i, "pointe_falsch"],
  [/Wörter, höchstens|zu lang|Takte/i, "zu_lang"],
  [/Ü40/i, "ue40"],
  [/Kopf|Sticker|Bild .* passt|kopf-Feld/i, "bild_passt_nicht"],
  [/annahme fehlt|mechanik fehlt|ohne mechanik/i, "vorhersehbar"],
];
export function fehlerartVon(meldung) {
  for (const [re, k] of MUSTER) if (re.test(meldung)) return k;
  return null;
}

// Eintrag für auswertung/gruende.json prüfen. quelle: pruefung | gegenleser | flop | dominik
export function grundEintrag({ datum, quelle, post, schluss = null, art, grund = "" }) {
  if (!FEHLERARTEN[art]) throw new Error(`Fehlerart „${art}“ unbekannt (erlaubt: ${Object.keys(FEHLERARTEN).join(", ")})`);
  if (!["pruefung", "gegenleser", "flop", "dominik"].includes(quelle)) throw new Error(`quelle „${quelle}“ unbekannt`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum || "")) throw new Error("datum muss JJJJ-MM-TT sein");
  return { datum, quelle, post, schluss, art, grund };
}

// Häufigste Gründe der letzten `tage` Tage, Dominik und Flops zählen doppelt (echte Wirkung statt Vermutung)
export function haeufigste(gruende, { heute, tage = 30, n = 3 } = {}) {
  const grenze = heute ? new Date(Date.parse(heute + "T12:00:00Z") - tage * 864e5).toISOString().slice(0, 10) : "0000";
  const zaehl = new Map();
  for (const g of gruende.filter((x) => x.datum >= grenze && FEHLERARTEN[x.art])) {
    const w = g.quelle === "dominik" || g.quelle === "flop" ? 2 : 1;
    const z = zaehl.get(g.art) || { art: g.art, name: FEHLERARTEN[g.art].name, gewicht: 0, beispiele: [] };
    z.gewicht += w;
    if (g.schluss && z.beispiele.length < 2) z.beispiele.push(g.schluss);
    zaehl.set(g.art, z);
  }
  return [...zaehl.values()].sort((a, b) => b.gewicht - a.gewicht).slice(0, n);
}

export function gruendeLesen(datei) {
  try { return JSON.parse(fs.readFileSync(datei, "utf8")).gruende || []; } catch { return []; }
}

// Aufruf zum Eintragen (Schreib-Lauf, Gegenleser, Dominiks Urteil):
//   node fehlerarten.mjs add <datum> <quelle> <post> <art> "<grund>" ["<schluss>"]
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , cmd, datum, quelle, post, art, grund, schluss] = process.argv;
  const datei = new URL("../auswertung/gruende.json", import.meta.url).pathname;
  if (cmd === "add") {
    const liste = gruendeLesen(datei);
    liste.push(grundEintrag({ datum, quelle, post, art, grund, schluss: schluss || null }));
    fs.writeFileSync(datei, JSON.stringify({ hinweis: "Gründe, warum Posts nicht witzig waren (fehlerarten.mjs). Pflege: node autopilot/fehlerarten.mjs add …", gruende: liste }, null, 1) + "\n");
    console.log(`eingetragen: ${art} (${quelle}) ${post}`);
  } else {
    console.log(Object.entries(FEHLERARTEN).map(([k, v]) => `${k}: ${v.name} – ${v.frage}`).join("\n"));
  }
}
