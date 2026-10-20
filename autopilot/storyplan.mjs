// Entscheidungen für die Instagram-Storys (seit 20.10.2026), ohne Netz und Dateien, damit sie testbar bleiben.
// Zwei Story-Slots am Tag: „mittag“ (Karte aus dem Vorrat storys.json, an auffälligen Wettertagen eine Wetter-Story)
// und „abend“ (Hinweis auf den frischen Post von 16 Uhr). Jede Karte geht nur einmal raus.
import { z } from "zod";
import { Inhalt } from "./eintrag.mjs";
import { OHNE_BILD } from "./formate.mjs";
import { TAGS, passtZuDatum, tageZwischen } from "./bildregeln.mjs";
import { wortfilter } from "./wortfilter.mjs";

const datumRe = /^\d{4}-\d{2}-\d{2}$/;
export const WOCHENTAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
export const wochentag = (datum) => WOCHENTAGE[new Date(`${datum}T12:00:00Z`).getUTCDay()];
// Nennt eine Karte einen Wochentag („Es ist Montag“), muss sie sagen, an welchen Tagen sie rausdarf (Dominik 20.10.2026:
// Montags-Story lief am Dienstag). "alle", wenn der Tag nur allgemein gemeint ist („noch bis Freitag“ geht nicht: dann Mo bis Do).
const TAG_IM_TEXT = new RegExp(`\\b(${WOCHENTAGE.join("|")})s?\\b`, "i");
export const Karte = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  inhalt: Inhalt,
  bild: z.string().optional(),
  ab: z.string().regex(datumRe).optional(),
  bis: z.string().regex(datumRe).optional(),
  tage: z.union([z.literal("alle"), z.array(z.enum(WOCHENTAGE)).min(1)]).optional(),
});
const WetterZeile = z.object({ gefuehlt: z.string().min(1).max(18), zusatz: z.string().min(1).max(36) });
export const LAGEN = { sonne: "Sonnig", wolken: "Bewölkt", nebel: "Nebel", regen: "Regen", schnee: "Schnee", gewitter: "Gewitter", hitze: "Heiß", frost: "Frost" };
export const Vorrat = z.object({
  hinweise: z.array(z.string().min(1).max(70)).min(3),
  wetter: z.object(Object.fromEntries(Object.keys(LAGEN).map((k) => [k, z.array(WetterZeile)]))),
  karten: z.array(Karte),
});

// Story-Slot nach Wiener Stunde: 11 bis 15 Uhr Mittag, 16 bis 23 Uhr Abend. Angestoßen vom Autopilot-Lauf (cron-job.org 11:17, 16:17, 22:17),
// der GitHub-Cron in storys.yml ist nur Reserve, weil er oft ausfällt.
export function slotFuer(stunde) {
  if (stunde >= 11 && stunde <= 15) return "mittag";
  if (stunde >= 16 && stunde <= 23) return "abend";
  return null;
}

// Prüft den ganzen Vorrat: Schema, Wortfilter, Bilder, doppelte IDs. Gibt Fehlertexte zurück (leer = alles gut).
export function pruefeVorrat(roh, bibliothek) {
  const r = Vorrat.safeParse(roh);
  if (!r.success) return r.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`);
  const fehler = [];
  const ids = new Set();
  const dateien = new Set(bibliothek.map((b) => b.datei));
  for (const k of r.data.karten) {
    if (ids.has(k.id)) fehler.push(`${k.id}: ID doppelt`);
    ids.add(k.id);
    if (k.bild && !dateien.has(k.bild)) fehler.push(`${k.id}: Bild ${k.bild} fehlt in bibliothek.json`);
    if (k.ab && k.bis && k.ab > k.bis) fehler.push(`${k.id}: ab liegt nach bis`);
    if (!k.tage && TAG_IM_TEXT.test(JSON.stringify(k.inhalt))) fehler.push(`${k.id}: nennt einen Wochentag, braucht "tage" (z. B. ["Montag"] oder "alle")`);
    for (const t of wortfilter(k)) fehler.push(`${k.id}: verbotenes Wort „${t.wort}“ in ${t.feld}`);
  }
  r.data.hinweise.forEach((h, n) => wortfilter({ h }).forEach((t) => fehler.push(`hinweise[${n}]: verbotenes Wort „${t.wort}“`)));
  for (const [lage, zeilen] of Object.entries(r.data.wetter)) zeilen.forEach((z, n) => wortfilter(z).forEach((t) => fehler.push(`wetter.${lage}[${n}]: verbotenes Wort „${t.wort}“`)));
  return fehler;
}

const benutzt = (log) => new Set(log.filter((x) => x.karte).map((x) => x.karte));
const imZeitraum = (k, datum) => (!k.ab || k.ab <= datum) && (!k.bis || datum <= k.bis) && (!k.tage || k.tage === "alle" || k.tage.includes(wochentag(datum)));

// Karten, die heute raus dürfen: noch nie gepostet, im Zeitraum, am richtigen Wochentag. Anlass-Karten (mit bis) zuerst, das früheste Ende vorn, sonst Reihenfolge der Datei.
export function offeneKarten(karten, log, datum) {
  const weg = benutzt(log);
  const offen = karten.filter((k) => !weg.has(k.id) && imZeitraum(k, datum));
  return [...offen.filter((k) => k.bis).sort((a, b) => a.bis.localeCompare(b.bis)), ...offen.filter((k) => !k.bis)];
}

// Open-Meteo-Tageswerte in eine Lage übersetzen
export function lageAus({ code, max, min }) {
  if (max >= 28) return "hitze";
  if (min <= -2 && code < 71) return "frost";
  if (code >= 95) return "gewitter";
  if (code >= 71 && code <= 77) return "schnee";
  if (code >= 85 && code <= 86) return "schnee";
  if (code >= 51) return "regen";
  if (code >= 45) return "nebel";
  return code === 0 ? "sonne" : "wolken";
}
const AUFFAELLIG = new Set(["nebel", "regen", "schnee", "gewitter", "hitze", "frost"]);

// Wetter-Story aus den Tageswerten und dem Text-Vorrat. Die Zeile wechselt durch (die am längsten nicht genutzte zuerst).
export function wetterKarte(tag, vorrat, log, datum) {
  const lage = lageAus(tag);
  const zeilen = vorrat.wetter[lage] || [];
  if (!zeilen.length) return null;
  const zuletzt = (n) => log.filter((x) => x.wetter === `${lage}-${n}`).map((x) => x.datum).sort().at(-1) || "";
  const n = zeilen.map((_, k) => k).sort((a, b) => zuletzt(a).localeCompare(zuletzt(b)) || a - b)[0];
  return {
    id: `wetter-${datum}`,
    wetter: `${lage}-${n}`,
    lage,
    inhalt: { format: "wetter", ort: "Wien", temperatur: `${Math.round(tag.max)}°`, lage: LAGEN[lage], ...zeilen[n] },
  };
}

// Mittag: Anlass-Karte vor Wetter vor normaler Karte. Wetter nur an auffälligen Tagen und höchstens alle 3 Tage,
// oder als Ersatz, wenn keine Karte mehr da ist.
export function waehleMittag({ vorrat, log, datum, wetter }) {
  const offen = offeneKarten(vorrat.karten, log, datum);
  const anlass = offen.find((k) => k.bis);
  if (anlass) return { art: "karte", karte: anlass };
  const w = wetter && wetterKarte(wetter, vorrat, log, datum);
  const letzteWetter = log.filter((x) => x.wetter).map((x) => x.datum).sort().at(-1);
  const wetterFrei = !letzteWetter || tageZwischen(letzteWetter, datum) >= 3;
  if (w && ((AUFFAELLIG.has(w.lage) && wetterFrei) || !offen.length)) return { art: "wetter", karte: w };
  if (offen.length) return { art: "karte", karte: offen[0] };
  return null;
}

// Hinweis-Zeile für den Abend: reihum, die am längsten nicht genutzte zuerst
export function waehleHinweis(hinweise, log) {
  const zuletzt = (n) => log.filter((x) => x.hinweis === n).map((x) => x.datum).sort().at(-1) || "";
  return hinweise.map((_, k) => k).sort((a, b) => zuletzt(a).localeCompare(zuletzt(b)) || a - b)[0];
}

const SUCHWORT = { regen: /regen/i, schnee: /schnee/i, nebel: /nebel/i, sonne: /sonn/i, frost: /schnee|winter/i };
const nieWieder = (b) => (b.tags || []).some((t) => TAGS[t]?.wiederverwendbar === false);

// Bild für eine Karte ohne festes Bild: Hochformat-Szene (mit `kopf`), die heute passt, keine einmaligen Anlassbilder,
// nicht in den Posts der letzten 3 Tage und nicht in den Storys der letzten 10 Tage. Gesicht zuerst, die am längsten nicht
// in einer Story verwendete zuerst; bei Wetter zuerst Bilder, deren Beschreibung zur Lage passt.
export function waehleBild({ bibliothek, nutzung, log, datum, lage }) {
  const kurz = (liste, tage) => new Set(liste.filter((x) => x.bild && x.datum && tageZwischen(x.datum, datum) >= 0 && tageZwischen(x.datum, datum) < tage).map((x) => x.bild));
  const gesperrt = new Set([...kurz(nutzung, 3), ...kurz(log, 10)]);
  const zuletzt = (d) => log.filter((x) => x.bild === d).map((x) => x.datum).sort().at(-1) || "";
  const passt = (b) => (SUCHWORT[lage] ? (SUCHWORT[lage].test(b.beschreibung || "") ? 0 : 1) : 0);
  const liste = bibliothek
    .filter((b) => b.art === "szene" && b.kopf && passtZuDatum(b, datum) && !nieWieder(b) && !gesperrt.has(b.datei))
    .sort((a, b) => passt(a) - passt(b) || (a.gesicht === "ja" ? 0 : 1) - (b.gesicht === "ja" ? 0 : 1) || zuletzt(a.datei).localeCompare(zuletzt(b.datei)) || a.datei.localeCompare(b.datei));
  return liste[0]?.datei || null;
}

export const brauchtBild = (inhalt) => !OHNE_BILD.has(inhalt.format);
