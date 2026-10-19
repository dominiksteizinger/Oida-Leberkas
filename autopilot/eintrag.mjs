// Aufbau eines Eintrags (ein Post) und Hilfen, die Rendern, Posten und Holen gemeinsam brauchen.
// Ein Eintrag kommt fertig geschrieben aus der Warteschlange (Issue mit Label „warteschlange“).
import { z } from "zod";

const Antwort = z.object({
  format: z.literal("antwort"),
  von: z.string().min(1).max(40).describe("Wer kommentiert hat, z. B. kollegin.sunny"),
  kommentar: z.string().min(1).max(110),
  zeilen: z.array(z.string().min(1).max(45)).min(1).max(3).describe("Resis Antwort, eine Zeile pro Kasten"),
});
const Notiz = z.object({
  format: z.literal("notiz"),
  titel: z.string().min(1).max(30),
  absaetze: z.array(z.string().min(1).max(140)).min(2).max(5),
});
const Bewertung = z.object({
  format: z.literal("bewertung"),
  nr: z.number().int().positive(),
  ort: z.string().min(1).max(45),
  saerge: z.number().int().min(0).max(5),
  text: z.string().min(1).max(140),
});
const Chat = z.object({
  format: z.literal("chat"),
  name: z.string().min(1).max(24),
  nachrichten: z.array(z.object({ wer: z.enum(["sie", "ich", "zeit"]), text: z.string().min(1).max(80) })).min(3).max(9),
});
const Szene = z.object({
  format: z.literal("szene"),
  satz: z.string().min(1).max(90),
  klammern: z.array(z.string().min(1).max(40)).min(1).max(3),
});

// Handy-Oberflächen über einem Bild (seit 19.10.2026)
const t = (max) => z.string().min(1).max(max);
const Mitteilungen = z.object({
  format: z.literal("mitteilungen"),
  mitteilungen: z.array(z.object({ app: t(16), zeit: t(12), titel: t(30), text: t(80) })).min(2).max(4).describe("die letzte ist die Pointe"),
});
const Termin = z.object({ format: z.literal("termin"), datum: t(30), titel: t(24), zeit: t(24), zeilen: z.array(t(45)).min(1).max(3).describe("Pointe, z. B. Wiederholung und Erinnerung") });
const Wetter = z.object({ format: z.literal("wetter"), ort: t(16), temperatur: t(5), lage: t(16), gefuehlt: t(18).describe("Pointe nach „Gefühlt:“"), zusatz: t(36) });
const Umfrage = z.object({ format: z.literal("umfrage"), frage: t(40), optionen: z.array(z.object({ text: t(24), prozent: z.number().int().min(0).max(100) })).min(2).max(3), fuss: t(40) });
const Wiedergabe = z.object({ format: z.literal("wiedergabe"), titel: t(50), kuenstler: t(24), position: t(10), dauer: t(10), fortschritt: z.number().int().min(0).max(100) });
const Sprachnachricht = z.object({ format: z.literal("sprachnachricht"), name: t(24), dauer_sie: t(6), dauer_ich: t(6), transkript: t(40) });
const Suchverlauf = z.object({ format: z.literal("suchverlauf"), eingabe: t(20), vorschlaege: z.array(t(40)).min(3).max(5) });
const Fehlermeldung = z.object({ format: z.literal("fehlermeldung"), titel: t(24), text: t(110), knopf_links: t(18), knopf_rechts: t(18).describe("Pointe, pinker Knopf") });
const Todo = z.object({ format: z.literal("todo"), titel: t(20), punkte: z.array(z.object({ text: t(28), erledigt: z.boolean() })).min(3).max(5), fazit: t(45) });
const Beleg = z.object({ format: z.literal("beleg"), titel: t(18), untertitel: t(24), posten: z.array(z.object({ name: t(12), menge: t(8) })).min(3).max(6), summe: t(10), fuss: t(70) });

export const Inhalt = z.discriminatedUnion("format", [Antwort, Notiz, Bewertung, Chat, Szene, Mitteilungen, Termin, Wetter, Umfrage, Wiedergabe, Sprachnachricht, Suchverlauf, Fehlermeldung, Todo, Beleg]);

export const Eintrag = z.object({
  inhalt: Inhalt,
  bild: z.string().optional().describe("Dateiname aus bibliothek.json; bei notiz und chat nicht nötig"),
  caption: z.string().min(1).max(400),
  aufforderung: z.string().max(200).default(""),
  hashtags: z.array(z.string().regex(/^#\S+$/)).max(6).default([]),
  musik: z.string().nullable().optional(),
});

// Text für Caption, YouTube-Beschreibung und die Sammelliste
export const captionText = (e) => [e.caption, e.aufforderung, (e.hashtags || []).join(" ")].filter(Boolean).join("\n\n");

export function kurzfassung(i) {
  switch (i.format) {
    case "antwort": return `${i.von}: „${i.kommentar}“ / Resi: „${i.zeilen.join(" ")}“`;
    case "notiz": return `${i.titel}: ${i.absaetze.join(" ")}`;
    case "bewertung": return `Sarg-Bewertung #${i.nr}, ${i.ort}, ${i.saerge}/5: ${i.text}`;
    case "chat": return i.nachrichten.filter((n) => n.wer !== "zeit").map((n) => `${n.wer === "ich" ? "Resi" : "Sie"}: ${n.text}`).join(" / ");
    case "szene": return `${i.satz} ${i.klammern.map((k) => `[${k}]`).join(" ")}`;
    case "mitteilungen": return i.mitteilungen.map((m) => `${m.app}: ${m.titel}, ${m.text}`).join(" / ");
    case "termin": return `Termin ${i.titel}, ${i.zeit}. ${i.zeilen.join(" ")}`;
    case "wetter": return `${i.ort} ${i.temperatur}, ${i.lage}. Gefühlt: ${i.gefuehlt}`;
    case "umfrage": return `${i.frage} ${i.optionen.map((x) => `${x.text} ${x.prozent} %`).join(" / ")}`;
    case "wiedergabe": return `Gerade läuft: ${i.titel} (${i.kuenstler})`;
    case "sprachnachricht": return `${i.name}: Sprachnachricht ${i.dauer_sie} / Resi: ${i.dauer_ich}, „${i.transkript}“`;
    case "suchverlauf": return i.vorschlaege.map((v) => `${i.eingabe} ${v}`).join(" / ");
    case "fehlermeldung": return `${i.titel}: ${i.text} [${i.knopf_links}] [${i.knopf_rechts}]`;
    case "todo": return `${i.titel}: ${i.punkte.map((p) => `${p.erledigt ? "✓" : "○"} ${p.text}`).join(", ")}. ${i.fazit}`;
    case "beleg": return `${i.titel}: ${i.posten.map((p) => `${p.name} ${p.menge}`).join(", ")}. Summe: ${i.summe}`;
  }
}

// Ein kurzer Titel, z. B. für YouTube
export function titel(i) {
  switch (i.format) {
    case "antwort": return i.zeilen.join(" ");
    case "notiz": return `${i.titel}: ${i.absaetze[0]}`;
    case "bewertung": return `Sarg-Bewertung #${i.nr}: ${i.ort}`;
    case "chat": return `Chat mit ${i.name}`;
    case "szene": return i.satz;
    case "mitteilungen": return i.mitteilungen.at(-1).text;
    case "termin": return `Termin: ${i.titel}`;
    case "wetter": return `Wetter: gefühlt ${i.gefuehlt}`;
    case "umfrage": return i.frage;
    case "wiedergabe": return `Gerade läuft: ${i.titel}`;
    case "sprachnachricht": return `Sprachnachricht von ${i.name}`;
    case "suchverlauf": return `Suchverlauf: ${i.eingabe} …`;
    case "fehlermeldung": return `${i.titel}: ${i.text}`;
    case "todo": return i.fazit;
    case "beleg": return `${i.titel}: ${i.summe}`;
  }
}
