// Humor-Quote: Wiederholt sich dieselbe Mechanik zu oft, wird der Post zurückgestellt (oder, wenn nichts anderes da ist, mit Warnung gepostet).
// Die Mechanik steht als optionales Feld `mechanik` im Post-JSON (z. B. "absage" für „Resi weist ab“). Posts ohne Tag zählen nicht.
import fs from "node:fs";
import path from "node:path";

export const QUOTE = { hintereinander: 2, fenster: 14, imFenster: 3 };

// verlauf: Tags der zuletzt gepostenden Posts, ältester zuerst (null = ohne Tag). tag: Mechanik des Kandidaten.
export function pruefeQuote(verlauf, tag, q = QUOTE) {
  if (!tag) return { ok: true };
  let reihe = 0;
  for (let i = verlauf.length - 1; i >= 0 && verlauf[i] === tag; i--) reihe++;
  if (reihe >= q.hintereinander) return { ok: false, grund: `„${tag}“ käme zum ${reihe + 1}. Mal hintereinander (erlaubt: ${q.hintereinander})` };
  const rest = verlauf.slice(-(q.fenster - 1));
  const n = rest.filter((t) => t === tag).length;
  if (n >= q.imFenster) return { ok: false, grund: `„${tag}“ käme zum ${n + 1}. Mal in den letzten ${q.fenster} Posts (erlaubt: ${q.imFenster})` };
  return { ok: true };
}

export function mechanikLesen(roh) {
  if (roh.mechanik === undefined || roh.mechanik === null || roh.mechanik === "") return null;
  if (typeof roh.mechanik !== "string" || !/^[a-zäöüß-]{2,24}$/.test(roh.mechanik)) throw new Error("mechanik muss ein kleingeschriebenes Wort sein (z. B. absage)");
  return roh.mechanik;
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
