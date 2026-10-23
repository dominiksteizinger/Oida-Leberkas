// Humor-Quote: Wiederholt sich dieselbe Mechanik zu oft, wird der Post zurückgestellt (oder, wenn nichts anderes da ist, mit Warnung gepostet).
// Die Mechanik steht als optionales Feld `mechanik` im Post-JSON (z. B. "absage" für „Resi weist ab“). Posts ohne Tag zählen nicht.
import fs from "node:fs";
import path from "node:path";

export const QUOTE = { hintereinander: 2, fenster: 14, imFenster: 3 };

// Witz-Parameter (Dominik 22.10.2026: „mehr Beziehungsthemen und Selbstironie, die letzten Posts waren flach“).
// Jeder neue Post nennt die Mechanik seiner Wende. Höchstzahl pro 14 Posts je Mechanik; Gruppe „selbstironie“ = Resi ist selbst das Ziel.
export const MECHANIKEN = {
  absage: { name: "Abblitzen: Standardsatz, Resi kürzer und ruhig", max: 6 },
  ertappt: { name: "Resi behauptet etwas über sich, die letzte Zeile entlarvt sie", max: 4, gruppe: "selbstironie" },
  gestaendnis: { name: "Resi gibt ruhig etwas Peinliches zu", max: 3, gruppe: "selbstironie" },
  kontrast: { name: "Leben der anderen gegen Resis Realität", max: 3, gruppe: "selbstironie" },
  woertlich: { name: "Floskel oder Profilsatz beim Wort genommen", max: 3 },
  umdeutung: { name: "Erwartung wird in letzter Zeile umgedeutet", max: 3 },
  eskalation: { name: "Kleiner Anlass, absurd große Reaktion, Kippe am Ende", max: 3 },
};
// Mindestanteile in einem Schreib-Lauf (pruefen.mjs, ab MISCHUNG.ab neuen Posts)
export const MISCHUNG = { ab: 6, selbstironie: 0.4, beziehung: 0.4, beziehungsGruppen: ["dating", "familie", "freundinnen"] };

// verlauf: Tags der zuletzt gepostenden Posts, ältester zuerst (null = ohne Tag). tag: Mechanik des Kandidaten.
export function pruefeQuote(verlauf, tag, q = QUOTE) {
  if (!tag) return { ok: true };
  let reihe = 0;
  for (let i = verlauf.length - 1; i >= 0 && verlauf[i] === tag; i--) reihe++;
  if (reihe >= q.hintereinander) return { ok: false, grund: `„${tag}“ käme zum ${reihe + 1}. Mal hintereinander (erlaubt: ${q.hintereinander})` };
  const rest = verlauf.slice(-(q.fenster - 1));
  const n = rest.filter((t) => t === tag).length;
  const max = MECHANIKEN[tag]?.max ?? q.imFenster;
  if (n >= max) return { ok: false, grund: `„${tag}“ käme zum ${n + 1}. Mal in den letzten ${q.fenster} Posts (erlaubt: ${max})` };
  return { ok: true };
}

// pflicht: neue Posts (pruefen.mjs) brauchen eine bekannte Mechanik, alte in der Warteschlange nicht.
export function mechanikLesen(roh, { pflicht = false } = {}) {
  const erlaubt = Object.keys(MECHANIKEN).join(", ");
  if (roh.mechanik === undefined || roh.mechanik === null || roh.mechanik === "") {
    if (pflicht) throw new Error(`mechanik fehlt (eine von: ${erlaubt})`);
    return null;
  }
  if (typeof roh.mechanik !== "string" || !/^[a-zäöüß-]{2,24}$/.test(roh.mechanik)) throw new Error("mechanik muss ein kleingeschriebenes Wort sein (z. B. absage)");
  if (pflicht && !MECHANIKEN[roh.mechanik]) throw new Error(`mechanik „${roh.mechanik}“ unbekannt (erlaubt: ${erlaubt})`);
  return roh.mechanik;
}

// Gag-Bauplan (Dominik 22.10.2026, Deep Research humor/reports/Humor Gen Z Gag Aufbau.md): Jeder neue Post nennt die falsche
// Annahme, die der Leser nach dem Setup trifft („draußen = Natur“). Ohne Annahme gibt es keine Wende. Ortsbewertungen sind raus,
// im Chat hat Resi das letzte Wort.
export function pruefeBauplan(roh) {
  const fehler = [];
  if (typeof roh.annahme !== "string" || roh.annahme.trim().length < 3 || roh.annahme.length > 60) fehler.push("annahme fehlt: Was nimmt der Leser nach dem Setup falsch an? (3 bis 60 Zeichen, z. B. „draußen heißt Natur“)");
  const i = roh.inhalt || {};
  if (i.format === "bewertung") fehler.push("Ortsbewertungen werden nicht mehr gepostet (flach, Dominik 22.10.2026)");
  if (i.format === "chat" && Array.isArray(i.nachrichten) && i.nachrichten.at(-1)?.wer !== "ich") fehler.push("im Chat hat Resi das letzte Wort (letzte Nachricht wer: ich)");
  return fehler;
}

// Mischung eines Schreib-Laufs: genug Selbstironie und Beziehungsthemen. posts: Post-JSONs. Gibt Fehlertexte zurück (leer = ok).
export function pruefeMischung(posts, m = MISCHUNG) {
  if (posts.length < m.ab) return [];
  const fehler = [];
  const anteil = (f) => posts.filter(f).length / posts.length;
  const selbst = anteil((p) => MECHANIKEN[p.mechanik]?.gruppe === "selbstironie");
  const bez = anteil((p) => m.beziehungsGruppen.includes(p.zielgruppe));
  if (selbst < m.selbstironie) fehler.push(`Selbstironie (ertappt, gestaendnis, kontrast) nur ${Math.round(selbst * 100)} %, Soll mindestens ${m.selbstironie * 100} %`);
  if (bez < m.beziehung) fehler.push(`Beziehungsthemen (zielgruppe ${m.beziehungsGruppen.join(" oder ")}) nur ${Math.round(bez * 100)} %, Soll mindestens ${m.beziehung * 100} %`);
  return fehler;
}

// Tags der letzten Posts vor `id` aus tagebuch/<id>/eintrag.json, ältester zuerst
export function verlaufLesen(tagebuch, id, n = QUOTE.fenster - 1) {
  if (!fs.existsSync(tagebuch)) return [];
  return fs.readdirSync(tagebuch)
    .filter((d) => /^\d{4}-\d{2}-\d{2}-\d{2}$/.test(d) && d < id && fs.existsSync(path.join(tagebuch, d, "eintrag.json")))
    .sort()
    .slice(-n)
    .map((d) => JSON.parse(fs.readFileSync(path.join(tagebuch, d, "eintrag.json"), "utf8")).mechanik || null);
}
