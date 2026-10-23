// Bildausschnitt-Check: Ist Resis Kopf im fertigen Post ganz zu sehen? (Dominik 22.10.2026: Sticker im szene-Format schneiden den Kopf ab.)
// szene zeigt das Bild als Streifen 1080x800 (object-fit: cover, formate.mjs). Hochformat-Sticker (art: figur) verlieren dort den Kopf,
// Hochformat-Szenen ohne `kopf` lassen sich nicht prüfen. Mit `kopf` (Gesichtsmitte x, Kinn y) rechnet die Prüfung den sichtbaren Bereich nach.
// Alle anderen Formate zeigen das Bild voll (antwort) oder als Vollbild hinter der Karte; das Reel schneidet um `kopf` (video.mjs).
import fs from "node:fs";

// Breite und Höhe aus dem Dateikopf (JPEG oder PNG), ohne Bildbibliothek
export function bildMass(datei) {
  const b = fs.readFileSync(datei);
  if (b.readUInt32BE(0) === 0x89504e47) return { breite: b.readUInt32BE(16), hoehe: b.readUInt32BE(20) };
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { breite: b.readUInt16BE(i + 7), hoehe: b.readUInt16BE(i + 5) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  throw new Error(`${datei}: Bildgröße nicht lesbar`);
}

// Sichtbarer Bereich (Anteil der Bildhöhe, oben und unten) im szene-Streifen, gleiche Rechnung wie formate.mjs
export const SZENE = { breite: 1080, hoehe: 800 };
export function szeneSichtbar(b, { breite, hoehe }) {
  const s = Math.max(SZENE.breite / breite, SZENE.hoehe / hoehe);
  const h = hoehe * s;
  const hell = b.art === "figur";
  const pos = hell ? 0.25 : b.kopf ? Math.max(0, Math.round(b.kopf[1] * 100 - 10)) / 100 : 0.5;
  const oben = (pos * (h - SZENE.hoehe)) / h;
  return { oben, unten: oben + SZENE.hoehe / h };
}

// Kopfhöhe grob: rund 220 px bei 1080 px Bildbreite (gemessen an den Hochformat-Szenen der Bibliothek)
const KOPF_PX = 220;

export function pruefeAusschnitt(post, b, mass) {
  const format = post.inhalt?.format;
  if (format !== "szene" || !b) return [];
  if (b.art === "figur") return [`Bild ${b.datei} ist ein Sticker (art: figur): im szene-Format ist der Kopf abgeschnitten. Für szene eine Szene mit kopf-Feld nehmen, Sticker nur für antwort`];
  if (!mass || mass.hoehe <= mass.breite) return [];
  if (!b.kopf) return [`Bild ${b.datei} ist Hochformat ohne kopf-Feld in bibliothek.json; der Ausschnitt im szene-Format lässt sich nicht prüfen (kopf: [x, Kinn y] ergänzen oder anderes Bild)`];
  const { oben, unten } = szeneSichtbar(b, mass);
  const kinn = b.kopf[1];
  const scheitel = kinn - (KOPF_PX * mass.breite) / 1080 / mass.hoehe;
  if (scheitel < oben - 0.01 || kinn > unten) return [`Bild ${b.datei}: im szene-Format ist der Kopf nicht ganz zu sehen (sichtbar ${Math.round(oben * 100)} bis ${Math.round(unten * 100)} % der Höhe, Kopf ${Math.round(Math.max(0, scheitel) * 100)} bis ${Math.round(kinn * 100)} %)`];
  return [];
}

// geschichte (Mini-Szene aus 3–4 Bildern): Jedes Szenenbild läuft im Reel als Vollbild am Gesicht, deshalb nur Hochformat-Szenen mit `kopf`,
// jedes Bild nur einmal. `bild` ist das Bild der letzten Szene (Titelbild, Bildregeln). bibliothek: Liste aus bibliothek.json, mass: Datei -> { breite, hoehe }.
export function pruefeGeschichte(post, bibliothek, mass) {
  if (post.inhalt?.format !== "geschichte" || !Array.isArray(post.inhalt.szenen)) return [];
  const fehler = [];
  const dateien = post.inhalt.szenen.map((s) => s?.bild).filter(Boolean);
  if (new Set(dateien).size !== dateien.length) fehler.push("geschichte: jedes Szenenbild nur einmal verwenden");
  if (post.bild && post.bild !== dateien.at(-1)) fehler.push(`geschichte: bild weglassen oder gleich dem Bild der letzten Szene (${dateien.at(-1)})`);
  for (const d of dateien) {
    const b = bibliothek.find((x) => x.datei === d);
    if (!b) { fehler.push(`Bild ${d} gibt es nicht in bibliothek.json`); continue; }
    if (b.art !== "szene" || !b.kopf) { fehler.push(`Bild ${d}: geschichte braucht Szenen mit kopf-Feld (kein Sticker)`); continue; }
    let m = null;
    try { m = mass(d); } catch {}
    if (m && m.hoehe <= m.breite) fehler.push(`Bild ${d} ist Querformat; geschichte braucht Hochformat-Szenen (Vollbild im Reel)`);
  }
  return fehler;
}
