// Bild-Recycling: welches Bild der Bibliothek an welchem Tag verwendet werden darf.
//
// Tags in bibliothek.json (Feld „tags“). Tags mit Zeitraum machen das Bild saisonal: es passt nur in
// seinem Zeitraum. „wiederverwendbar: false“ heißt: wird nie ein zweites Mal verwendet (Anlassbilder).
// Alle anderen Bilder dürfen nach dem Mindestabstand (Standard 7 Tage, Dominik 22.10.2026: alte Bilder öfter nutzen, nur nicht hintereinander) erneut erscheinen, aber nur,
// wenn kein ungenutztes Bild mehr passt. Nie dasselbe Bild an zwei aufeinanderfolgenden Tagen.
// Bei einer Wiederverwendung darf der Text nicht identisch zu einem früheren Text des Bildes sein.
import { createHash } from "node:crypto";

export const STANDARD_ABSTAND = 7;

// Zeiträume als [von, bis], MM-TT. von > bis heißt: über den Jahreswechsel.
export const TAGS = {
  neutral: {},
  herbst: { zeitraeume: [["09-01", "11-30"]], wiederverwendbar: true },
  winter: { zeitraeume: [["12-01", "02-28"]], wiederverwendbar: true },
  advent: { zeitraeume: [["11-22", "12-24"]], wiederverwendbar: false },
  weihnachten: { zeitraeume: [["12-01", "12-26"]], wiederverwendbar: false },
  silvester: { zeitraeume: [["12-26", "01-01"]], wiederverwendbar: false },
  halloween: { zeitraeume: [["10-20", "11-01"]], wiederverwendbar: false },
  allerheiligen: { zeitraeume: [["10-25", "11-03"]], wiederverwendbar: false },
  zeitumstellung: { zeitraeume: [["10-20", "11-05"], ["03-20", "04-05"]], wiederverwendbar: false },
};

// Umgebung: BILD_RECYCLING „aus“ schaltet die Wiederverwendung ab (nur ungenutzte Bilder), BILD_ABSTAND_TAGE ändert den Abstand.
export function bildKonfig(env = {}) {
  const abstand = Number(env.BILD_ABSTAND_TAGE);
  return {
    recycling: env.BILD_RECYCLING !== "aus",
    abstand: env.BILD_ABSTAND_TAGE !== undefined && env.BILD_ABSTAND_TAGE !== "" && Number.isFinite(abstand) && abstand >= 0 ? abstand : STANDARD_ABSTAND,
  };
}

export function pruefeTags(bibliothek) {
  for (const b of bibliothek) {
    if (!Array.isArray(b.tags) || !b.tags.length) throw new Error(`${b.datei} hat keine tags`);
    for (const t of b.tags) if (!(t in TAGS)) throw new Error(`${b.datei}: unbekannter Tag „${t}“`);
    // gesicht: sind Gesicht und Augen im Bild gut zu sehen (fürs Reel)? kopf: Gesichtsmitte x und Kinn y als Anteil der Bildgröße
    if (b.gesicht !== "ja" && b.gesicht !== "nein") throw new Error(`${b.datei}: gesicht muss "ja" oder "nein" sein`);
    // mitte (optional): Bildmitte x für den Reel-Ausschnitt, wenn wichtige Bildteile (z. B. Herbert) am Rand liegen
    if (b.mitte !== undefined && !(typeof b.mitte === "number" && b.mitte >= 0 && b.mitte <= 1)) throw new Error(`${b.datei}: mitte muss zwischen 0 und 1 liegen`);
    if (b.kopf !== undefined && !(Array.isArray(b.kopf) && b.kopf.length === 2 && b.kopf.every((v) => typeof v === "number" && v >= 0 && v <= 1))) throw new Error(`${b.datei}: kopf muss [x, y] zwischen 0 und 1 sein`);
  }
  return bibliothek;
}

const imZeitraum = (datum, [von, bis]) => {
  const t = datum.slice(5);
  return von <= bis ? t >= von && t <= bis : t >= von || t <= bis;
};

// Alle Zeitraum-Tags eines Bildes müssen am Tag passen.
export function passtZuDatum(b, datum) {
  return (b.tags || []).every((t) => !TAGS[t]?.zeitraeume || TAGS[t].zeitraeume.some((z) => imZeitraum(datum, z)));
}

const saisonal = (b) => (b.tags || []).some((t) => TAGS[t]?.zeitraeume);
const nieWiederverwendet = (b) => (b.tags || []).some((t) => TAGS[t]?.wiederverwendbar === false);

// Tage zwischen zwei Datumsangaben (YYYY-MM-TT), b − a
export function tageZwischen(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);
}

export function normalisiere(text) {
  return String(text).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

// Alle Textteile eines Eintrags, flach
export function eintragTexte(e) {
  const teile = [];
  const sammle = (x) => {
    if (typeof x === "string" || typeof x === "number") teile.push(String(x));
    else if (Array.isArray(x)) x.forEach(sammle);
    // Dateinamen der Szenenbilder (geschichte) sind kein Text
    else if (x && typeof x === "object") Object.entries(x).forEach(([k, w]) => k !== "bild" && sammle(w));
  };
  sammle(e.inhalt);
  if (e.caption) teile.push(e.caption);
  if (e.aufforderung) teile.push(e.aufforderung);
  return teile;
}

const hash = (t) => createHash("sha1").update(t).digest("hex");

export function fingerabdruck(e) {
  return {
    inhalt: hash(normalisiere(eintragTexte({ inhalt: e.inhalt }).join(" "))),
    caption: hash(normalisiere(e.caption || "")),
  };
}

// Prüft ein Bild für einen Tag. Gibt { ok, wiederverwendung, grund } zurück.
// id: der eigene Eintrag (bei einem Neuversuch nach gescheitertem Posten zählt er nicht als frühere Nutzung).
export function pruefeBild({ bibliothek, nutzung, bild, datum, konf, id, e }) {
  const b = bibliothek.find((x) => x.datei === bild);
  if (!b) return { ok: false, grund: `Bild ${bild} gibt es nicht in bibliothek.json` };
  if (!passtZuDatum(b, datum)) return { ok: false, grund: `${bild} ist saisonal und passt nicht zum ${datum}` };

  const frueher = nutzung.filter((n) => n.bild === bild && n.id !== id);
  if (!frueher.length) return { ok: true, wiederverwendung: false };
  if (!konf.recycling) return { ok: false, grund: `${bild} wurde schon verwendet, Wiederverwendung ist aus (BILD_RECYCLING)` };
  if (nieWiederverwendet(b)) return { ok: false, grund: `${bild} ist ein Anlassbild und wird nicht wiederverwendet` };

  const naechste = Math.min(...frueher.map((n) => Math.abs(tageZwischen(n.datum, datum))));
  if (naechste <= 1) return { ok: false, grund: `${bild} wurde am selben oder am Vortag verwendet` };
  if (naechste < konf.abstand) return { ok: false, grund: `${bild} wurde vor ${naechste} Tagen verwendet, Mindestabstand ${konf.abstand} Tage` };

  if (e) {
    const fp = fingerabdruck(e);
    const doppelt = frueher.some((n) => n.fingerabdruck && (n.fingerabdruck.inhalt === fp.inhalt || n.fingerabdruck.caption === fp.caption));
    if (doppelt) return { ok: false, grund: `Text für ${bild} ist identisch mit einem früheren Text dieses Bildes, neu formulieren` };
  }
  return { ok: true, wiederverwendung: true };
}

// Alle Bilder, die am Tag passen, in Reihenfolge: Bilder mit sichtbarem Gesicht zuerst (fürs Reel),
// darin ungenutzte vor wiederverwendbaren (saisonale vor den übrigen), danach nach ältester letzter Nutzung.
export function kandidaten({ bibliothek, nutzung, datum, konf, id }) {
  const liste = [];
  for (const b of bibliothek) {
    const r = pruefeBild({ bibliothek, nutzung, bild: b.datei, datum, konf, id });
    if (!r.ok) continue;
    const letzte = nutzung.filter((n) => n.bild === b.datei && n.id !== id).reduce((a, n) => (n.datum > a ? n.datum : a), "");
    liste.push({ datei: b.datei, beschreibung: b.beschreibung, gesicht: b.gesicht, wiederverwendung: r.wiederverwendung, letzte, saisonal: saisonal(b) });
  }
  const rang = (x) => (!x.wiederverwendung ? (x.saisonal ? 0 : 1) : 2);
  return liste.sort((a, b) => (a.gesicht === "ja" ? 0 : 1) - (b.gesicht === "ja" ? 0 : 1) || rang(a) - rang(b) || (a.letzte < b.letzte ? -1 : a.letzte > b.letzte ? 1 : 0));
}

// bild: ein Dateiname oder eine Liste (geschichte: alle Szenenbilder, je ein Eintrag)
export function verbuchen(nutzung, { id, datum, slot, bild, e }) {
  const ohne = nutzung.filter((n) => n.id !== id);
  const text = eintragTexte(e).join(" | ").slice(0, 400);
  return [...ohne, ...[bild].flat().map((b) => ({ id, datum, slot, bild: b, text, fingerabdruck: fingerabdruck(e) }))];
}
